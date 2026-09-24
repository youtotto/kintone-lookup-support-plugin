'use strict';

/** ルックアップサポート（無料版）設定画面のエントリ */
const { loadConfig } = require('../core/configSchema');
const { renderConfigUi } = require('../core/configUi');
const { resolvePluginId } = require('../core/pluginId');

/* kintone.$PLUGIN_ID はスクリプトの同期実行中にしか取れないため、await より前にここで確定する */
const PLUGIN_ID = resolvePluginId(typeof kintone !== 'undefined' ? kintone : null);

(async function main() {
  const root = document.querySelector('.ls-config');
  if (!root || typeof kintone === 'undefined') return;
  let raw = null;
  let unavailable = false;
  try { raw = kintone.plugin.app.getConfig(PLUGIN_ID); } catch (e) { console.warn('ルックアップサポート: 設定を取得できませんでした', e); unavailable = true; }
  let properties = null;
  try {
    properties = await kintone.app.getFormFields();
  } catch (e) {
    console.warn('ルックアップサポート: フィールド情報を取得できませんでした', e);
    properties = null;
  }
  renderConfigUi({
    document,
    loaded: unavailable ? { state: 'unavailable', config: loadConfig(null).config } : loadConfig(raw),
    properties,
    setConfig: (payload, done) => kintone.plugin.app.setConfig(payload, done),
    appId: kintone.app.getId(),
    pathname: location.pathname,
    navigate: (url) => { location.href = url; }
  });
})();
