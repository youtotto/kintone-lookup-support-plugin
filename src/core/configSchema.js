'use strict';

/**
 * config schema v2 の読み込み・migration・保存用の変換。
 *
 * 原則:
 *   - 読み込みは「生の config → migration → v2」。version が現在より新しければ read-only。
 *   - 保存は「生の v2 に UI で編集した既知ノード（marker / autoFetch）だけを浅くマージして全体を書き戻す」。
 *     未知のノード（conditionalFetch / diffCheck / 将来のノード）や未知のプロパティは触らない。
 *   - copyFieldCodes は保存しない（フォーム定義から都度導出）。旧 settings への互換投影でだけ使う。
 */
const C = require('./constants');
const { copyTargetsOf } = require('./lookupFields');

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

function safeParse(text) {
  try { return { ok: true, value: JSON.parse(text) }; } catch (_e) { return { ok: false, value: null }; }
}

function normalizeColor(color) {
  const c = String(color || '').toLowerCase();
  return C.PALETTE.some((p) => p.value === c) ? c : C.DEFAULT_COLOR;
}

function normalizeMode(mode) {
  return C.MODES.includes(mode) ? mode : C.DEFAULT_MODE;
}

/** scope は既知の値だけ残す（'create' / 'edit' は互換のため保持するが無料版では使わない）。無ければ ['detail'] */
function normalizeScope(scope) {
  if (!Array.isArray(scope)) return [...C.DEFAULT_MARKER_SCOPE];
  const valid = scope.filter((s) => C.MARKER_SCOPES.includes(s));
  return valid.length ? valid : [...C.DEFAULT_MARKER_SCOPE];
}

function emptyConfig() {
  return { version: C.CONFIG_VERSION, meta: { edition: C.EDITION, savedAt: '', migratedFrom: [] }, items: [] };
}

/** 新しい item（無料版 UI で追加するときの既定値。＋専用ノードは schema どおり無効で持つ） */
function defaultItem(lookupFieldCode, subtableCode = null) {
  return {
    lookupFieldCode,
    subtableCode,
    marker: { enabled: true, color: C.DEFAULT_COLOR, scope: [...C.DEFAULT_MARKER_SCOPE] },
    autoFetch: { enabled: true, mode: C.DEFAULT_MODE },
    conditionalFetch: { enabled: false, condition: null },
    diffCheck: { enabled: false }
  };
}

/** 既知ノードだけを補正し、未知のキーはそのまま残す */
function normalizeItem(item) {
  const src = isObject(item) ? item : {};
  const marker = isObject(src.marker) ? src.marker : {};
  const autoFetch = isObject(src.autoFetch) ? src.autoFetch : {};
  return {
    ...src,
    lookupFieldCode: String(src.lookupFieldCode || ''),
    subtableCode: src.subtableCode ? String(src.subtableCode) : null,
    marker: { ...marker, enabled: marker.enabled !== false, color: normalizeColor(marker.color), scope: normalizeScope(marker.scope) },
    autoFetch: { ...autoFetch, enabled: autoFetch.enabled === true, mode: normalizeMode(autoFetch.mode) }
  };
}

function normalizeConfig(config) {
  const src = isObject(config) ? config : {};
  const meta = isObject(src.meta) ? src.meta : {};
  return {
    ...src,
    version: C.CONFIG_VERSION,
    meta: { ...meta, edition: meta.edition || C.EDITION, savedAt: meta.savedAt || '', migratedFrom: Array.isArray(meta.migratedFrom) ? meta.migratedFrom : [] },
    items: (Array.isArray(src.items) ? src.items : []).map(normalizeItem).filter((it) => it.lookupFieldCode)
  };
}

/** 旧 settings 配列（LCM v1 / Plus v1）を v2 へ変換する */
function migrateLegacy(settings) {
  const list = Array.isArray(settings) ? settings.filter((s) => isObject(s) && s.lookupFieldCode) : [];
  const isPlus = list.some((s) => Object.prototype.hasOwnProperty.call(s, 'lookupEnabled'));
  const config = emptyConfig();
  config.meta.migratedFrom = [isPlus ? 'plus-v1' : 'lcm-v1'];
  config.items = list.map((s) => {
    const code = String(s.lookupFieldCode);
    const dot = code.indexOf('.');
    const item = dot > 0 ? defaultItem(code.slice(dot + 1), code.slice(0, dot)) : defaultItem(code);
    item.marker.enabled = s.enabled !== false;
    item.marker.color = normalizeColor(s.color);
    /* 旧 LCM には自動取得が無いので勝手に有効化しない。旧 Plus は「常に取得」の挙動を維持する */
    item.autoFetch = isPlus ? { enabled: s.lookupEnabled !== false, mode: 'always' } : { enabled: false, mode: C.DEFAULT_MODE };
    return item;
  });
  return { state: 'migrated', config, from: config.meta.migratedFrom[0] };
}

