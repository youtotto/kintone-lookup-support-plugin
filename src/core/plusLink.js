'use strict';

/**
 * 有料版「ルックアップサポート＋」への案内（設定画面専用。レコード画面のバンドルには含めない）。
 * URL が未確定のあいだは空文字にし、製品名を文字列で表示する。推測で URL を入れない。
 */
const PLUS_PRODUCT_NAME = 'ルックアップサポート＋';
const PLUS_PRODUCT_URL = '';
const UPSELL_TEXT_BEFORE = '条件付き自動取得、テーブル内のルックアップ取得、参照元との差分表示は ';
const UPSELL_TEXT_AFTER = ' で利用できます。';
const SUBTABLE_NOTICE = (count) => `テーブル内のルックアップ ${count} 件は ${PLUS_PRODUCT_NAME} で対応しています（無料版では対象外です）。`;

module.exports = { PLUS_PRODUCT_NAME, PLUS_PRODUCT_URL, UPSELL_TEXT_BEFORE, UPSELL_TEXT_AFTER, SUBTABLE_NOTICE };
