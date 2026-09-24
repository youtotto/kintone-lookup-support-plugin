'use strict';

/**
 * 設定画面（1 ルックアップ = 1 カード）。無料版・＋ 共通の土台。
 * 無料版は marker / autoFetch の段だけを DOM に出す。＋専用ノードは DOM に出さず、保存時もそのまま保持する。
 * innerHTML は使わない（ユーザー値はすべて textContent）。
 */
const C = require('./constants');
const P = require('./plusLink');
const S = require('./configSchema');
const { listLookups } = require('./lookupFields');

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** ゲストスペース対応の基底パス */
function getBasePath(pathname) {
  const m = /^\/k\/guest\/(\d+)/.exec(pathname || '');
  return m ? `/k/guest/${m[1]}` : '/k';
}

function pluginListUrl(pathname, appId, saved) {
  return `${getBasePath(pathname)}/admin/app/${appId}/plugin/${saved ? '?message=CONFIG_SAVED#/' : ''}`;
}

function notice(doc, kind, text) {
  return el(doc, 'div', `ls-notice ls-notice-${kind}`, text);
}

function buildUpsell(doc) {
  const wrap = el(doc, 'div', 'ls-upsell');
  wrap.appendChild(doc.createTextNode(P.UPSELL_TEXT_BEFORE));
  if (P.PLUS_PRODUCT_URL) {
    const a = el(doc, 'a', '', P.PLUS_PRODUCT_NAME);
    a.href = P.PLUS_PRODUCT_URL;
    a.target = '_blank';
    a.rel = 'noopener';
    wrap.appendChild(a);
  } else {
    wrap.appendChild(el(doc, 'span', 'ls-upsell-name', P.PLUS_PRODUCT_NAME));
  }
  wrap.appendChild(doc.createTextNode(P.UPSELL_TEXT_AFTER));
  return wrap;
}

/** 色 select。全 option を追加してから select.value に保存色（パレット照合済み）を 1 回だけ代入する */
function buildColorSelect(doc, value) {
  const select = el(doc, 'select', 'ls-color kintoneplugin-select');
  C.PALETTE.forEach((p) => {
    const opt = el(doc, 'option', '', `　${p.label}　`);
    opt.value = p.value;
    opt.style.backgroundColor = p.value;
    select.appendChild(opt);
  });
  select.value = S.normalizeColor(value);
  const paint = () => {
    select.style.backgroundColor = select.value;
    select.style.borderLeft = `6px solid ${(C.PALETTE.find((p) => p.value === select.value) || C.PALETTE[0]).band}`;
  };
  select.addEventListener('change', paint);
  paint();
  return select;
}

function buildModeSelect(doc, value) {
  const select = el(doc, 'select', 'ls-mode kintoneplugin-select');
  C.MODES.forEach((mode) => {
    const opt = el(doc, 'option', '', C.MODE_LABELS[mode]);
    opt.value = mode;
    select.appendChild(opt);
  });
  select.value = S.normalizeMode(value);
  return select;
}

