'use strict';

/** 無条件自動取得: 判定（core）とレコード画面（ビルド済み desktop.js） */
const test = require('node:test');
const assert = require('node:assert/strict');
const { decideFetch, isEmptyValue } = require('../src/core/autoFetch');
const { loadDesktop, properties, record, v2Config, item } = require('./helpers/env');

const props = properties();
const cfg = (mode, over = {}) => ({ ...item('顧客名', { autoFetch: { enabled: true, mode } }), ...over });

test('F-1 whenCopyEmpty: キーあり・コピー先すべて空なら取得、一部でも入力済みなら取得しない', () => {
  assert.equal(decideFetch({ item: cfg('whenCopyEmpty'), record: record({ 顧客名: 'A社' }), properties: props, screen: 'edit' }).fetch, true);
  assert.equal(decideFetch({ item: cfg('whenCopyEmpty'), record: record({ 顧客名: 'A社', 会社名: '', 電話: '03' }), properties: props, screen: 'edit' }).fetch, false, 'コピー先が一部入力済み');
  assert.equal(decideFetch({ item: cfg('whenCopyEmpty'), record: record({ 顧客名: 'A社', 会社名: 'A', 電話: '03' }), properties: props, screen: 'edit' }).fetch, false, 'コピー先すべて入力済み');
  assert.equal(decideFetch({ item: cfg('whenCopyEmpty'), record: record({ 顧客名: 'A社', 会社名: '  ' }), properties: props, screen: 'create' }).fetch, true, '空白だけは空扱い');
  assert.equal(decideFetch({ item: cfg('whenCopyEmpty'), record: record({ 顧客名: 'A社' }), properties: null, screen: 'edit' }).fetch, false, 'フィールド情報が無いときは安全側で取得しない');
});

test('F-2 always: キーがあれば create / edit とも取得。createOnly: 追加画面だけ', () => {
  const filled = record({ 顧客名: 'A社', 会社名: 'A', 電話: '03' });
  assert.equal(decideFetch({ item: cfg('always'), record: filled, properties: props, screen: 'edit' }).fetch, true);
  assert.equal(decideFetch({ item: cfg('always'), record: filled, properties: props, screen: 'create' }).fetch, true);
  assert.equal(decideFetch({ item: cfg('createOnly'), record: filled, properties: props, screen: 'create' }).fetch, true);
  assert.equal(decideFetch({ item: cfg('createOnly'), record: filled, properties: props, screen: 'edit' }).fetch, false);
});

test('F-3 キーが空なら取得しない。無効・削除済み・サブテーブルは取得しない', () => {
  ['always', 'whenCopyEmpty', 'createOnly'].forEach((mode) => {
    assert.equal(decideFetch({ item: cfg(mode), record: record({ 顧客名: '' }), properties: props, screen: 'create' }).fetch, false, mode);
  });
  assert.equal(decideFetch({ item: cfg('always', { autoFetch: { enabled: false, mode: 'always' } }), record: record({ 顧客名: 'A' }), properties: props, screen: 'create' }).fetch, false);
  assert.equal(decideFetch({ item: cfg('always', { lookupFieldCode: '削除済み' }), record: record({ 顧客名: 'A' }), properties: props, screen: 'create' }).reason, 'missing-field');
  assert.equal(decideFetch({ item: cfg('always', { subtableCode: '明細' }), record: record({ 顧客名: 'A' }), properties: props, screen: 'create' }).reason, 'subtable');
  assert.equal(isEmptyValue([]), true);
  assert.equal(isEmptyValue(['a']), false);
  assert.equal(isEmptyValue(null), true);
  assert.equal(isEmptyValue('0'), false);
});

