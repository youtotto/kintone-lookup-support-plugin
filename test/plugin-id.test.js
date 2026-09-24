'use strict';

/** plugin ID の取得: kintone.$PLUGIN_ID は同期実行中にしか無い（実機条件）。await の後でも保存済み config を読めること */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadConfigScreen, loadDesktop, item, record, ROOT, PLUGIN_ID } = require('./helpers/env');
const { resolvePluginId } = require('../src/core/pluginId');
const C = require('../src/core/constants');

const BLUE = '#dfefff';
const PURPLE = '#ebe3fb';
function props() {
  return {
    案件名: { code: '案件名', label: '案件', type: 'SINGLE_LINE_TEXT', lookup: { relatedApp: { app: '1' }, relatedKeyField: 'a', fieldMappings: [{ field: '担当', relatedField: 'x' }] } },
    担当: { code: '担当', label: '担当', type: 'SINGLE_LINE_TEXT' },
    顧客名code: { code: '顧客名code', label: '顧客名', type: 'SINGLE_LINE_TEXT', lookup: { relatedApp: { app: '2' }, relatedKeyField: 'b', fieldMappings: [{ field: '会社', relatedField: 'y' }] } },
    会社: { code: '会社', label: '会社', type: 'SINGLE_LINE_TEXT' }
  };
}
const raw = () => ({ config: JSON.stringify({ version: 2, meta: { edition: 'free', savedAt: '', migratedFrom: [] }, items: [item('案件名', { marker: { color: BLUE } }), item('顧客名code', { marker: { color: PURPLE } })] }) });

test('ID-1 実機条件（$PLUGIN_ID は同期実行中のみ）: 設定画面は正しい ID で getConfig を呼び、保存済み config を復元する', async () => {
  const screen = await loadConfigScreen({ rawConfig: raw(), props: props(), pluginIdMode: 'sync-only' });
  assert.deepEqual(screen.getConfigCalls, [PLUGIN_ID], 'getConfig に渡された ID');
  assert.equal(screen.window.kintone.$PLUGIN_ID, undefined, '描画時点では $PLUGIN_ID は消えている');
  assert.deepEqual(screen.notices(), []);
  assert.deepEqual(screen.orphans(), []);
  assert.equal(screen.card('案件名').querySelector('.ls-color').value, BLUE);
  assert.equal(screen.card('顧客名code').querySelector('.ls-color').value, PURPLE, 'loadConfig=v2 / findItem=true → 紫');
  assert.equal(screen.logs.filter((l) => /設定を取得できませんでした|Usage/.test(l)).length, 0);
});

test('ID-2 $PLUGIN_ID が最初から undefined でも定数 ID で読める。desktop.js も同様', async () => {
  const screen = await loadConfigScreen({ rawConfig: raw(), props: props(), pluginIdMode: 'none' });
  assert.deepEqual(screen.getConfigCalls, [C.PLUGIN_ID]);
  assert.equal(C.PLUGIN_ID, 'gjichmnphbhhabpbijhcjgpmnopbgoem');
  assert.equal(screen.card('顧客名code').querySelector('.ls-color').value, PURPLE);
  const desk = loadDesktop({ rawConfig: raw(), props: props(), fieldElements: ['案件名', '担当', '顧客名code', '会社'], pluginIdMode: 'none' });
  assert.deepEqual(desk.getConfigCalls, [C.PLUGIN_ID]);
  await desk.fire('app.record.detail.show', record());
  assert.equal(desk.markerOf('顧客名code').dataset.lsColor, PURPLE);
  assert.equal(resolvePluginId(null), C.PLUGIN_ID);
  assert.equal(resolvePluginId({ $PLUGIN_ID: undefined }), C.PLUGIN_ID);
  assert.equal(resolvePluginId({ $PLUGIN_ID: '' }), C.PLUGIN_ID);
  assert.equal(resolvePluginId({ $PLUGIN_ID: 'abc' }), 'abc', '取れるときは実機の値を優先');
});

test('ID-3 保存→再読込: 紫のまま何も変えずに保存しても紫が維持。桃 / 緑 / 自動取得 OFF / mode も保持（実機条件で往復）', async () => {
  const first = await loadConfigScreen({ rawConfig: raw(), props: props() });
  const payload1 = await first.save();
  const second = await loadConfigScreen({ rawConfig: { ...payload1 }, props: props() });
  assert.equal(second.card('顧客名code').querySelector('.ls-color').value, PURPLE, '無変更保存後も紫');
  assert.equal(second.card('案件名').querySelector('.ls-color').value, BLUE);
  second.setMarker('案件名', true, '#ffe6ef');
  second.setFetch('案件名', false, 'always');
  second.setMarker('顧客名code', false, '#e1ffe1');
  second.setFetch('顧客名code', true, 'createOnly');
  const payload2 = await second.save();
  const third = await loadConfigScreen({ rawConfig: { ...payload2 }, props: props() });
  const a = third.card('案件名');
  const b = third.card('顧客名code');
  assert.equal(a.querySelector('.ls-color').value, '#ffe6ef');
  assert.equal(a.querySelector('.ls-fetch-enabled').checked, false);
  assert.equal(a.querySelector('.ls-mode').value, 'always');
  assert.equal(b.querySelector('.ls-color').value, '#e1ffe1');
  assert.equal(b.querySelector('.ls-marker-enabled').checked, false);
  assert.equal(b.querySelector('.ls-mode').value, 'createOnly');
});

