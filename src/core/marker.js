'use strict';

/**
 * カラーマーカー（レコード詳細画面専用・PC のみ）。
 * ルックアップフィールドとそのコピー先フィールドに同じ色（薄い背景 + 左の色帯）を付ける。
 * kintone.app.record.getFieldElement() は詳細画面・印刷画面でしか使えないため、追加・編集画面とモバイルは対象外。
 * CSS クラスと data 属性で付け、表示のたびに前回分を外してから付け直す（重複適用しない）。padding などレイアウトは変更しない。
 */
const C = require('./constants');
const { copyTargetsOf } = require('./lookupFields');

const STYLE_ID = 'ls-marker-style';
const CLASS = 'ls-marker';
const CSS = `.${CLASS} { border-left: 4px solid var(--ls-band) !important; border-radius: 2px; background-color: var(--ls-color) !important; }`;

function bandOf(color) {
  const p = C.PALETTE.find((x) => x.value === color);
  return p ? p.band : C.PALETTE[0].band;
}

function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (doc.head || doc.body).appendChild(style);
}

function clearMarkers(doc) {
  Array.from(doc.querySelectorAll(`.${CLASS}`)).forEach((el) => {
    el.classList.remove(CLASS);
    el.removeAttribute('data-ls-color');
    el.style.removeProperty('--ls-color');
    el.style.removeProperty('--ls-band');
  });
}

/**
 * 詳細画面にマーカーを適用する。
 * @param {{ document: Document, config: object, properties: object|null, getFieldElement: (code: string) => Element|null }} p
 * @returns {string[]} マーカーを付けたフィールドコード
 */
function applyMarkers({ document: doc, config, properties, getFieldElement }) {
  const applied = [];
  if (!doc || !config || !Array.isArray(config.items)) return applied;
  clearMarkers(doc);
  ensureStyle(doc);
  config.items.forEach((item) => {
    const marker = item && item.marker;
    if (!marker || marker.enabled === false || item.subtableCode) return;
    if (Array.isArray(marker.scope) && !marker.scope.includes('detail')) return;
    const codes = [item.lookupFieldCode, ...copyTargetsOf(properties, item.lookupFieldCode)].filter((c, i, arr) => c && arr.indexOf(c) === i);
    codes.forEach((code) => {
      let el = null;
      try { el = getFieldElement(code); } catch (_e) { el = null; }
      if (!el || applied.includes(code)) return;
      el.classList.add(CLASS);
      el.setAttribute('data-ls-color', marker.color);
      el.style.setProperty('--ls-color', marker.color);
      el.style.setProperty('--ls-band', bandOf(marker.color));
      applied.push(code);
    });
  });
  return applied;
}

module.exports = { applyMarkers, clearMarkers, ensureStyle, STYLE_ID, CLASS };
