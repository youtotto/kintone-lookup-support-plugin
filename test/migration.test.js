'use strict';

/** config v2 の読み込み・migration・保存変換（core を直接テスト） */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/core/configSchema');
const C = require('../src/core/constants');
const { properties, item } = require('./helpers/env');

test('M-1 旧 LCM settings → v2: enabled→marker.enabled、color→marker.color、自動取得は無効のまま', () => {
  const raw = { settings: JSON.stringify([
    { lookupFieldCode: '顧客名', enabled: true, color: '#fefadc', copyFieldCodes: ['会社名', '電話'] },
    { lookupFieldCode: '商品', enabled: false, color: '#E3F2FD', copyFieldCodes: ['単価'] }
  ]) };
  const loaded = S.loadConfig(raw);
  assert.equal(loaded.state, 'migrated');
  assert.equal(loaded.from, 'lcm-v1');
  assert.deepEqual(loaded.config.meta.migratedFrom, ['lcm-v1']);
  const [a, b] = loaded.config.items;
  assert.equal(a.lookupFieldCode, '顧客名');
  assert.deepEqual(a.marker, { enabled: true, color: '#fefadc', scope: ['detail'] }, '無料版 v1 の新規 scope は detail のみ');
  assert.deepEqual(a.autoFetch, { enabled: false, mode: 'whenCopyEmpty' }, '旧 LCM に自動取得は無いので有効化しない');
  assert.deepEqual(a.conditionalFetch, { enabled: false, condition: null });
  assert.deepEqual(a.diffCheck, { enabled: false });
  assert.equal(b.marker.enabled, false);
  assert.equal(b.marker.color, C.DEFAULT_COLOR, '選択肢に無い旧色 #E3F2FD は既定色へ正規化');
  assert.ok(!('copyFieldCodes' in a), 'copyFieldCodes は正規 config に持たない');
});

test('M-2 旧 Plus settings → v2: lookupEnabled→autoFetch.enabled、mode は always を維持、migratedFrom に plus-v1', () => {
  const raw = { settings: JSON.stringify([
    { lookupFieldCode: '顧客名', copyFieldCodes: ['会社名'], color: '#e1ffe1', enabled: true, lookupEnabled: true },
    { lookupFieldCode: '商品', copyFieldCodes: ['単価'], color: '#ffe6ef', enabled: true, lookupEnabled: false }
  ]) };
  const loaded = S.loadConfig(raw);
  assert.equal(loaded.state, 'migrated');
  assert.equal(loaded.from, 'plus-v1');
  assert.deepEqual(loaded.config.meta.migratedFrom, ['plus-v1']);
  assert.deepEqual(loaded.config.items[0].autoFetch, { enabled: true, mode: 'always' });
  assert.deepEqual(loaded.config.items[1].autoFetch, { enabled: false, mode: 'always' });
  assert.equal(loaded.config.items[0].marker.color, '#e1ffe1');
});

test('M-3 v2 はそのまま読める（未知ノード・未知プロパティを保持）', () => {
  const raw = { config: JSON.stringify({ version: 2, meta: { edition: 'plus', savedAt: '2026-01-01T00:00:00.000Z', migratedFrom: ['plus-v1'], extraMeta: 1 }, items: [
    { ...item('顧客名'), conditionalFetch: { enabled: true, condition: { field: 'ステータス', type: 'STATUS', operator: 'in', values: ['受注'] } }, diffCheck: { enabled: true }, futureNode: { x: 1 }, marker: { enabled: true, color: '#ebe3fb', scope: ['detail'], futureProp: 'keep' } }
  ] }) };
  const loaded = S.loadConfig(raw);
  assert.equal(loaded.state, 'v2');
  const it = loaded.config.items[0];
  assert.deepEqual(it.conditionalFetch, { enabled: true, condition: { field: 'ステータス', type: 'STATUS', operator: 'in', values: ['受注'] } });
  assert.deepEqual(it.diffCheck, { enabled: true });
  assert.deepEqual(it.futureNode, { x: 1 });
  assert.equal(it.marker.futureProp, 'keep');
  assert.deepEqual(it.marker.scope, ['detail']);
  assert.equal(loaded.config.meta.extraMeta, 1);
  assert.equal(loaded.config.meta.edition, 'plus');
});

