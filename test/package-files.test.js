'use strict';

/** 配布物・同梱ファイルの確認: README / LICENSE / アイコン / manifest */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers/env');

test('PK-1 README と LICENSE が存在し、MIT 本文と Cybozu CSS の表記がある', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const license = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
  assert.match(license, /^MIT License/);
  assert.match(license, /Copyright \(c\) 2025-2026 Yuto Kawai \(NestRec\)/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /source\/css\/51-modern-default\.css[\s\S]*Copyright \(c\) 2014 Cybozu[\s\S]*MIT License/, '第三者コンポーネントの表記');
  assert.match(readme, /PC のレコード詳細画面のみ/);
  assert.match(readme, /コピー先フィールドが 1 件以上ある/);
  assert.match(readme, /コピー先フィールドが設定されていないルックアップでは取得しません/);
  assert.match(readme, /その値は参照先の最新値で上書きされます/);
  assert.match(readme, /編集画面では取得しません/);
  assert.match(readme, /同一のプラグイン ID/);
  assert.match(readme, /「常に取得」\*\* として引き継ぎます/);
  assert.match(readme, /51-modern-default\.css.*Cybozu/);
  assert.doesNotMatch(readme, /lookupEnabled/, '内部互換仕様は README に書かない');
  const css = fs.readFileSync(path.join(ROOT, 'source/css/51-modern-default.css'), 'utf8');
  assert.match(css.slice(0, 200), /Copyright \(c\) 2014 Cybozu[\s\S]*MIT License/, '同梱 CSS 自体のヘッダーに Cybozu の表記がある');
});

test('PK-2 manifest のアイコンは PNG で存在し、配布に必要なキーが揃っている', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'source/manifest.json'), 'utf8'));
  const icon = fs.readFileSync(path.join(ROOT, 'source', manifest.icon));
  assert.ok(icon.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'PNG');
  const w = icon.readUInt32BE(16);
  const h = icon.readUInt32BE(20);
  assert.ok(w > 0 && h > 0 && w === h, `正方形 (${w}x${h})`);
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.type, 'APP');
  assert.equal(manifest.version, '1.2.0', '正式版 v1.2.0');
  assert.equal(manifest.name.ja, 'ルックアップサポート');
  assert.equal(manifest.name.en, 'Lookup Support');
  assert.deepEqual(manifest.desktop.js, ['js/desktop.js']);
  assert.deepEqual(manifest.mobile.js, ['js/desktop.js']);
  assert.deepEqual(manifest.config.js, ['js/config.js']);
  assert.deepEqual(manifest.config.css, ['css/51-modern-default.css']);
  assert.equal(manifest.config.html, 'config.html');
  ['source/config.html', 'source/js/desktop.js', 'source/js/config.js', 'source/css/51-modern-default.css'].forEach((p) => assert.ok(fs.existsSync(path.join(ROOT, p)), p));
});
