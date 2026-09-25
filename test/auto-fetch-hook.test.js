'use strict';

/** autoFetch の拡張点（predicate）: 未指定なら v1.2.0 と同じ判定、指定時は「取得する」となった item にだけ追加判定を掛ける */
const test = require('node:test');
const assert = require('node:assert/strict');
const { decideFetch, decideBase, applyAutoFetch } = require('../src/core/autoFetch');
const { properties, record, item } = require('./helpers/env');

const props = properties();
const cfg = (mode, over = {}) => ({ ...item('顧客名', { autoFetch: { enabled: true, mode } }), ...over });
const MODES = ['whenCopyEmpty', 'always', 'createOnly'];
const okRecord = record({ 顧客名: 'A社' }); /* キーあり・コピー先空 = 3 モードとも create で取得 */

test('H-1 predicate 未指定: decideFetch は decideBase と完全に同じ結果（全モード × create/edit × 代表レコード）', () => {
  const records = [okRecord, record({ 顧客名: 'A社', 会社名: 'A' }), record({ 顧客名: '' }), record()];
  MODES.forEach((mode) => ['create', 'edit'].forEach((screen) => records.forEach((rec) => {
    [props, null].forEach((p) => {
      assert.deepEqual(decideFetch({ item: cfg(mode), record: rec, properties: p, screen }), decideBase({ item: cfg(mode), record: rec, properties: p, screen }), `${mode}/${screen}`);
    });
  })));
  assert.deepEqual(decideFetch({ item: cfg('always'), record: okRecord, properties: props, screen: 'create', predicate: undefined }), { fetch: true, reason: 'always' });
  assert.deepEqual(decideFetch({ item: cfg('always'), record: okRecord, properties: props, screen: 'create', predicate: null }), { fetch: true, reason: 'always' }, '関数以外は無視');
});

test('H-2 predicate が true: 従来判定どおり（reason も従来のまま）。全モードで機能', () => {
  const calls = [];
  const predicate = (ctx) => { calls.push(ctx); return true; };
  MODES.forEach((mode) => {
    const d = decideFetch({ item: cfg(mode), record: okRecord, properties: props, screen: 'create', predicate });
    assert.equal(d.fetch, true, mode);
    assert.equal(d.reason, { whenCopyEmpty: 'copy-empty', always: 'always', createOnly: 'createOnly' }[mode]);
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(Object.keys(calls[0]).sort(), ['item', 'properties', 'record', 'screen'], 'predicate に渡す情報');
  assert.equal(calls[0].screen, 'create');
});

test('H-3 predicate が false: 取得しない（reason predicate-false）。全モード・create/edit・mobile 相当の screen で機能', () => {
  MODES.forEach((mode) => ['create', 'edit'].forEach((screen) => {
    const rec = record({ 顧客名: 'A社' });
    const d = decideFetch({ item: cfg(mode), record: rec, properties: props, screen, predicate: () => false });
    if (mode === 'createOnly' && screen === 'edit') {
      assert.deepEqual(d, { fetch: false, reason: 'not-create' }, '基本判定で取得しないときは predicate を呼ばない');
    } else {
      assert.deepEqual(d, { fetch: false, reason: 'predicate-false' }, `${mode}/${screen}`);
    }
    assert.equal(rec.顧客名.lookup, undefined);
  }));
  ['', 0, null, undefined].forEach((v) => assert.equal(decideFetch({ item: cfg('always'), record: okRecord, properties: props, screen: 'create', predicate: () => v }).reason, 'predicate-false', String(v)));
});

test('H-4 predicate が例外: 取得しない（reason predicate-error、error を添える）。例外は外へ出ない', () => {
  MODES.forEach((mode) => {
    const d = decideFetch({ item: cfg(mode), record: okRecord, properties: props, screen: 'create', predicate: () => { throw new Error('boom'); } });
    assert.equal(d.fetch, false, mode);
    assert.equal(d.reason, 'predicate-error');
    assert.equal(d.error.message, 'boom');
  });
});

test('H-5 基本判定で取得しない item では predicate を呼ばない（無効・キー空・コピー先入力済み・フィールド欠落・サブテーブル）', () => {
  let called = 0;
  const predicate = () => { called += 1; return true; };
  const cases = [
    [cfg('always', { autoFetch: { enabled: false, mode: 'always' } }), okRecord, 'disabled'],
    [cfg('always'), record({ 顧客名: '' }), 'empty-key'],
    [cfg('whenCopyEmpty'), record({ 顧客名: 'A社', 会社名: 'A' }), 'copy-filled'],
    [cfg('always', { lookupFieldCode: '無い' }), okRecord, 'missing-field'],
    [cfg('always', { subtableCode: '明細' }), okRecord, 'subtable'],
    [cfg('createOnly'), okRecord, 'not-create']
  ];
  cases.forEach(([it, rec, reason]) => {
    assert.equal(decideFetch({ item: it, record: rec, properties: props, screen: reason === 'not-create' ? 'edit' : 'create', predicate }).reason, reason);
  });
  assert.equal(called, 0);
});

test('H-6 applyAutoFetch: predicate は item ごとに評価され、false / 例外の item だけ lookup が付かない', () => {
  const config = { items: [cfg('always'), { ...item('商品', { autoFetch: { enabled: true, mode: 'always' } }) }] };
  const rec = record({ 顧客名: 'A社', 商品: 'P1' });
  const fetched = applyAutoFetch({ record: rec, config, properties: props, screen: 'edit', predicate: ({ item: it }) => it.lookupFieldCode === '顧客名' });
  assert.deepEqual(fetched, ['顧客名']);
  assert.equal(rec.顧客名.lookup, true);
  assert.equal(rec.商品.lookup, undefined);

  const rec2 = record({ 顧客名: 'A社', 商品: 'P1' });
  const fetched2 = applyAutoFetch({ record: rec2, config, properties: props, screen: 'edit', predicate: ({ item: it }) => { if (it.lookupFieldCode === '商品') throw new Error('x'); return true; } });
  assert.deepEqual(fetched2, ['顧客名']);

  const rec3 = record({ 顧客名: 'A社', 商品: 'P1' });
  assert.deepEqual(applyAutoFetch({ record: rec3, config, properties: props, screen: 'edit' }), ['顧客名', '商品'], '未指定は従来どおり全部');
});
