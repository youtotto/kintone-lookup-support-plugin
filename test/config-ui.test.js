'use strict';

/** 設定画面（ビルド済み config.js + config.html を jsdom で実行。遷移先は core の renderConfigUi で検証） */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadConfigScreen, properties, v2Config, item, ROOT } = require('./helpers/env');
const { renderConfigUi, getBasePath, pluginListUrl } = require('../src/core/configUi');
const { loadConfig } = require('../src/core/configSchema');
const C = require('../src/core/constants');
const P = require('../src/core/plusLink');

test('U-1 Lookup ごとに 1 カード。ラベル（コード）・コピー先・マーカー・自動取得の段。＋専用 UI は DOM に無い', async () => {
  const screen = await loadConfigScreen({ rawConfig: {} });
  assert.deepEqual(screen.cards(), ['顧客名', '商品']);
  const card = screen.card('顧客名');
  assert.equal(card.querySelector('.ls-card-title').textContent, '顧客（顧客名）');
  assert.equal(card.querySelector('.ls-card-copy').textContent, 'コピー先：会社名、電話');
  assert.ok(card.querySelector('.ls-section-marker .ls-marker-enabled').checked);
  assert.equal(card.querySelector('.ls-color').value, C.DEFAULT_COLOR, '既定色はパレットにある');
  assert.ok(card.querySelector('.ls-section-fetch .ls-fetch-enabled').checked);
  assert.equal(card.querySelector('.ls-mode').value, 'whenCopyEmpty');
  assert.deepEqual(Array.from(card.querySelectorAll('.ls-mode option')).map((o) => o.textContent), ['コピー先が空のときだけ', '常に取得', '新規作成時のみ']);
  assert.equal(screen.document.querySelectorAll('.ls-section').length, 4, '2 カード × 2 段のみ');
  assert.equal(card.querySelector('.ls-section-marker .ls-section-title').textContent, 'カラーマーカー（レコード詳細画面）');
  assert.match(card.querySelector('.ls-section-marker .ls-section-note').textContent, /レコード詳細画面で、このルックアップフィールドとコピー先フィールドを同じ色で表示します。追加・編集画面には表示されません。/);
  assert.match(screen.document.querySelector('.ls-lead').textContent, /レコード詳細画面でルックアップフィールドとコピー先フィールドを同じ色で表示し/);
  assert.doesNotMatch(screen.document.body.textContent, /条件付き取得|差分チェック/);
  assert.equal(screen.document.querySelectorAll('.ls-section-condition, .ls-section-diff').length, 0);
  assert.deepEqual(screen.addedGlobals, []);
});

test('U-2 色パレットは 6 色で既定色を含む。旧色は既定色に正規化して表示', async () => {
  const screen = await loadConfigScreen({ rawConfig: { settings: JSON.stringify([{ lookupFieldCode: '顧客名', enabled: true, color: '#E3F2FD', copyFieldCodes: [] }]) } });
  const options = Array.from(screen.card('顧客名').querySelectorAll('.ls-color option')).map((o) => o.value);
  assert.equal(options.length, 6);
  assert.ok(options.includes(C.DEFAULT_COLOR));
  assert.equal(screen.card('顧客名').querySelector('.ls-color').value, C.DEFAULT_COLOR);
});

test('U-3 保存: 編集した marker / autoFetch が config に入り、settings（互換投影）も同時に保存。＋専用ノードは残る', async () => {
  const raw = v2Config([
    { ...item('顧客名'), conditionalFetch: { enabled: true, condition: { field: 'ステータス', values: ['受注'] } }, diffCheck: { enabled: true }, futureNode: { a: 1 } },
    { lookupFieldCode: '品番', subtableCode: '明細', marker: { enabled: true, color: '#dfefff' }, autoFetch: { enabled: true, mode: 'always' }, conditionalFetch: { enabled: true, condition: null } }
  ], { edition: 'plus', futureMeta: 'x' });
  const screen = await loadConfigScreen({ rawConfig: raw });
  screen.setMarker('顧客名', false, '#ffe4d1');
  screen.setFetch('顧客名', true, 'createOnly');
  screen.setFetch('商品', false, 'always');
  const payload = await screen.save();
  assert.deepEqual(Object.keys(payload).sort(), ['config', 'settings']);
  const saved = screen.savedConfig();
  assert.equal(saved.version, 2);
  assert.equal(saved.meta.edition, 'free');
  assert.equal(saved.meta.futureMeta, 'x');
  const a = saved.items.find((i) => i.lookupFieldCode === '顧客名');
  assert.deepEqual(a.marker, { enabled: false, color: '#ffe4d1', scope: ['detail'] });
  assert.deepEqual(a.autoFetch, { enabled: true, mode: 'createOnly' });
  assert.deepEqual(a.conditionalFetch, { enabled: true, condition: { field: 'ステータス', values: ['受注'] } }, '無料版で保存しても conditionalFetch が残る');
  assert.deepEqual(a.diffCheck, { enabled: true }, 'diffCheck が残る');
  assert.deepEqual(a.futureNode, { a: 1 });
  const sub = saved.items.find((i) => i.subtableCode === '明細');
  assert.ok(sub && sub.conditionalFetch.enabled, 'サブテーブルの＋設定も残る');
  const b = saved.items.find((i) => i.lookupFieldCode === '商品');
  assert.deepEqual(b.autoFetch, { enabled: false, mode: 'always' });
  assert.ok(!saved.items.some((i) => 'copyFieldCodes' in i));
  const legacy = screen.savedSettings();
  assert.deepEqual(legacy.map((s) => s.lookupFieldCode), ['顧客名', '商品']);
  assert.deepEqual(legacy[0].copyFieldCodes, ['会社名', '電話']);
  assert.equal(legacy[0].lookupEnabled, false);
});

