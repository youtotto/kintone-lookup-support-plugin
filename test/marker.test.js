'use strict';

/** カラーマーカー（詳細画面専用。ビルド済み desktop.js を jsdom で実行） */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadDesktop, record, v2Config, item, ROOT } = require('./helpers/env');

test('K-1 詳細画面: ルックアップとコピー先に同じ色（薄い背景＋左帯）。padding は変更しない', async () => {
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名', { marker: { color: '#fefadc' } })]) });
  const r = await screen.fire('app.record.detail.show');
  assert.equal(r.results[0], r.event);
  assert.deepEqual(screen.marked().sort(), ['会社名', '電話', '顧客名']);
  ['顧客名', '会社名', '電話'].forEach((code) => {
    const el = screen.markerOf(code);
    assert.equal(el.className, 'mock-field ls-marker', code);
    assert.equal(el.dataset.lsColor, '#fefadc');
    assert.equal(el.style.getPropertyValue('--ls-color'), '#fefadc');
    assert.equal(el.style.getPropertyValue('--ls-band'), '#c9a227');
    assert.equal(el.style.padding, '', 'padding は触らない');
    assert.equal(el.style.backgroundColor, '', 'インラインの背景色は付けない（CSS クラスで表現）');
  });
  assert.equal(screen.styleCount(), 1);
  const css = screen.document.getElementById('ls-marker-style').textContent;
  assert.match(css, /\.ls-marker \{ border-left: 4px solid var\(--ls-band\) !important; border-radius: 2px; background-color: var\(--ls-color\) !important; \}/);
  assert.doesNotMatch(css, /ls-marker-edit|ls-marker-detail|box-shadow|padding/);
});

test('K-2 追加・編集画面ではマーカー処理を呼ばない（getFieldElement を呼ばず、class も付かない）。自動取得は動く', async () => {
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名', { marker: { scope: ['detail', 'create', 'edit'] } })]) });
  let calls = 0;
  const original = screen.window.kintone.app.record.getFieldElement;
  screen.window.kintone.app.record.getFieldElement = (code) => { calls += 1; return original(code); };
  const c = await screen.fire('app.record.create.show', record({ 顧客名: 'A' }));
  assert.equal(c.results[0], c.event);
  assert.equal(c.event.record.顧客名.lookup, true, '自動取得は動く');
  const e = await screen.fire('app.record.edit.show', record({ 顧客名: 'A' }));
  assert.equal(e.results[0], e.event);
  assert.equal(calls, 0, '追加・編集画面では getFieldElement を呼ばない');
  assert.deepEqual(screen.marked(), []);
  assert.equal(screen.styleCount(), 0, 'style も入れない');
  /* 旧 config の scope に create / edit が入っていても無視され、詳細画面では付く */
  await screen.fire('app.record.detail.show');
  assert.deepEqual(screen.marked().sort(), ['会社名', '電話', '顧客名']);
});

test('K-3 モバイルではマーカー処理を呼ばない（自動取得のみ）', async () => {
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名')]) });
  let calls = 0;
  screen.window.kintone.app.record.getFieldElement = () => { calls += 1; return null; };
  const mc = await screen.fire('mobile.app.record.create.show', record({ 顧客名: 'A' }));
  assert.equal(mc.event.record.顧客名.lookup, true);
  await screen.fire('mobile.app.record.edit.show', record({ 顧客名: 'A' }));
  assert.equal(calls, 0);
  assert.deepEqual(screen.marked(), []);
});

test('K-4 無効なマーカーは付けない。scope に detail が無い item は付けない', async () => {
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名', { marker: { enabled: false } }), item('商品', { marker: { scope: ['create'] } })]) });
  await screen.fire('app.record.detail.show');
  assert.deepEqual(screen.marked(), []);
});

test('K-5 複数 Lookup はそれぞれの色。削除済みフィールド・要素が無いフィールドは安全にスキップ', async () => {
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名', { marker: { color: '#dfefff' } }), item('商品', { marker: { color: '#e1ffe1' } }), item('削除済み', { marker: { color: '#ffe6ef' } })]), fieldElements: ['顧客名', '会社名', '商品'] });
  const r = await screen.fire('app.record.detail.show');
  assert.equal(r.results[0], r.event);
  assert.deepEqual(screen.marked().sort(), ['会社名', '商品', '顧客名']);
  assert.equal(screen.markerOf('顧客名').dataset.lsColor, '#dfefff');
  assert.equal(screen.markerOf('商品').dataset.lsColor, '#e1ffe1');
  assert.equal(screen.logs.filter((l) => /TypeError/.test(l)).length, 0);
});

test('K-6 再描画で重複適用しない: 2 回表示しても class / style は 1 組、style 要素は 1 つ', async () => {
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名', { marker: { color: '#fefadc' } })]) });
  await screen.fire('app.record.detail.show');
  await screen.fire('app.record.detail.show');
  const el = screen.markerOf('顧客名');
  assert.equal(el.className, 'mock-field ls-marker');
  assert.equal(screen.styleCount(), 1);
  assert.equal(el.getAttribute('style').split('--ls-color').length - 1, 1);
});

test('K-7 フィールド情報が取れないときはルックアップ本体だけに色を付ける。desktop.js に追加・編集画面用のマーカー分岐が無い', async () => {
  const screen = loadDesktop({ rawConfig: v2Config([item('顧客名')]), getFormFieldsError: new Error('forbidden') });
  await screen.fire('app.record.detail.show');
  assert.deepEqual(screen.marked(), ['顧客名']);
  const src = fs.readFileSync(path.join(ROOT, 'src/free/desktop.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'src/core/marker.js'), 'utf8');
  assert.doesNotMatch(src, /ls-marker-edit|ls-marker-detail|box-shadow|isMobile|screen === 'detail'/);
});
