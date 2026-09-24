'use strict';

/* src/free/*.js を esbuild で 1 ファイル（IIFE、グローバル汚染なし）に束ねて source/js/ に出力する */
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const entries = [
  ['src/free/desktop.js', 'source/js/desktop.js'],
  ['src/free/config.js', 'source/js/config.js']
];

(async () => {
  for (const [entry, outfile] of entries) {
    await esbuild.build({
      entryPoints: [path.join(root, entry)],
      outfile: path.join(root, outfile),
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: ['es2019'],
      minify: false,
      legalComments: 'none',
      logLevel: 'error',
      banner: { js: '/* ルックアップサポート (Lookup Support) - MIT License - https://github.com/youtotto */' }
    });
    console.log('built', outfile);
  }
})().catch((e) => { console.error(e); process.exit(1); });
