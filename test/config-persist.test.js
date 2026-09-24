'use strict';

/** 設定の保存 → 再読込の回帰テスト（実機と同じ流れ: 初期 config なし → 変更 → save → payload を次回 getConfig に渡す → 復元） */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfigScreen, v2Config, item } = require('./helpers/env');

async function roundTrip(rawConfig, edit) {
  const first = await loadConfigScreen({ rawConfig });
  edit(first);
  const payload = await first.save();
  assert.ok(payload && typeof payload.config === 'string' && typeof payload.settings === 'string', 'setConfig には config / settings の文字列が渡る');
  assert.doesNotThrow(() => JSON.parse(payload.config), 'config は正しい JSON 文字列');
  const second = await loadConfigScreen({ rawConfig: { ...payload } });
  return { first, payload, second };
}

test('P-1 初期 config なし → 色 / marker OFF / 自動取得 OFF / モード変更 → 保存 → 再表示で復元される（複数 Lookup）', async () => {
  const { payload, second } = await roundTrip({}, (s) => {
    s.setMarker('顧客名', false, '#ffe6ef');
    s.setFetch('顧客名', false, 'always');
    s.setMarker('商品', true, '#e1ffe1');
    s.setFetch('商品', true, 'createOnly');
  });
  const saved = JSON.parse(payload.config);
  assert.equal(saved.version, 2);
  assert.deepEqual(saved.items.map((i) => i.lookupFieldCode), ['顧客名', '商品']);
  assert.deepEqual(saved.items[0].marker, { enabled: false, color: '#ffe6ef', scope: ['detail'] });
  assert.deepEqual(saved.items[0].autoFetch, { enabled: false, mode: 'always' });
  assert.deepEqual(saved.items[1].marker, { enabled: true, color: '#e1ffe1', scope: ['detail'] });
  assert.deepEqual(saved.items[1].autoFetch, { enabled: true, mode: 'createOnly' });
  assert.deepEqual(second.notices(), [], '再表示で案内は出ない（invalid / migrated 扱いにならない）');
  const a = second.card('顧客名');
  assert.equal(a.querySelector('.ls-marker-enabled').checked, false);
  assert.equal(a.querySelector('.ls-color').value, '#ffe6ef');
  assert.equal(a.querySelector('.ls-fetch-enabled').checked, false);
  assert.equal(a.querySelector('.ls-mode').value, 'always');
  const b = second.card('商品');
  assert.equal(b.querySelector('.ls-marker-enabled').checked, true);
  assert.equal(b.querySelector('.ls-color').value, '#e1ffe1');
  assert.equal(b.querySelector('.ls-fetch-enabled').checked, true);
  assert.equal(b.querySelector('.ls-mode').value, 'createOnly');
});

test('P-2 whenCopyEmpty / always / createOnly のそれぞれが往復で保持される。2 回目の保存でも落ちない', async () => {
  for (const mode of ['whenCopyEmpty', 'always', 'createOnly']) {
    const { second } = await roundTrip({}, (s) => s.setFetch('顧客名', true, mode));
    assert.equal(second.card('顧客名').querySelector('.ls-mode').value, mode, mode);
    /* 2 回目: 何も変えずに保存 → さらに再表示 */
    const payload2 = await second.save();
    const third = await loadConfigScreen({ rawConfig: { ...payload2 } });
    assert.equal(third.card('顧客名').querySelector('.ls-mode').value, mode, `${mode} 2 回目`);
  }
});

