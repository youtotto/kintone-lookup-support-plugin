'use strict';

/**
 * plugin ID の解決。
 * kintone は `kintone.$PLUGIN_ID` をプラグイン JS の同期実行中にだけ提供する（await の後では undefined になる）。
 * そのため各エントリはスクリプト先頭で同期的に resolvePluginId() を呼び、結果を保持して使う。
 * `$PLUGIN_ID` が取れない場合は constants の固定 ID（無料版・＋・Trial 共通）へフォールバックする。
 */
const C = require('./constants');

function resolvePluginId(kintoneObj) {
  const id = kintoneObj && typeof kintoneObj.$PLUGIN_ID === 'string' ? kintoneObj.$PLUGIN_ID.trim() : '';
  return id || C.PLUGIN_ID;
}

module.exports = { resolvePluginId };
