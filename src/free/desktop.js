'use strict';

/**
 * ルックアップサポート（無料版）レコード画面。
 *   - 追加・編集画面（PC / モバイル）: 取得モードに従って record[code].lookup = true（自動取得）
 *   - 詳細画面（PC）: カラーマーカー
 * 追加・編集画面とモバイルではマーカー処理を呼ばない（getFieldElement は詳細画面・印刷画面専用）。
 * ハンドラーは必ず event を返す。設定が無い・読めないときは何もしない。
 */
const { loadConfig, normalizeConfig } = require('../core/configSchema');
const { applyAutoFetch } = require('../core/autoFetch');
const { applyMarkers } = require('../core/marker');
const { resolvePluginId } = require('../core/pluginId');

/* kintone.$PLUGIN_ID はスクリプトの同期実行中にしか取れないため、先頭で確定する */
const PLUGIN_ID = resolvePluginId(typeof kintone !== 'undefined' ? kintone : null);

(function main() {
  if (typeof kintone === 'undefined' || !kintone.plugin || !kintone.plugin.app) return;
  let raw = null;
  try { raw = kintone.plugin.app.getConfig(PLUGIN_ID); } catch (e) { console.warn('ルックアップサポート: 設定を取得できませんでした', e); raw = null; }
  const loaded = loadConfig(raw);
  if (loaded.state === 'invalid' || loaded.state === 'empty') return;
  /* 'newer'（＋ などがより新しい形式で保存）でも、読める既知ノードだけで動かす */
  const config = normalizeConfig(loaded.config);
  if (!config.items.length) return;

  let propertiesPromise = null;
  function getProperties() {
    if (!propertiesPromise) {
      propertiesPromise = Promise.resolve()
        .then(() => kintone.app.getFormFields())
        .catch((e) => { console.warn('ルックアップサポート: フィールド情報を取得できませんでした', e); return null; });
    }
    return propertiesPromise;
  }

  function getFieldElement(code) {
    const rec = kintone.app && kintone.app.record;
    return rec && typeof rec.getFieldElement === 'function' ? rec.getFieldElement(code) : null;
  }

  const screenOf = (type) => (/\.create\./.test(String(type || '')) ? 'create' : 'edit');

  /** 追加・編集画面（PC / モバイル）: 自動取得のみ */
  async function onFormShow(event) {
    try {
      const properties = await getProperties();
      applyAutoFetch({ record: event.record, config, properties, screen: screenOf(event.type) });
    } catch (e) {
      console.warn('ルックアップサポート: 自動取得の判定に失敗しました', e);
    }
    return event;
  }

  /** 詳細画面（PC）: カラーマーカーのみ */
  async function onDetailShow(event) {
    try {
      const properties = await getProperties();
      applyMarkers({ document, config, properties, getFieldElement });
    } catch (e) {
      console.warn('ルックアップサポート: マーカーの表示に失敗しました', e);
    }
    return event;
  }

  kintone.events.on(['app.record.create.show', 'app.record.edit.show', 'mobile.app.record.create.show', 'mobile.app.record.edit.show'], onFormShow);
  kintone.events.on(['app.record.detail.show'], onDetailShow);
})();