/** 通常カード（フォームに存在するルックアップ） */
function buildCard(doc, lookup, item, readOnly) {
  const card = el(doc, 'div', 'ls-card');
  card.dataset.code = lookup.code;
  card.appendChild(el(doc, 'div', 'ls-card-title', `${lookup.label}（${lookup.code}）`));
  card.appendChild(el(doc, 'div', 'ls-card-copy', lookup.copyFieldCodes.length ? `コピー先：${lookup.copyFieldCodes.join('、')}` : 'コピー先：なし'));

  const marker = el(doc, 'section', 'ls-section ls-section-marker');
  marker.appendChild(el(doc, 'h3', 'ls-section-title', 'カラーマーカー（レコード詳細画面）'));
  marker.appendChild(el(doc, 'p', 'ls-section-note', 'レコード詳細画面で、このルックアップフィールドとコピー先フィールドを同じ色で表示します。追加・編集画面には表示されません。'));
  const mLabel = el(doc, 'label', 'ls-check');
  const mCheck = el(doc, 'input', 'ls-marker-enabled');
  mCheck.type = 'checkbox';
  mCheck.checked = item.marker.enabled !== false;
  mLabel.appendChild(mCheck);
  mLabel.appendChild(doc.createTextNode(' 有効'));
  marker.appendChild(mLabel);
  const colorRow = el(doc, 'div', 'ls-row');
  colorRow.appendChild(el(doc, 'span', 'ls-row-label', '色'));
  colorRow.appendChild(buildColorSelect(doc, item.marker.color));
  marker.appendChild(colorRow);
  card.appendChild(marker);

  const fetch = el(doc, 'section', 'ls-section ls-section-fetch');
  fetch.appendChild(el(doc, 'h3', 'ls-section-title', '自動取得（追加・編集画面）'));
  fetch.appendChild(el(doc, 'p', 'ls-section-note', 'レコードの追加・編集画面（PC / モバイル）を開いたとき、取得タイミングに応じてルックアップを自動で取得します。'));
  const fLabel = el(doc, 'label', 'ls-check');
  const fCheck = el(doc, 'input', 'ls-fetch-enabled');
  fCheck.type = 'checkbox';
  fCheck.checked = item.autoFetch.enabled === true;
  fLabel.appendChild(fCheck);
  fLabel.appendChild(doc.createTextNode(' 有効'));
  fetch.appendChild(fLabel);
  const modeRow = el(doc, 'div', 'ls-row');
  modeRow.appendChild(el(doc, 'span', 'ls-row-label', '取得タイミング'));
  const modeSelect = buildModeSelect(doc, item.autoFetch.mode);
  modeRow.appendChild(modeSelect);
  fetch.appendChild(modeRow);
  const warning = el(doc, 'div', 'ls-warning', C.ALWAYS_WARNING);
  const updateWarning = () => { warning.hidden = modeSelect.value !== 'always'; };
  modeSelect.addEventListener('change', updateWarning);
  updateWarning();
  fetch.appendChild(warning);
  card.appendChild(fetch);

  if (readOnly) Array.from(card.querySelectorAll('input, select')).forEach((n) => { n.disabled = true; });
  return card;
}

/** orphan カード（config にあるがフォームに無いルックアップ） */
function buildOrphanCard(doc, item, readOnly, onDelete) {
  const card = el(doc, 'div', 'ls-card ls-card-orphan');
  card.dataset.code = item.lookupFieldCode;
  card.appendChild(el(doc, 'div', 'ls-card-title', item.lookupFieldCode));
  card.appendChild(el(doc, 'div', 'ls-orphan-note', 'フォームに見つかりません'));
  const btn = el(doc, 'button', 'ls-orphan-delete kintoneplugin-button-normal', 'この設定を削除');
  btn.type = 'button';
  btn.disabled = Boolean(readOnly);
  btn.addEventListener('click', () => { onDelete(item.lookupFieldCode); card.remove(); });
  card.appendChild(btn);
  return card;
}

/** カードから編集内容を集める */
function collectEdits(root) {
  return Array.from(root.querySelectorAll('.ls-card:not(.ls-card-orphan)')).map((card) => ({
    lookupFieldCode: card.dataset.code,
    subtableCode: null,
    marker: { enabled: card.querySelector('.ls-marker-enabled').checked, color: card.querySelector('.ls-color').value },
    autoFetch: { enabled: card.querySelector('.ls-fetch-enabled').checked, mode: card.querySelector('.ls-mode').value }
  }));
}

/**
 * 設定画面を描画する。
 * @param {object} p
 * @param {Document} p.document
 * @param {{state, config, from?}} p.loaded   configSchema.loadConfig の戻り
 * @param {object|null} p.properties           kintone.app.getFormFields() の戻り（失敗時 null）
 * @param {(payload: {config: string, settings: string}, done: () => void) => void} p.setConfig
 * @param {string|number} p.appId
 * @param {string} p.pathname
 * @param {(url: string) => void} p.navigate
 */