test('U-4 always を選ぶと注意書きが表示される。旧 Plus 引き継ぎで always があれば上部に案内を 1 回だけ', async () => {
  const screen = await loadConfigScreen({ rawConfig: {} });
  assert.equal(screen.warningVisible('顧客名'), false);
  screen.setFetch('顧客名', true, 'always');
  assert.equal(screen.warningVisible('顧客名'), true);
  assert.match(screen.card('顧客名').querySelector('.ls-warning').textContent, /編集画面を開くたびにルックアップを再取得します。コピー先を手修正している場合、値が上書きされる可能性があります。/);
  assert.ok(!screen.notices().some((n) => /旧Lookup Color Marker Plus/.test(n)), '新規設定では案内を出さない');

  const plus = await loadConfigScreen({ rawConfig: { settings: JSON.stringify([{ lookupFieldCode: '顧客名', enabled: true, color: '#e1ffe1', copyFieldCodes: ['会社名'], lookupEnabled: true }]) } });
  assert.ok(plus.notices().some((n) => n === C.PLUS_MIGRATION_NOTICE));
  assert.equal(plus.card('顧客名').querySelector('.ls-mode').value, 'always');
  assert.equal(plus.warningVisible('顧客名'), true);
  await plus.save();
  const saved = plus.savedConfig();
  assert.deepEqual(saved.meta.migratedFrom, ['plus-v1']);
  assert.equal(saved.meta.noticedPlusAlways, true);
  /* 保存後に開き直すと案内は出ない */
  const again = await loadConfigScreen({ rawConfig: { config: plus.saved[0].config, settings: plus.saved[0].settings } });
  assert.ok(!again.notices().some((n) => n === C.PLUS_MIGRATION_NOTICE));
  assert.equal(again.card('顧客名').querySelector('.ls-mode').value, 'always', '挙動は維持');
});

test('U-5 orphan: フォームに無い Lookup は「フォームに見つかりません」で表示し、削除ボタンを押したときだけ config から消える', async () => {
  const raw = v2Config([item('顧客名'), item('消えたLookup', { conditionalFetch: { enabled: true, condition: null } }), item('もう一つ')]);
  const screen = await loadConfigScreen({ rawConfig: raw });
  assert.deepEqual(screen.orphans(), ['消えたLookup', 'もう一つ']);
  const orphan = screen.document.querySelector('.ls-card-orphan[data-code="消えたLookup"]');
  assert.match(orphan.textContent, /フォームに見つかりません/);
  assert.equal(orphan.querySelectorAll('input, select').length, 0);
  /* 何もしないで保存 → 両方残る */
  await screen.save();
  assert.deepEqual(screen.savedConfig().items.map((i) => i.lookupFieldCode).sort(), ['もう一つ', '商品', '消えたLookup', '顧客名']);
  assert.equal(screen.savedConfig().items.find((i) => i.lookupFieldCode === '消えたLookup').conditionalFetch.enabled, true);
  /* 削除して保存 → その item だけ消える */
  orphan.querySelector('.ls-orphan-delete').click();
  await screen.wait(5);
  assert.deepEqual(screen.orphans(), ['もう一つ']);
  await screen.save();
  assert.deepEqual(screen.savedConfig().items.map((i) => i.lookupFieldCode).sort(), ['もう一つ', '商品', '顧客名']);
});

test('U-6 サブテーブル内 Lookup は件数付きの案内を出し、カードにはしない', async () => {
  const screen = await loadConfigScreen({ rawConfig: {} });
  assert.match(screen.subtableNotice(), /テーブル内のルックアップ 1 件は ルックアップサポート＋ で対応しています/);
  assert.deepEqual(screen.cards(), ['顧客名', '商品']);
  const props = properties();
  delete props.明細;
  const none = await loadConfigScreen({ rawConfig: {}, props });
  assert.equal(none.subtableNotice(), '');
});