/**
 * kintone.plugin.app.getConfig() の戻り（文字列の連想配列）から v2 config を得る。
 * @returns {{ state: 'v2'|'migrated'|'empty'|'invalid'|'newer', config: object, from?: string, raw?: object }}
 */
function loadConfig(raw) {
  const src = isObject(raw) ? raw : {};
  if (typeof src.config === 'string' && src.config.trim() !== '') {
    const p = safeParse(src.config);
    const version = p.ok && isObject(p.value) ? Number(p.value.version) : NaN;
    if (!Number.isFinite(version)) return { state: 'invalid', config: emptyConfig() };
    if (version > C.CONFIG_VERSION) return { state: 'newer', config: p.value, raw: p.value };
    return { state: 'v2', config: normalizeConfig(p.value) };
  }
  if (typeof src.settings === 'string' && src.settings.trim() !== '') {
    const p = safeParse(src.settings);
    if (!p.ok || !Array.isArray(p.value)) return { state: 'invalid', config: emptyConfig() };
    return migrateLegacy(p.value);
  }
  return { state: 'empty', config: emptyConfig() };
}

const sameTarget = (item, code, subtableCode) => item.lookupFieldCode === code && (item.subtableCode || null) === (subtableCode || null);

function findItem(config, code, subtableCode = null) {
  return (config.items || []).find((it) => sameTarget(it, code, subtableCode)) || null;
}

/**
 * UI で編集した marker / autoFetch を既存 item にマージする。config は変更せず新しいオブジェクトを返す。
 * @param {object} config v2
 * @param {Array<{lookupFieldCode, subtableCode?, marker?: {enabled, color}, autoFetch?: {enabled, mode}}>} edits
 */
function applyEdits(config, edits) {
  const next = clone(normalizeConfig(config));
  (edits || []).forEach((edit) => {
    if (!edit || !edit.lookupFieldCode) return;
    let item = findItem(next, edit.lookupFieldCode, edit.subtableCode);
    if (!item) { item = defaultItem(edit.lookupFieldCode, edit.subtableCode || null); next.items.push(item); }
    if (isObject(edit.marker)) {
      item.marker = { ...item.marker, enabled: edit.marker.enabled !== false, color: normalizeColor(edit.marker.color) };
    }
    if (isObject(edit.autoFetch)) {
      item.autoFetch = { ...item.autoFetch, enabled: edit.autoFetch.enabled === true, mode: normalizeMode(edit.autoFetch.mode) };
    }
  });
  return next;
}

function removeItem(config, code, subtableCode = null) {
  const next = clone(normalizeConfig(config));
  next.items = next.items.filter((it) => !sameTarget(it, code, subtableCode));
  return next;
}

/**
 * 旧 ZIP（LCM v1 / Plus v1）へ戻したときに読める互換投影。正規の設定ではない。
 * lookupEnabled は「自動取得が有効かつ常に取得」のときだけ true にする（旧 Plus は常時取得しかないため、安全側）。
 */
function buildLegacySettings(config, properties) {
  return normalizeConfig(config).items.filter((it) => !it.subtableCode).map((it) => ({
    lookupFieldCode: it.lookupFieldCode,
    enabled: it.marker.enabled,
    color: it.marker.color,
    copyFieldCodes: properties ? copyTargetsOf(properties, it.lookupFieldCode) : [],
    lookupEnabled: it.autoFetch.enabled && it.autoFetch.mode === 'always'
  }));
}

/** setConfig に渡す { config, settings } を作る */
function serialize(config, { properties = null, edition = C.EDITION, now = new Date() } = {}) {
  const next = clone(normalizeConfig(config));
  next.meta.edition = edition;
  next.meta.savedAt = now instanceof Date ? now.toISOString() : String(now);
  return { config: JSON.stringify(next), settings: JSON.stringify(buildLegacySettings(next, properties)) };
}

module.exports = {
  emptyConfig, defaultItem, normalizeItem, normalizeConfig, normalizeColor, normalizeMode,
  migrateLegacy, loadConfig, findItem, applyEdits, removeItem, buildLegacySettings, serialize
};
