'use strict';

/** jsdom 上でビルド済み desktop.js / config.js を動かすためのヘルパー */
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '../..');
const DESKTOP_JS = path.join(ROOT, 'source/js/desktop.js');
const CONFIG_JS = path.join(ROOT, 'source/js/config.js');
const CONFIG_HTML = path.join(ROOT, 'source/config.html');
const PLUGIN_ID = 'gjichmnphbhhabpbijhcjgpmnopbgoem';
const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

/** フォーム定義（properties）: 顧客名ルックアップ（コピー先: 会社名, 電話）、商品ルックアップ（コピー先: 単価）、テーブル内ルックアップ */
function properties() {
  return {
    顧客名: { code: '顧客名', label: '顧客', type: 'SINGLE_LINE_TEXT', lookup: { relatedApp: { app: '10' }, relatedKeyField: '顧客名', fieldMappings: [{ field: '会社名', relatedField: '会社名' }, { field: '電話', relatedField: '電話' }] } },
    会社名: { code: '会社名', label: '会社名', type: 'SINGLE_LINE_TEXT' },
    電話: { code: '電話', label: '電話', type: 'SINGLE_LINE_TEXT' },
    商品: { code: '商品', label: '商品', type: 'SINGLE_LINE_TEXT', lookup: { relatedApp: { app: '11' }, relatedKeyField: '商品名', fieldMappings: [{ field: '単価', relatedField: '単価' }] } },
    単価: { code: '単価', label: '単価', type: 'NUMBER' },
    メモ: { code: 'メモ', label: 'メモ', type: 'MULTI_LINE_TEXT' },
    明細: { code: '明細', label: '明細', type: 'SUBTABLE', fields: { 品番: { code: '品番', label: '品番', type: 'SINGLE_LINE_TEXT', lookup: { relatedApp: { app: '11' }, relatedKeyField: '品番', fieldMappings: [{ field: '品名', relatedField: '品名' }] } }, 品名: { code: '品名', label: '品名', type: 'SINGLE_LINE_TEXT' } } }
  };
}

function record(values = {}) {
  const base = { 顧客名: '', 会社名: '', 電話: '', 商品: '', 単価: '', メモ: '' };
  const rec = {};
  Object.entries({ ...base, ...values }).forEach(([code, value]) => { rec[code] = { type: 'SINGLE_LINE_TEXT', value }; });
  return rec;
}

function v2Config(items, meta = {}) {
  return { config: JSON.stringify({ version: 2, meta: { edition: 'free', savedAt: '', migratedFrom: [], ...meta }, items }) };
}

function item(code, over = {}) {
  return {
    lookupFieldCode: code, subtableCode: null,
    marker: { enabled: true, color: '#dfefff', scope: ['detail'], ...(over.marker || {}) },
    autoFetch: { enabled: true, mode: 'whenCopyEmpty', ...(over.autoFetch || {}) },
    conditionalFetch: over.conditionalFetch || { enabled: false, condition: null },
    diffCheck: over.diffCheck || { enabled: false },
    ...(over.extra || {})
  };
}

function makeDom(html, url) {
  const virtualConsole = new VirtualConsole(); /* jsdom の navigation 未実装エラー等を捨てる */
  return new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url, virtualConsole });
}

/**
 * レコード画面。fieldElements に列挙したコードだけ getFieldElement が要素を返す。
 */
/**
 * kintone.$PLUGIN_ID の振る舞いを模す。
 *   'sync-only'（既定）: kintone 実機と同じく、プラグイン JS の同期実行中だけ定義され、その後は undefined
 *   'none'            : 最初から undefined（フォールバック定数で動くことの確認用）
 *   'static'          : ずっと定義されている
 * getConfig は実機どおり、ID が falsy なら "Usage: kintone.plugin.app.getConfig(pluginId)" を投げる。
 */
function pluginIdBefore(mode) { return mode === 'none' ? undefined : PLUGIN_ID; }
function pluginIdAfter(window, mode) { if (mode === 'sync-only' || mode === 'none') window.kintone.$PLUGIN_ID = undefined; }
function getConfigMock(rawConfig, calls) {
  return (id) => {
    calls.push(id);
    if (!id) throw new Error('Usage: kintone.plugin.app.getConfig(pluginId)');
    return id === PLUGIN_ID ? JSON.parse(JSON.stringify(rawConfig)) : null;
  };
}