test('F-4 create.show / edit.show: 返した event.record に lookup = true が付く（whenCopyEmpty）', async () => {
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名'), item('商品')]) });
  const created = await screen.fire('app.record.create.show', record({ 顧客名: 'A社', 商品: 'P1' }));
  assert.equal(created.results[0], created.event, 'ハンドラーは event を返す');
  assert.equal(created.event.record.顧客名.lookup, true);
  assert.equal(created.event.record.商品.lookup, true, '複数 Lookup');
  const edited = await screen.fire('app.record.edit.show', record({ 顧客名: 'A社', 会社名: 'A', 商品: 'P1' }));
  assert.equal(edited.event.record.顧客名.lookup, undefined, 'コピー先入力済みは取得しない');
  assert.equal(edited.event.record.商品.lookup, true, '単価が空なので取得');
  assert.equal(screen.formFieldCalls(), 1, 'フィールド情報は 1 回だけ取得');
});

test('F-5 always は編集画面でも毎回、createOnly は追加画面だけ', async () => {
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名', { autoFetch: { mode: 'always' } }), item('商品', { autoFetch: { mode: 'createOnly' } })]) });
  const filled = record({ 顧客名: 'A社', 会社名: 'A', 電話: '03', 商品: 'P1', 単価: '100' });
  const edited = await screen.fire('app.record.edit.show', filled);
  assert.equal(edited.event.record.顧客名.lookup, true);
  assert.equal(edited.event.record.商品.lookup, undefined);
  const created = await screen.fire('app.record.create.show', filled);
  assert.equal(created.event.record.顧客名.lookup, true);
  assert.equal(created.event.record.商品.lookup, true);
});

test('F-6 モバイル: create / edit の show で自動取得のみ（マーカーは付けない）', async () => {
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名')]) });
  assert.deepEqual(screen.registeredTypes().sort(), ['app.record.create.show', 'app.record.detail.show', 'app.record.edit.show', 'mobile.app.record.create.show', 'mobile.app.record.edit.show']);
  const mc = await screen.fire('mobile.app.record.create.show', record({ 顧客名: 'A社' }));
  assert.equal(mc.event.record.顧客名.lookup, true);
  assert.equal(mc.results[0], mc.event);
  const me = await screen.fire('mobile.app.record.edit.show', record({ 顧客名: 'A社', 会社名: 'A', 電話: '03' }));
  assert.equal(me.event.record.顧客名.lookup, undefined);
  assert.deepEqual(screen.marked(), [], 'モバイルではマーカーを付けない');
});

test('F-7 キー空欄・削除済み Lookup・フィールド情報取得失敗でも例外にならず event を返す', async () => {
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名'), item('削除済みLookup', { autoFetch: { mode: 'always' } })]) });
  const r = await screen.fire('app.record.create.show', record({ 顧客名: '' }));
  assert.equal(r.results[0], r.event);
  assert.equal(r.event.record.顧客名.lookup, undefined);
  assert.equal(screen.logs.filter((l) => /TypeError/.test(l)).length, 0);
  const failing = loadDesktop({ rawConfig: v2Config([item('顧客名'), item('商品', { autoFetch: { mode: 'always' } })]), getFormFieldsError: new Error('forbidden') });
  const r2 = await failing.fire('app.record.edit.show', record({ 顧客名: 'A社', 商品: 'P1' }));
  assert.equal(r2.results[0], r2.event);
  assert.equal(r2.event.record.顧客名.lookup, undefined, 'whenCopyEmpty はコピー先が分からないので取得しない');
  assert.equal(r2.event.record.商品.lookup, true, 'always はフィールド情報なしでも取得');
});

test('F-8 設定が無い・壊れている・自動取得無効のときは何もしない', async () => {
  const none = loadDesktop({ rawConfig: {} });
  assert.deepEqual(none.registeredTypes(), []);
  const broken = loadDesktop({ rawConfig: { config: '{broken' } });
  assert.deepEqual(broken.registeredTypes(), []);
  const off = loadDesktop({ rawConfig: v2Config([item('顧客名', { autoFetch: { enabled: false, mode: 'always' } })]) });
  const r = await off.fire('app.record.create.show', record({ 顧客名: 'A社' }));
  assert.equal(r.event.record.顧客名.lookup, undefined);
  assert.deepEqual(none.addedGlobals, [], 'window にグローバルを増やさない');
});