test('M-4 壊れた JSON / 不正な形は invalid で空 config（例外にしない）', () => {
  assert.equal(S.loadConfig({ config: '{not json' }).state, 'invalid');
  assert.equal(S.loadConfig({ config: '"string"' }).state, 'invalid');
  assert.equal(S.loadConfig({ config: JSON.stringify({ items: [] }) }).state, 'invalid', 'version なし');
  assert.equal(S.loadConfig({ settings: '[broken' }).state, 'invalid');
  assert.equal(S.loadConfig({ settings: JSON.stringify({ not: 'array' }) }).state, 'invalid');
  assert.deepEqual(S.loadConfig({ config: '{not json' }).config.items, []);
  assert.equal(S.loadConfig({}).state, 'empty');
  assert.equal(S.loadConfig(null).state, 'empty');
  assert.equal(S.loadConfig({ config: '', settings: '' }).state, 'empty');
});

test('M-5 version > 2 は newer（そのまま返す。書き換えない）', () => {
  const v3 = { version: 3, meta: { edition: 'plus' }, items: [{ lookupFieldCode: '顧客名', marker: { enabled: true, color: '#dfefff' }, autoFetch: { enabled: true, mode: 'onChange' } }] };
  const loaded = S.loadConfig({ config: JSON.stringify(v3) });
  assert.equal(loaded.state, 'newer');
  assert.deepEqual(loaded.config, v3);
});

test('M-6 config があれば settings は無視する（新形式を優先）', () => {
  const raw = { config: JSON.stringify({ version: 2, meta: {}, items: [item('顧客名', { autoFetch: { enabled: false } })] }), settings: JSON.stringify([{ lookupFieldCode: '顧客名', enabled: true, color: '#fefadc', lookupEnabled: true }]) };
  const loaded = S.loadConfig(raw);
  assert.equal(loaded.state, 'v2');
  assert.equal(loaded.config.items[0].autoFetch.enabled, false);
});

test('M-7 applyEdits: 編集した marker / autoFetch だけをマージし、＋専用ノード・未知ノードは保持。orphan も保持', () => {
  const config = { version: 2, meta: { edition: 'plus', migratedFrom: [] }, items: [
    { ...item('顧客名'), conditionalFetch: { enabled: true, condition: { field: 'x' } }, diffCheck: { enabled: true }, futureNode: 7, marker: { enabled: true, color: '#dfefff', scope: ['detail'], extra: 'e' }, autoFetch: { enabled: true, mode: 'always', extra: 'f' } },
    item('消えたLookup', { conditionalFetch: { enabled: true, condition: null } }),
    { lookupFieldCode: '品番', subtableCode: '明細', marker: { enabled: true, color: '#dfefff' }, autoFetch: { enabled: true, mode: 'always' }, conditionalFetch: { enabled: true, condition: null } }
  ] };
  const next = S.applyEdits(config, [
    { lookupFieldCode: '顧客名', marker: { enabled: false, color: '#ffe4d1' }, autoFetch: { enabled: true, mode: 'whenCopyEmpty' } },
    { lookupFieldCode: '商品', marker: { enabled: true, color: '#e1ffe1' }, autoFetch: { enabled: false, mode: 'createOnly' } }
  ]);
  const a = next.items.find((i) => i.lookupFieldCode === '顧客名');
  assert.deepEqual(a.marker, { enabled: false, color: '#ffe4d1', scope: ['detail'], extra: 'e' });
  assert.deepEqual(a.autoFetch, { enabled: true, mode: 'whenCopyEmpty', extra: 'f' });
  assert.deepEqual(a.conditionalFetch, { enabled: true, condition: { field: 'x' } });
  assert.deepEqual(a.diffCheck, { enabled: true });
  assert.equal(a.futureNode, 7);
  const orphan = next.items.find((i) => i.lookupFieldCode === '消えたLookup');
  assert.ok(orphan, 'orphan は残る');
  assert.deepEqual(orphan.conditionalFetch, { enabled: true, condition: null });
  const sub = next.items.find((i) => i.subtableCode === '明細');
  assert.ok(sub && sub.conditionalFetch.enabled, 'サブテーブル item（＋の設定）も残る');
  const added = next.items.find((i) => i.lookupFieldCode === '商品');
  assert.deepEqual(added.autoFetch, { enabled: false, mode: 'createOnly' });
  assert.deepEqual(added.conditionalFetch, { enabled: false, condition: null });
  assert.equal(config.items[0].marker.enabled, true, '元の config は変更しない');
});