function loadDesktop({ rawConfig = {}, props = properties(), fieldElements = ['顧客名', '会社名', '電話', '商品', '単価', 'メモ'], guestSpaceId = null, getFormFieldsError = null, pluginIdMode = 'sync-only' } = {}) {
  const base = guestSpaceId ? `/k/guest/${guestSpaceId}` : '/k';
  const dom = makeDom('<!doctype html><html><head></head><body><div id="form"></div></body></html>', `https://example.cybozu.com${base}/5/show#record=1`);
  const { window } = dom;
  const doc = window.document;
  const logs = [];
  window.console.warn = (...a) => logs.push(a.map(String).join(' '));
  window.console.error = (...a) => logs.push(a.map(String).join(' '));
  const form = doc.getElementById('form');
  fieldElements.forEach((code) => {
    const node = doc.createElement('div');
    node.className = 'mock-field';
    node.dataset.code = code;
    form.appendChild(node);
  });
  const handlers = {};
  let formFieldCalls = 0;
  const getConfigCalls = [];
  window.kintone = {
    $PLUGIN_ID: pluginIdBefore(pluginIdMode),
    events: { on: (types, handler) => { [].concat(types).forEach((t) => { (handlers[t] = handlers[t] || []).push(handler); }); } },
    plugin: { app: { getConfig: getConfigMock(rawConfig, getConfigCalls) } },
    app: {
      getId: () => 5,
      getFormFields: async () => { formFieldCalls += 1; if (getFormFieldsError) throw getFormFieldsError; return JSON.parse(JSON.stringify(props)); },
      record: { getFieldElement: (code) => doc.querySelector(`.mock-field[data-code="${code}"]`) }
    }
  };
  const before = new Set(Object.keys(window));
  window.eval(fs.readFileSync(DESKTOP_JS, 'utf8'));
  pluginIdAfter(window, pluginIdMode);
  const addedGlobals = Object.keys(window).filter((k) => !before.has(k));
  return {
    window, document: doc, logs, handlers, addedGlobals, getConfigCalls,
    formFieldCalls: () => formFieldCalls,
    registeredTypes: () => Object.keys(handlers),
    async fire(type, rec = record()) {
      const event = { type, record: JSON.parse(JSON.stringify(rec)) };
      const results = await Promise.all((handlers[type] || []).map((h) => h(event)));
      await wait(10);
      return { event, results };
    },
    marked: () => Array.from(doc.querySelectorAll('.ls-marker')).map((e) => e.dataset.code),
    markerOf: (code) => doc.querySelector(`.mock-field[data-code="${code}"]`),
    styleCount: () => doc.querySelectorAll('#ls-marker-style').length,
    wait
  };
}

/**
 * 設定画面。config.html の断片を body に入れ、ビルド済み config.js を実行する。
 */
async function loadConfigScreen({ rawConfig = {}, props = properties(), guestSpaceId = null, getFormFieldsError = null, pluginIdMode = 'sync-only' } = {}) {
  const base = guestSpaceId ? `/k/guest/${guestSpaceId}` : '/k';
  const fragment = fs.readFileSync(CONFIG_HTML, 'utf8');
  const dom = makeDom(`<!doctype html><html><head></head><body>${fragment}</body></html>`, `https://example.cybozu.com${base}/admin/app/5/plugin/config?pluginId=${PLUGIN_ID}`);
  const { window } = dom;
  const doc = window.document;
  const logs = [];
  window.console.warn = (...a) => logs.push(a.map(String).join(' '));
  window.console.error = (...a) => logs.push(a.map(String).join(' '));
  const saved = [];
  const getConfigCalls = [];
  window.kintone = {
    $PLUGIN_ID: pluginIdBefore(pluginIdMode),
    plugin: { app: { getConfig: getConfigMock(rawConfig, getConfigCalls), setConfig: (payload, cb) => { saved.push(payload); if (cb) cb(); } } },
    app: { getId: () => 5, getFormFields: async () => { if (getFormFieldsError) throw getFormFieldsError; return JSON.parse(JSON.stringify(props)); } }
  };
  const before = new Set(Object.keys(window));
  window.eval(fs.readFileSync(CONFIG_JS, 'utf8'));
  pluginIdAfter(window, pluginIdMode); /* 実機どおり、同期実行が終わったら $PLUGIN_ID は消える（getFormFields の await 中に消えた状態になる） */
  await wait(30);
  const addedGlobals = Object.keys(window).filter((k) => !before.has(k));
  const $ = (sel) => doc.querySelector(sel);
  const card = (code) => doc.querySelector(`.ls-card[data-code="${code}"]`);
  return {
    window, document: doc, logs, saved, addedGlobals, getConfigCalls,
    cards: () => Array.from(doc.querySelectorAll('.ls-card:not(.ls-card-orphan)')).map((c) => c.dataset.code),
    orphans: () => Array.from(doc.querySelectorAll('.ls-card-orphan')).map((c) => c.dataset.code),
    notices: () => Array.from(doc.querySelectorAll('.ls-notice')).map((n) => n.textContent),
    card,
    setMarker: (code, enabled, color) => { const c = card(code); c.querySelector('.ls-marker-enabled').checked = enabled; if (color) c.querySelector('.ls-color').value = color; },
    setFetch: (code, enabled, mode) => { const c = card(code); c.querySelector('.ls-fetch-enabled').checked = enabled; if (mode) { const s = c.querySelector('.ls-mode'); s.value = mode; s.dispatchEvent(new window.Event('change')); } },
    warningVisible: (code) => !card(code).querySelector('.ls-warning').hidden,
    subtableNotice: () => ($('#ls-subtable-notice') ? $('#ls-subtable-notice').textContent : ''),
    upsell: () => $('#ls-upsell'),
    saveButton: () => $('#ls-save'),
    async save() { $('#ls-save').click(); await wait(10); return saved[saved.length - 1]; },
    savedConfig: () => JSON.parse(saved[saved.length - 1].config),
    savedSettings: () => JSON.parse(saved[saved.length - 1].settings),
    wait
  };
}

module.exports = { loadDesktop, loadConfigScreen, properties, record, v2Config, item, wait, PLUGIN_ID, ROOT };