test('F-9 旧 LCM settings のままでも動く（自動取得は無効、マーカーのみ）。旧 Plus settings は常に取得', async () => {
  const lcm = loadDesktop({ rawConfig: { settings: JSON.stringify([{ lookupFieldCode: '顧客名', enabled: true, color: '#fefadc', copyFieldCodes: ['会社名', '電話'] }]) } });
  const r = await lcm.fire('app.record.create.show', record({ 顧客名: 'A社' }));
  assert.equal(r.event.record.顧客名.lookup, undefined);
  await lcm.fire('app.record.detail.show');
  assert.deepEqual(lcm.marked().sort(), ['会社名', '電話', '顧客名']);
  const plus = loadDesktop({ rawConfig: { settings: JSON.stringify([{ lookupFieldCode: '顧客名', enabled: true, color: '#fefadc', copyFieldCodes: ['会社名'], lookupEnabled: true }]) } });
  const r2 = await plus.fire('app.record.edit.show', record({ 顧客名: 'A社', 会社名: 'A', 電話: '03' }));
  assert.equal(r2.event.record.顧客名.lookup, true);
});

test('F-10 fieldMappings が無い（コピー先 0 件）ルックアップ: whenCopyEmpty は取得しない、always / createOnly は取得する', async () => {
  const noCopy = { 顧客名: { code: '顧客名', label: '顧客', type: 'SINGLE_LINE_TEXT', lookup: { relatedApp: { app: '10' }, relatedKeyField: '顧客名', fieldMappings: [] } } };
  const withKey = record({ 顧客名: 'A社' });
  assert.deepEqual(decideFetch({ item: cfg('whenCopyEmpty'), record: withKey, properties: noCopy, screen: 'create' }), { fetch: false, reason: 'no-copy-fields' });
  assert.deepEqual(decideFetch({ item: cfg('whenCopyEmpty'), record: withKey, properties: noCopy, screen: 'edit' }), { fetch: false, reason: 'no-copy-fields' });
  assert.equal(decideFetch({ item: cfg('always'), record: withKey, properties: noCopy, screen: 'edit' }).fetch, true);
  assert.equal(decideFetch({ item: cfg('createOnly'), record: withKey, properties: noCopy, screen: 'create' }).fetch, true);
  assert.equal(decideFetch({ item: cfg('createOnly'), record: withKey, properties: noCopy, screen: 'edit' }).fetch, false);
  /* fieldMappings が無い / lookup 自体が無いフィールド定義でも同じ */
  const missingMappings = { 顧客名: { code: '顧客名', type: 'SINGLE_LINE_TEXT', lookup: { relatedApp: { app: '10' }, relatedKeyField: '顧客名' } } };
  assert.equal(decideFetch({ item: cfg('whenCopyEmpty'), record: withKey, properties: missingMappings, screen: 'create' }).reason, 'no-copy-fields');
  /* ビルド済み desktop.js でも同じ */
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名')]), props: noCopy, fieldElements: ['顧客名'] });
  const r = await screen.fire('app.record.create.show', withKey);
  assert.equal(r.event.record.顧客名.lookup, undefined);
  const alwaysScreen = loadDesktop({ rawConfig: v2Config([item('顧客名', { autoFetch: { mode: 'always' } })]), props: noCopy, fieldElements: ['顧客名'] });
  const r2 = await alwaysScreen.fire('app.record.edit.show', withKey);
  assert.equal(r2.event.record.顧客名.lookup, true);
  /* 既存挙動: コピー先ありでは従来どおり */
  assert.equal(decideFetch({ item: cfg('whenCopyEmpty'), record: record({ 顧客名: 'A社' }), properties: props, screen: 'edit' }).reason, 'copy-empty');
});