test('P-3 Plus 専用ノード・orphan・未知ノードは往復後も残り、config が settings より優先される', async () => {
  const raw = v2Config([
    { ...item('顧客名'), conditionalFetch: { enabled: true, condition: { field: 'ステータス', values: ['受注'] } }, diffCheck: { enabled: true }, futureNode: 1 },
    item('消えたLookup', { autoFetch: { mode: 'always' } })
  ], { edition: 'plus' });
  raw.settings = JSON.stringify([{ lookupFieldCode: '顧客名', enabled: true, color: '#fefadc', copyFieldCodes: ['会社名'], lookupEnabled: true }]);
  const { payload, second } = await roundTrip(raw, (s) => s.setMarker('顧客名', true, '#ebe3fb'));
  const saved = JSON.parse(payload.config);
  const a = saved.items.find((i) => i.lookupFieldCode === '顧客名');
  assert.equal(a.marker.color, '#ebe3fb');
  assert.deepEqual(a.conditionalFetch, { enabled: true, condition: { field: 'ステータス', values: ['受注'] } });
  assert.deepEqual(a.diffCheck, { enabled: true });
  assert.equal(a.futureNode, 1);
  assert.ok(saved.items.some((i) => i.lookupFieldCode === '消えたLookup'), 'orphan 保持');
  assert.equal(second.card('顧客名').querySelector('.ls-color').value, '#ebe3fb', 'config（紫）が settings（黄）より優先');
  assert.deepEqual(second.orphans(), ['消えたLookup']);
  const legacy = JSON.parse(payload.settings);
  assert.deepEqual(legacy.map((s) => s.lookupFieldCode), ['顧客名', '消えたLookup', '商品'], 'フォーム上の Lookup（商品）は既定値で保存されるので投影にも含まれる');
  assert.deepEqual(legacy[0].copyFieldCodes, ['会社名', '電話'], '互換投影の copyFieldCodes はフォームから導出');
});

test('P-4 旧 settings（LCM / Plus）から開いて保存 → 再表示は config 優先で新形式。旧 settings の値は使われない', async () => {
  const { payload, second } = await roundTrip({ settings: JSON.stringify([{ lookupFieldCode: '顧客名', enabled: true, color: '#fefadc', copyFieldCodes: ['会社名'], lookupEnabled: true }]) }, (s) => {
    s.setMarker('顧客名', true, '#dfefff');
    s.setFetch('顧客名', true, 'whenCopyEmpty');
  });
  assert.equal(JSON.parse(payload.config).meta.migratedFrom[0], 'plus-v1');
  assert.equal(second.card('顧客名').querySelector('.ls-color').value, '#dfefff');
  assert.equal(second.card('顧客名').querySelector('.ls-mode').value, 'whenCopyEmpty');
  assert.equal(JSON.parse(payload.settings)[0].color, '#dfefff', '互換投影も新しい値');
});

test('P-5 getConfig が空文字の config / 余計なキーを返しても保存値の復元に影響しない。setConfig の callback 後にだけ遷移する', async () => {
  const first = await loadConfigScreen({ rawConfig: {} });
  first.setMarker('顧客名', true, '#ffe4d1');
  const payload = await first.save();
  const withNoise = { ...payload, legacyKey: 'x', settingsOld: '' };
  const second = await loadConfigScreen({ rawConfig: withNoise });
  assert.equal(second.card('顧客名').querySelector('.ls-color').value, '#ffe4d1');
  /* callback が呼ばれるまで遷移しない */
  const { JSDOM, VirtualConsole } = require('jsdom');
  const fs = require('node:fs');
  const path = require('node:path');
  const { renderConfigUi } = require('../src/core/configUi');
  const { loadConfig } = require('../src/core/configSchema');
  const { properties } = require('./helpers/env');
  const fragment = fs.readFileSync(path.join(__dirname, '../source/config.html'), 'utf8');
  const dom = new JSDOM(`<!doctype html><html><body>${fragment}</body></html>`, { runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  const navigated = [];
  let pendingCb = null;
  renderConfigUi({ document: dom.window.document, loaded: loadConfig({}), properties: properties(), setConfig: (p, cb) => { pendingCb = cb; }, appId: 5, pathname: '/k/admin/app/5/plugin/config', navigate: (u) => navigated.push(u) });
  dom.window.document.querySelector('#ls-save').click();
  assert.equal(navigated.length, 0, 'setConfig 完了前は遷移しない');
  pendingCb();
  assert.equal(navigated.length, 1);
});