test('ID-4 ID は constants で一元管理し、エントリは await より前に同期取得している。PPK 由来の ID と一致する', () => {
  const cfg = fs.readFileSync(path.join(ROOT, 'src/free/config.js'), 'utf8');
  const desk = fs.readFileSync(path.join(ROOT, 'src/free/desktop.js'), 'utf8');
  [cfg, desk].forEach((src) => {
    const idPos = src.indexOf('const PLUGIN_ID = resolvePluginId(');
    const awaitPos = src.indexOf('await kintone.'); /* コメント中の「await」ではなく最初の await 呼び出し */
    assert.ok(idPos > 0 && (awaitPos === -1 || idPos < awaitPos), 'resolvePluginId は最初の await 呼び出しより前');
    assert.doesNotMatch(src, /getConfig\(kintone\.\$PLUGIN_ID\)/, 'await 後に $PLUGIN_ID を直接読まない');
  });
  const all = ['src/core/configSchema.js', 'src/core/configUi.js', 'src/core/marker.js', 'src/core/autoFetch.js', 'src/core/lookupFields.js', 'src/core/pluginId.js', 'src/free/config.js', 'src/free/desktop.js'].map((p) => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  assert.equal((all.match(/gjichmnphbhhabpbijhcjgpmnopbgoem/g) || []).length, 0, '固定文字列は constants.js 以外に書かない');
  /* PPK があれば PUBKEY 由来の ID と一致することを確認（PPK は gitignore なので無い環境ではスキップ） */
  const ppk = path.join(ROOT, `${C.PLUGIN_ID}.ppk`);
  if (fs.existsSync(ppk)) {
    const crypto = require('node:crypto');
    const key = crypto.createPrivateKey(fs.readFileSync(ppk, 'utf8'));
    const pub = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
    const derived = crypto.createHash('sha256').update(pub).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));
    assert.equal(derived, C.PLUGIN_ID, 'PPK から導出した plugin ID と定数が一致');
  }
});

test('ID-5 getConfig 自体が失敗したときは empty 扱いにせず read-only（保存で既存設定を消さない）。desktop は何もしない', async () => {
  const { JSDOM, VirtualConsole } = require('jsdom');
  const fragment = fs.readFileSync(path.join(ROOT, 'source/config.html'), 'utf8');
  const dom = new JSDOM(`<!doctype html><html><body>${fragment}</body></html>`, { runScripts: 'outside-only', url: 'https://example.cybozu.com/k/admin/app/5/plugin/config', virtualConsole: new VirtualConsole() });
  const w = dom.window; const saved = []; const logs = [];
  w.console.warn = (...a) => logs.push(a.map(String).join(' '));
  w.kintone = { $PLUGIN_ID: PLUGIN_ID, plugin: { app: { getConfig: () => { throw new Error('GAIA_XX: unexpected'); }, setConfig: (p, cb) => { saved.push(p); cb(); } } }, app: { getId: () => 5, getFormFields: async () => props() } };
  w.eval(fs.readFileSync(path.join(ROOT, 'source/js/config.js'), 'utf8'));
  await new Promise((r) => setTimeout(r, 40));
  const notices = Array.from(w.document.querySelectorAll('.ls-notice')).map((n) => n.textContent);
  assert.ok(notices.some((n) => /設定を取得できませんでした/.test(n)));
  assert.equal(w.document.querySelector('#ls-save').disabled, true);
  w.document.querySelector('#ls-save').click();
  assert.equal(saved.length, 0, '保存しない');
  assert.ok(logs.some((l) => /設定を取得できませんでした/.test(l)));
  const dom2 = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', url: 'https://example.cybozu.com/k/5/show', virtualConsole: new VirtualConsole() });
  const w2 = dom2.window; const handlers = {};
  w2.console.warn = () => {};
  w2.kintone = { $PLUGIN_ID: PLUGIN_ID, events: { on: (t, fn) => [].concat(t).forEach((x) => { (handlers[x] = handlers[x] || []).push(fn); }) }, plugin: { app: { getConfig: () => { throw new Error('GAIA_XX'); } } }, app: { getId: () => 5, getFormFields: async () => props(), record: { getFieldElement: () => null } } };
  w2.eval(fs.readFileSync(path.join(ROOT, 'source/js/desktop.js'), 'utf8'));
  assert.deepEqual(Object.keys(handlers), [], 'desktop は設定が取れなければイベントを登録しない');
});