test('U-7 Plus 導線: 末尾に控えめな案内。URL 未設定なら製品名はテキスト、設定時は target=_blank / rel=noopener のリンク', async () => {
  const screen = await loadConfigScreen({ rawConfig: {} });
  const upsell = screen.upsell();
  assert.equal(upsell.textContent, '条件付き自動取得、テーブル内のルックアップ取得、参照元との差分表示は ルックアップサポート＋ で利用できます。');
  const src = fs.readFileSync(path.join(ROOT, 'src/core/plusLink.js'), 'utf8');
  assert.match(src, /const PLUS_PRODUCT_URL = '';/, 'URL は未確定なので空文字');
  if (P.PLUS_PRODUCT_URL) {
    const a = upsell.querySelector('a');
    assert.equal(a.target, '_blank');
    assert.equal(a.rel, 'noopener');
  } else {
    assert.equal(upsell.querySelector('a'), null);
    assert.equal(upsell.querySelector('.ls-upsell-name').textContent, 'ルックアップサポート＋');
  }
  /* レコード画面のコードには導線を出さない */
  const desktop = fs.readFileSync(path.join(ROOT, 'source/js/desktop.js'), 'utf8');
  assert.doesNotMatch(desktop, /ルックアップサポート＋|PLUS_PRODUCT_URL|upsell/);
});

test('U-8 ゲストスペース: 保存 / キャンセル後の遷移先が /k/guest/{id}/admin/... になる', async () => {
  assert.equal(getBasePath('/k/guest/12/admin/app/5/plugin/config'), '/k/guest/12');
  assert.equal(getBasePath('/k/admin/app/5/plugin/config'), '/k');
  assert.equal(pluginListUrl('/k/guest/12/x', 5, true), '/k/guest/12/admin/app/5/plugin/?message=CONFIG_SAVED#/');
  assert.equal(pluginListUrl('/k/admin/x', 5, false), '/k/admin/app/5/plugin/');
  /* renderConfigUi に navigate を注入して保存・キャンセルの遷移を検証 */
  const fragment = fs.readFileSync(path.join(ROOT, 'source/config.html'), 'utf8');
  const dom = new JSDOM(`<!doctype html><html><body>${fragment}</body></html>`, { runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  const navigated = [];
  const saved = [];
  renderConfigUi({ document: dom.window.document, loaded: loadConfig({}), properties: properties(), setConfig: (p, cb) => { saved.push(p); cb(); }, appId: 5, pathname: '/k/guest/12/admin/app/5/plugin/config', navigate: (u) => navigated.push(u) });
  dom.window.document.querySelector('#ls-cancel').click();
  assert.deepEqual(navigated, ['/k/guest/12/admin/app/5/plugin/']);
  dom.window.document.querySelector('#ls-save').click();
  assert.equal(saved.length, 1);
  assert.equal(navigated[1], '/k/guest/12/admin/app/5/plugin/?message=CONFIG_SAVED#/');
  const src = fs.readFileSync(path.join(ROOT, 'source/js/config.js'), 'utf8');
  assert.doesNotMatch(src, /['"`]\/k\/admin\//, '/k/admin 固定の文字列が無い');
});

test('U-9 version > 2 の config は read-only: 案内を出し、入力は無効、保存できない', async () => {
  const screen = await loadConfigScreen({ rawConfig: { config: JSON.stringify({ version: 3, meta: {}, items: [item('顧客名')] }) } });
  assert.ok(screen.notices().some((n) => /新しいバージョンの設定（version 3）/.test(n)));
  assert.equal(screen.saveButton().disabled, true);
  assert.ok(Array.from(screen.document.querySelectorAll('.ls-card input, .ls-card select')).every((n) => n.disabled));
  screen.saveButton().click();
  await screen.wait(5);
  assert.equal(screen.saved.length, 0);
});

test('U-10 壊れた config は案内を出して初期状態で編集できる。フィールド情報が取れないときは保存できない', async () => {
  const broken = await loadConfigScreen({ rawConfig: { config: '{broken' } });
  assert.ok(broken.notices().some((n) => /読み取れませんでした/.test(n)));
  assert.deepEqual(broken.cards(), ['顧客名', '商品']);
  await broken.save();
  assert.equal(broken.savedConfig().items.length, 2);
  const failed = await loadConfigScreen({ rawConfig: {}, getFormFieldsError: new Error('forbidden') });
  assert.ok(failed.notices().some((n) => /フィールド情報を取得できませんでした/.test(n)));
  assert.equal(failed.saveButton().disabled, true);
  assert.deepEqual(failed.cards(), []);
});

test('U-11 XSS: ラベルに HTML があってもテキストとして表示。innerHTML / eval を使わない', async () => {
  const props = properties();
  props.顧客名.label = '<img src=x onerror=alert(1)>顧客';
  const screen = await loadConfigScreen({ rawConfig: {}, props });
  assert.equal(screen.document.querySelectorAll('img').length, 0);
  assert.equal(screen.card('顧客名').querySelector('.ls-card-title').textContent, '<img src=x onerror=alert(1)>顧客（顧客名）');
  const built = fs.readFileSync(path.join(ROOT, 'source/js/config.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'source/js/desktop.js'), 'utf8');
  assert.doesNotMatch(built, /innerHTML|\beval\(|new Function\(|XMLHttpRequest|nestrec\.com|licenseChecker|checkLicense|productId|Kucs|kuc\.min|試用版|Trial/);
  assert.doesNotMatch(built, /\bfetch\(/);
});