test('M-8 removeItem は指定した item だけを消す', () => {
  const config = { version: 2, meta: {}, items: [item('顧客名'), item('消えたLookup')] };
  const next = S.removeItem(config, '消えたLookup');
  assert.deepEqual(next.items.map((i) => i.lookupFieldCode), ['顧客名']);
});

test('M-9 serialize: config（v2, meta 更新）と settings（互換投影、copyFieldCodes はフォーム定義から導出）', () => {
  const config = { version: 2, meta: { edition: 'plus', migratedFrom: ['plus-v1'] }, items: [
    item('顧客名', { autoFetch: { enabled: true, mode: 'always' }, conditionalFetch: { enabled: true, condition: null } }),
    item('商品', { marker: { enabled: false, color: '#fefadc' }, autoFetch: { enabled: true, mode: 'whenCopyEmpty' } }),
    { lookupFieldCode: '品番', subtableCode: '明細', marker: { enabled: true, color: '#dfefff' }, autoFetch: { enabled: true, mode: 'always' } }
  ] };
  const out = S.serialize(config, { properties: properties(), edition: 'free', now: new Date('2026-09-24T00:00:00Z') });
  const saved = JSON.parse(out.config);
  assert.equal(saved.version, 2);
  assert.equal(saved.meta.edition, 'free');
  assert.equal(saved.meta.savedAt, '2026-09-24T00:00:00.000Z');
  assert.deepEqual(saved.meta.migratedFrom, ['plus-v1']);
  assert.equal(saved.items[0].conditionalFetch.enabled, true, '＋専用ノードは保存後も残る');
  assert.ok(!saved.items.some((i) => 'copyFieldCodes' in i));
  const legacy = JSON.parse(out.settings);
  assert.deepEqual(legacy, [
    { lookupFieldCode: '顧客名', enabled: true, color: '#dfefff', copyFieldCodes: ['会社名', '電話'], lookupEnabled: true },
    { lookupFieldCode: '商品', enabled: false, color: '#fefadc', copyFieldCodes: ['単価'], lookupEnabled: false }
  ], 'サブテーブル item は投影しない。lookupEnabled は always のときだけ true');
  const legacyNoProps = JSON.parse(S.serialize(config, { properties: null }).settings);
  assert.deepEqual(legacyNoProps[0].copyFieldCodes, []);
});

test('M-10 normalize: 不正な色・モード・scope は既定値、既知フラグは boolean 化、未知キーは保持', () => {
  const n = S.normalizeItem({ lookupFieldCode: 'a', marker: { enabled: 1, color: 'red', scope: 'x' }, autoFetch: { enabled: 'yes', mode: 'sometimes' }, keep: true });
  assert.deepEqual(n.marker, { enabled: true, color: C.DEFAULT_COLOR, scope: ['detail'] });
  assert.deepEqual(S.normalizeItem({ lookupFieldCode: 'b', marker: { scope: ['detail', 'create', 'edit', 'unknown'] } }).marker.scope, ['detail', 'create', 'edit'], '旧 config の create / edit は保持（無料版では無視）、未知は除外');
  assert.deepEqual(n.autoFetch, { enabled: false, mode: 'whenCopyEmpty' }, 'enabled は true 以外を false に');
  assert.equal(n.keep, true);
  assert.equal(S.normalizeColor('#DFEFFF'), '#dfefff');
});