function renderConfigUi({ document: doc, loaded, properties, setConfig, appId, pathname, navigate, now }) {
  const root = doc.querySelector('.ls-config');
  const notices = root.querySelector('#ls-notices');
  const cards = root.querySelector('#ls-cards');
  const subtableNotice = root.querySelector('#ls-subtable-notice');
  const upsell = root.querySelector('#ls-upsell');
  const saveBtn = root.querySelector('#ls-save');
  const cancelBtn = root.querySelector('#ls-cancel');
  [notices, cards, subtableNotice, upsell].forEach((n) => { while (n.firstChild) n.removeChild(n.firstChild); });

  /* unavailable = getConfig 自体が失敗（保存すると既存設定を消してしまうため read-only にする） */
  const readOnly = loaded.state === 'newer' || loaded.state === 'unavailable' || !properties;
  const config = loaded.state === 'newer' ? loaded.config : S.normalizeConfig(loaded.config);
  const deleted = [];

  if (loaded.state === 'unavailable') {
    notices.appendChild(notice(doc, 'error', '保存されている設定を取得できませんでした。ページを再読み込みしてください（この状態では保存できません）。'));
  }
  if (loaded.state === 'newer') {
    notices.appendChild(notice(doc, 'error', `新しいバージョンの設定（version ${loaded.config.version}）が保存されています。このバージョンのプラグインでは表示のみで、保存はできません。`));
  }
  if (loaded.state === 'invalid') {
    notices.appendChild(notice(doc, 'error', '保存されている設定を読み取れませんでした。このまま保存すると、設定は新しく作り直されます。'));
  }
  if (loaded.state === 'migrated' && loaded.from === 'lcm-v1') {
    notices.appendChild(notice(doc, 'info', '旧 Lookup Color Marker の設定を引き継ぎました。保存すると新しい形式で保存されます。'));
  }
  const migratedFromPlus = (config.meta && Array.isArray(config.meta.migratedFrom) ? config.meta.migratedFrom : []).includes('plus-v1');
  const hasAlways = (config.items || []).some((it) => it.autoFetch && it.autoFetch.enabled && it.autoFetch.mode === 'always');
  const showPlusNotice = migratedFromPlus && hasAlways && !(config.meta && config.meta.noticedPlusAlways);
  if (showPlusNotice) notices.appendChild(notice(doc, 'info', C.PLUS_MIGRATION_NOTICE));
  if (!properties) {
    notices.appendChild(notice(doc, 'error', 'フィールド情報を取得できませんでした。ページを再読み込みしてください。'));
  }

  const lookups = listLookups(properties);
  if (properties) {
    lookups.top.forEach((lookup) => {
      const item = S.findItem(config, lookup.code) || S.defaultItem(lookup.code);
      cards.appendChild(buildCard(doc, lookup, S.normalizeItem(item), readOnly));
    });
    const formCodes = new Set(lookups.top.map((l) => l.code));
    (config.items || []).filter((it) => it && it.lookupFieldCode && !it.subtableCode && !formCodes.has(it.lookupFieldCode)).forEach((it) => {
      cards.appendChild(buildOrphanCard(doc, it, readOnly, (code) => deleted.push(code)));
    });
    if (!lookups.top.length) cards.appendChild(el(doc, 'p', 'ls-empty', 'このアプリにはルックアップフィールドがありません。'));
    if (lookups.subtable.length) subtableNotice.appendChild(el(doc, 'p', 'ls-subtable-notice', P.SUBTABLE_NOTICE(lookups.subtable.length)));
  }

  upsell.appendChild(buildUpsell(doc));

  saveBtn.disabled = readOnly;
  saveBtn.onclick = () => {
    if (readOnly) return;
    let next = S.applyEdits(config, collectEdits(root));
    deleted.forEach((code) => { next = S.removeItem(next, code); });
    if (showPlusNotice) next.meta.noticedPlusAlways = true;
    const payload = S.serialize(next, { properties, edition: C.EDITION, now: now || new Date() });
    setConfig(payload, () => navigate(pluginListUrl(pathname, appId, true)));
  };
  cancelBtn.onclick = () => navigate(pluginListUrl(pathname, appId, false));

  return { config, readOnly, deleted, lookups };
}

module.exports = { renderConfigUi, collectEdits, getBasePath, pluginListUrl, buildColorSelect };
