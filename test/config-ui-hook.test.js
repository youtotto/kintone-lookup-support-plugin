'use strict';

/** 設定画面の拡張点（extensions / transformBeforeSave / showUpsell / edition）。未指定なら v1.2.0 と同じ DOM と保存内容 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { properties, v2Config, item, ROOT } = require('./helpers/env');
const { renderConfigUi } = require('../src/core/configUi');
const { loadConfig } = require('../src/core/configSchema');

function render(opts = {}, rawConfig = v2Config([item('顧客名', { extra: { futureNode: { keep: 1 } } })])) {
  const fragment = fs.readFileSync(path.join(ROOT, 'source/config.html'), 'utf8');
  const dom = new JSDOM(`<!doctype html><html><body>${fragment}</body></html>`, { url: 'https://example.cybozu.com/k/admin/app/5/plugin/config', virtualConsole: new VirtualConsole() });
  const doc = dom.window.document;
  const saved = [];
  const navigated = [];
  const result = renderConfigUi({
    document: doc, loaded: loadConfig(rawConfig), properties: properties(), appId: 5, pathname: '/k/admin/app/5/plugin/config',
    setConfig: (payload, done) => { saved.push(payload); done(); }, navigate: (url) => navigated.push(url), now: new Date('2026-09-25T00:00:00Z'), ...opts
  });
  return { doc, saved, navigated, result, save: () => { doc.querySelector('#ls-save').click(); return JSON.parse(saved[saved.length - 1].config); } };
}

test('X-1 拡張未指定: 段は 2 つ、＋案内あり、edition free、保存内容は従来どおり', () => {
  const r = render();
  assert.equal(r.doc.querySelectorAll('.ls-card[data-code="顧客名"] .ls-section').length, 2);
  assert.ok(r.doc.querySelector('#ls-upsell .ls-upsell'));
  const saved = r.save();
  assert.equal(saved.meta.edition, 'free');
  assert.deepEqual(saved.items[0].futureNode, { keep: 1 });
  assert.deepEqual(Object.keys(saved.items[0]).sort(), ['autoFetch', 'conditionalFetch', 'diffCheck', 'futureNode', 'lookupFieldCode', 'marker', 'subtableCode']);
});

test('X-2 extensions: buildSection の戻りが autoFetch 段の後ろに付き、collect が edit に書き足し、transformBeforeSave が保存前の config を差し替える', () => {
  const seen = [];
  const ext = {
    buildSection(doc, ctx) {
      seen.push(ctx);
      const sec = doc.createElement('section');
      sec.className = 'ls-section x-ext';
      const input = doc.createElement('input');
      input.type = 'checkbox';
      input.className = 'x-flag';
      input.checked = Boolean(ctx.item.extNode && ctx.item.extNode.flag);
      sec.appendChild(input);
      return sec;
    },
    collect(card, edit, { lookup }) { edit.extNode = { flag: card.querySelector('.x-flag').checked, lookup: lookup && lookup.code }; }
  };
  const r = render({
    extensions: [ext, null, {}],
    transformBeforeSave: (next, edits) => {
      edits.forEach((e) => { const it = next.items.find((i) => i.lookupFieldCode === e.lookupFieldCode); if (it) it.extNode = e.extNode; });
      next.meta.extSchema = 1;
      return next;
    }
  });
  assert.equal(seen.length, 2, 'カードごとに 1 回');
  assert.deepEqual(Object.keys(seen[0]).sort(), ['config', 'item', 'lookup', 'properties', 'readOnly']);
  const sections = Array.from(r.doc.querySelectorAll('.ls-card[data-code="顧客名"] .ls-section')).map((s) => s.className);
  assert.deepEqual(sections, ['ls-section ls-section-marker', 'ls-section ls-section-fetch', 'ls-section x-ext']);
  r.doc.querySelector('.ls-card[data-code="顧客名"] .x-flag').checked = true;
  const saved = r.save();
  assert.deepEqual(saved.items.find((i) => i.lookupFieldCode === '顧客名').extNode, { flag: true, lookup: '顧客名' });
  assert.deepEqual(saved.items.find((i) => i.lookupFieldCode === '商品').extNode, { flag: false, lookup: '商品' });
  assert.equal(saved.meta.extSchema, 1);
  assert.deepEqual(saved.items[0].futureNode, { keep: 1 }, '未知ノードは残る');
  assert.equal(saved.items[0].marker.enabled, true, '無料版の段はそのまま');
});

test('X-3 showUpsell false で＋案内を出さない。edition 指定が meta.edition に入る。read-only では拡張段の入力も disabled', () => {
  const r = render({ showUpsell: false, edition: 'other' });
  assert.equal(r.doc.querySelector('#ls-upsell').childNodes.length, 0);
  assert.equal(r.save().meta.edition, 'other');

  const ro = render({ extensions: [{ buildSection(doc) { const s = doc.createElement('section'); s.className = 'ls-section'; const b = doc.createElement('button'); b.className = 'x-btn'; s.appendChild(b); return s; } }] }, { config: JSON.stringify({ version: 9, items: [] }) });
  assert.equal(ro.doc.querySelector('#ls-save').disabled, true);
  const btns = Array.from(ro.doc.querySelectorAll('.x-btn'));
  assert.equal(btns.length, 2, 'read-only（newer）でもカードは表示される');
  assert.ok(btns.every((b) => b.disabled), '拡張段のボタンも disabled');
  const roProps = render({ properties: null, extensions: [{ buildSection(doc) { const s = doc.createElement('section'); const b = doc.createElement('button'); b.className = 'x-btn'; s.appendChild(b); return s; } }] });
  assert.equal(roProps.doc.querySelectorAll('.x-btn').length, 0);
});

test('X-4 transformBeforeSave が undefined / 非関数 / falsy を返しても保存できる', () => {
  assert.equal(render({ transformBeforeSave: 'x' }).save().version, 2);
  assert.equal(render({ transformBeforeSave: () => undefined }).save().items.length, 2);
});
