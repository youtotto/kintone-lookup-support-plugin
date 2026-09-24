'use strict';

/** 複数カード同時描画で各カードの色 select が個別に保存色を保持する（素直な select.value 復元） */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadConfigScreen, item, ROOT } = require('./helpers/env');
const { buildColorSelect } = require('../src/core/configUi');
const { JSDOM } = require('jsdom');

const BLUE = '#dfefff';
const PINK = '#ffe6ef';
const GREEN = '#e1ffe1';

function props() {
  return {
    案件名: { code: '案件名', label: '案件', type: 'SINGLE_LINE_TEXT', lookup: { relatedApp: { app: '1' }, relatedKeyField: 'a', fieldMappings: [{ field: '担当', relatedField: 'x' }] } },
    担当: { code: '担当', label: '担当', type: 'SINGLE_LINE_TEXT' },
    顧客名code: { code: '顧客名code', label: '顧客名', type: 'SINGLE_LINE_TEXT', lookup: { relatedApp: { app: '2' }, relatedKeyField: 'b', fieldMappings: [{ field: '会社', relatedField: 'y' }] } },
    会社: { code: '会社', label: '会社', type: 'SINGLE_LINE_TEXT' },
    商品: { code: '商品', label: '商品', type: 'SINGLE_LINE_TEXT', lookup: { relatedApp: { app: '3' }, relatedKeyField: 'c', fieldMappings: [] } }
  };
}
const raw = (colors) => ({ config: JSON.stringify({ version: 2, meta: { edition: 'free', savedAt: '', migratedFrom: [] }, items: Object.entries(colors).map(([code, color]) => item(code, { marker: { color } })) }) });
const colorOf = (screen, code) => screen.card(code).querySelector('.ls-color');

test('C-1 案件名=青・顧客名code=桃 の 2 カード同時描画で、それぞれの select.value が個別に復元される', async () => {
  const screen = await loadConfigScreen({ rawConfig: raw({ 案件名: BLUE, 顧客名code: PINK }), props: props() });
  const s1 = colorOf(screen, '案件名');
  const s2 = colorOf(screen, '顧客名code');
  assert.equal(s1.value, BLUE);
  assert.equal(s1.selectedIndex, 0);
  assert.equal(s2.value, PINK);
  assert.equal(s2.selectedIndex, 3);
  s2.dispatchEvent(new screen.window.Event('change'));
  assert.equal(s2.value, PINK, 'paint（change）後も同じ');
  assert.equal(s2.style.backgroundColor, 'rgb(255, 230, 239)');
  await screen.wait(10);
  assert.equal(s1.value, BLUE);
  assert.equal(s2.value, PINK);
});

test('C-2 逆順（案件名=桃・顧客名code=青）でも個別に保持', async () => {
  const screen = await loadConfigScreen({ rawConfig: raw({ 案件名: PINK, 顧客名code: BLUE }), props: props() });
  assert.equal(colorOf(screen, '案件名').value, PINK);
  assert.equal(colorOf(screen, '顧客名code').value, BLUE);
});

test('C-3 3 カード（桃・緑・青）でも個別に保持し、保存すると各色がそのまま config に入り、再表示でも同じ', async () => {
  const screen = await loadConfigScreen({ rawConfig: raw({ 案件名: PINK, 顧客名code: GREEN, 商品: BLUE }), props: props() });
  assert.deepEqual(screen.cards(), ['案件名', '顧客名code', '商品']);
  assert.equal(colorOf(screen, '案件名').value, PINK);
  assert.equal(colorOf(screen, '顧客名code').value, GREEN);
  assert.equal(colorOf(screen, '商品').value, BLUE);
  const payload = await screen.save();
  assert.deepEqual(JSON.parse(payload.config).items.map((i) => [i.lookupFieldCode, i.marker.color]), [['案件名', PINK], ['顧客名code', GREEN], ['商品', BLUE]]);
  const again = await loadConfigScreen({ rawConfig: { ...payload }, props: props() });
  assert.equal(colorOf(again, '案件名').value, PINK);
  assert.equal(colorOf(again, '顧客名code').value, GREEN);
  assert.equal(colorOf(again, '商品').value, BLUE);
});

test('C-4 buildColorSelect 単体: 渡した色がそのまま value。document 挿入後も同じ。パレット外は既定色。document 全体の参照なし', () => {
  const doc = new JSDOM('<!doctype html><html><body></body></html>').window.document;
  const s = buildColorSelect(doc, PINK);
  assert.equal(s.value, PINK);
  doc.body.appendChild(s);
  assert.equal(s.value, PINK);
  assert.equal(buildColorSelect(doc, '#FFE6EF').value, PINK);
  assert.equal(buildColorSelect(doc, 'red').value, BLUE);
  const src = fs.readFileSync(path.join(ROOT, 'src/core/configUi.js'), 'utf8');
  assert.doesNotMatch(src, /doc(ument)?\.querySelector(All)?\(['"]\.ls-color/);
  assert.doesNotMatch(src, /restoreColorSelect|data-ls-color|autocomplete|setAttribute\('selected'/, '不要になった防御コードは残さない');
});
