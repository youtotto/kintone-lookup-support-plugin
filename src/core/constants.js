'use strict';

/**
 * plugin ID（無料版・＋・Trial 共通。既存 Lookup Color Marker / Plus の PPK を引き継ぐ）。
 * kintone.$PLUGIN_ID が取れない場合のフォールバックとして使う。PPK を変えたらここも変える。
 */
const PLUGIN_ID = 'gjichmnphbhhabpbijhcjgpmnopbgoem';

/** config schema のバージョン（無料版・＋ 共通） */
const CONFIG_VERSION = 2;
const EDITION = 'free';

/** カラーマーカーのパレット（value = 薄い背景色、band = 左帯の濃い色） */
const PALETTE = [
  { value: '#dfefff', band: '#3d7fcf', label: '青' },
  { value: '#fefadc', band: '#c9a227', label: '黄' },
  { value: '#e1ffe1', band: '#3a9d5d', label: '緑' },
  { value: '#ffe6ef', band: '#d1508a', label: '桃' },
  { value: '#ebe3fb', band: '#7f5fd0', label: '紫' },
  { value: '#ffe4d1', band: '#d97a3a', label: '橙' }
];
const DEFAULT_COLOR = PALETTE[0].value;

/** 自動取得の取得モード */
const MODES = ['whenCopyEmpty', 'always', 'createOnly'];
const DEFAULT_MODE = 'whenCopyEmpty';
const MODE_LABELS = {
  whenCopyEmpty: 'コピー先が空のときだけ',
  always: '常に取得',
  createOnly: '新規作成時のみ'
};
const ALWAYS_WARNING = '編集画面を開くたびにルックアップを再取得します。コピー先を手修正している場合、値が上書きされる可能性があります。';
const PLUS_MIGRATION_NOTICE = '旧Lookup Color Marker Plusの設定を引き継いでいるため『常に取得』になっています。コピー先を手修正する場合は『コピー先が空のときだけ』を推奨します。';

/**
 * marker.scope に入りうる既知の値（config 互換用）。
 * 無料版 v1 が実際にマーカーを適用するのはレコード詳細画面（'detail'）だけで、新規保存時は ['detail'] を書く。
 * 旧 config や将来の＋が 'create' / 'edit' を持っていてもエラーにせず、無料版では無視する。
 */
const MARKER_SCOPES = ['detail', 'create', 'edit'];
const DEFAULT_MARKER_SCOPE = ['detail'];

module.exports = {
  PLUGIN_ID, CONFIG_VERSION, EDITION, PALETTE, DEFAULT_COLOR, MODES, DEFAULT_MODE, MODE_LABELS,
  ALWAYS_WARNING, PLUS_MIGRATION_NOTICE, MARKER_SCOPES, DEFAULT_MARKER_SCOPE
};
