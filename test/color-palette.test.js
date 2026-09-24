'use strict';

/** PALETTE 全色の往復: raw.config の marker.color → loadConfig → render → select.value が同じ色になる */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadConfigScreen, item, ROOT } = require('./helpers/env');
const S = require('../src/core/configSchema');
const C = require('../src/core/constants');

const lookupProp = (code, label, copy) => ({ code, label, type: 'SINGLE_LINE_TEXT', lookup: { relatedApp: { app: '1' }, relatedKeyField: 'k', fieldMappings: [{ field: copy, relatedField: 'x' }] } });
function sixLookupProps() {
  const props = {};
  C.PALETTE.forEach((p, i) => { props[`LK${i + 1}`] = lookupProp(`LK${i + 1}`, `ルックアップ${i + 1}`, `CP${i + 1}`); props[`CP${i + 1}`] = { code: `CP${i + 1}`, label: `コピー${i + 1}`, type: 'SINGLE_LINE_TEXT' }; });
  return props;
}

test('PL-1 ビルド済み config.js の PALETTE は 6 色で #ebe3fb を含み、全色で normalizeColor(color) === color', () => {
  const built = fs.readFileSync(path.join(ROOT, 'source/js/config.js'), 'utf8');
  C.PALETTE.forEach((p) => {
    assert.ok(built.includes(`value: "${p.value}", band: "${p.band}"`), `${p.label} ${p.value} がビルド済み config.js にある`);
    assert.equal(S.normalizeColor(p.value), p.value, p.label);
    assert.equal(S.normalizeColor(p.value.toUpperCase()), p.value, `${p.label} 大文字`);
  });
  assert.equal(C.PALETTE.length, 6);
  assert.ok(C.PALETTE.some((p) => p.value === '#ebe3fb'));
  assert.equal(S.normalizeColor('#ebe3fb'), '#ebe3fb');
  /* パレット外・表記ゆれは既定色（＝「item はあるが色だけ青」になる唯一の経路） */
  ['#ebe3fb ', ' #ebe3fb', 'ebe3fb', '#7f5fd0', '', null, undefined, 'purple'].forEach((c) => assert.equal(S.normalizeColor(c), C.DEFAULT_COLOR, JSON.stringify(c)));
});

test('PL-2 各色を 1 カードに保存した raw.config から render すると select.value がその色になる', async () => {
  for (const p of C.PALETTE) {
    const raw = { config: JSON.stringify({ version: 2, meta: { edition: 'free', savedAt: '', migratedFrom: [] }, items: [item('LK1', { marker: { color: p.value } })] }) };
    const screen = await loadConfigScreen({ rawConfig: raw, props: { LK1: lookupProp('LK1', 'L1', 'CP1'), CP1: { code: 'CP1', label: 'C1', type: 'SINGLE_LINE_TEXT' } } });
    const sel = screen.card('LK1').querySelector('.ls-color');
    assert.equal(sel.value, p.value, p.label);
    assert.deepEqual(screen.orphans(), [], 'orphan は出ない（item が照合できている）');
  }
});

test('PL-3 6 色を 6 カードへ同時に設定しても、それぞれ保持され、保存後も同じ', async () => {
  const props = sixLookupProps();
  const items = C.PALETTE.map((p, i) => item(`LK${i + 1}`, { marker: { color: p.value } }));
  const raw = { config: JSON.stringify({ version: 2, meta: { edition: 'free', savedAt: '', migratedFrom: [] }, items }) };
  const screen = await loadConfigScreen({ rawConfig: raw, props });
  assert.deepEqual(screen.cards(), C.PALETTE.map((_, i) => `LK${i + 1}`));
  C.PALETTE.forEach((p, i) => assert.equal(screen.card(`LK${i + 1}`).querySelector('.ls-color').value, p.value, `${p.label} カード${i + 1}`));
  await screen.wait(10);
  C.PALETTE.forEach((p, i) => assert.equal(screen.card(`LK${i + 1}`).querySelector('.ls-color').value, p.value, `${p.label} 描画完了後`));
  const payload = await screen.save();
  const saved = JSON.parse(payload.config).items;
  assert.deepEqual(saved.map((it) => it.marker.color), C.PALETTE.map((p) => p.value), '保存される色は UI の select.value と完全一致');
  assert.deepEqual(JSON.parse(payload.settings).map((s) => s.color), C.PALETTE.map((p) => p.value), '互換投影も同じ色コード（band 色や CSS 色ではない）');
  const again = await loadConfigScreen({ rawConfig: { ...payload }, props });
  C.PALETTE.forEach((p, i) => assert.equal(again.card(`LK${i + 1}`).querySelector('.ls-color').value, p.value, `${p.label} 再表示`));
  /* 逆順 */
  const reversed = C.PALETTE.map((p, i) => item(`LK${i + 1}`, { marker: { color: C.PALETTE[C.PALETTE.length - 1 - i].value } }));
  const rev = await loadConfigScreen({ rawConfig: { config: JSON.stringify({ version: 2, meta: {}, items: reversed }) }, props });
  C.PALETTE.forEach((p, i) => assert.equal(rev.card(`LK${i + 1}`).querySelector('.ls-color').value, C.PALETTE[C.PALETTE.length - 1 - i].value, `逆順 カード${i + 1}`));
});

test('PL-4 「item はあるが色だけ既定色」は normalizeColor の不一致でのみ起きる。コード不一致なら全項目が既定値になり orphan が出る', async () => {
  const props = { LK1: lookupProp('LK1', 'L1', 'CP1'), CP1: { code: 'CP1', label: 'C1', type: 'SINGLE_LINE_TEXT' } };
  const badColor = await loadConfigScreen({ rawConfig: { config: JSON.stringify({ version: 2, meta: {}, items: [item('LK1', { marker: { enabled: false, color: '#ebe3fb ' }, autoFetch: { enabled: false, mode: 'always' } })] }) }, props });
  const c1 = badColor.card('LK1');
  assert.equal(c1.querySelector('.ls-color').value, C.DEFAULT_COLOR, '色だけ既定色');
  assert.equal(c1.querySelector('.ls-marker-enabled').checked, false, '他の値は保持');
  assert.equal(c1.querySelector('.ls-mode').value, 'always');
  assert.deepEqual(badColor.orphans(), []);
  const badCode = await loadConfigScreen({ rawConfig: { config: JSON.stringify({ version: 2, meta: {}, items: [item('LK1 ', { marker: { enabled: false, color: '#ebe3fb' }, autoFetch: { enabled: false, mode: 'always' } })] }) }, props });
  const c2 = badCode.card('LK1');
  assert.equal(c2.querySelector('.ls-color').value, C.DEFAULT_COLOR);
  assert.equal(c2.querySelector('.ls-marker-enabled').checked, true, 'コード不一致なら全項目が既定値');
  assert.equal(c2.querySelector('.ls-mode').value, 'whenCopyEmpty');
  assert.deepEqual(badCode.orphans(), ['LK1 '], '照合できなかった保存 item は orphan として表示される');
});
