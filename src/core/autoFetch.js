'use strict';

/**
 * 無条件自動取得（show イベントで record[code].lookup = true を設定する）。
 * kintone の仕様: 追加・編集画面の表示後イベントで lookup: true を返すと取得が実行される。
 * キーが空なら kintone は実行しないが、こちらでも付けない。
 * 取得モード:
 *   whenCopyEmpty: キー非空 かつ コピー先フィールドが 1 件以上あり かつ すべて空 のときだけ取得（コピー先が無い場合は取得しない）
 *   always:        キー非空なら追加・編集とも取得（コピー先の有無を問わない）
 *   createOnly:    キー非空なら追加画面（コピー含む）でだけ取得（コピー先の有無を問わない）
 */
const { copyTargetsOf } = require('./lookupFields');

function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * この item について取得を実行するか判定する。
 * @param {{ item: object, record: object, properties: object|null, screen: 'create'|'edit' }} p
 * @returns {{ fetch: boolean, reason: string }}
 */
function decideFetch({ item, record, properties, screen }) {
  const auto = item && item.autoFetch;
  if (!auto || auto.enabled !== true) return { fetch: false, reason: 'disabled' };
  if (item.subtableCode) return { fetch: false, reason: 'subtable' }; /* 無料版 v1 は対象外 */
  const code = item.lookupFieldCode;
  const field = record && record[code];
  if (!field || typeof field !== 'object') return { fetch: false, reason: 'missing-field' };
  if (isEmptyValue(field.value)) return { fetch: false, reason: 'empty-key' };
  switch (auto.mode) {
    case 'always': return { fetch: true, reason: 'always' };
    case 'createOnly': return screen === 'create' ? { fetch: true, reason: 'createOnly' } : { fetch: false, reason: 'not-create' };
    case 'whenCopyEmpty':
    default: {
      if (!properties) return { fetch: false, reason: 'no-properties' }; /* コピー先が分からないときは安全側 */
      const targets = copyTargetsOf(properties, code).filter((c) => c !== code);
      if (!targets.length) return { fetch: false, reason: 'no-copy-fields' }; /* コピー先が無いルックアップは「空」と判定しない（[].every 対策） */
      const allEmpty = targets.every((c) => !record[c] || typeof record[c] !== 'object' || isEmptyValue(record[c].value));
      return allEmpty ? { fetch: true, reason: 'copy-empty' } : { fetch: false, reason: 'copy-filled' };
    }
  }
}

/**
 * config の各 item を判定し、取得する item の record[code].lookup = true を設定する。
 * @returns {string[]} lookup を付けたフィールドコード
 */
function applyAutoFetch({ record, config, properties, screen }) {
  const fetched = [];
  if (!record || !config || !Array.isArray(config.items)) return fetched;
  config.items.forEach((item) => {
    const decision = decideFetch({ item, record, properties, screen });
    if (!decision.fetch) return;
    record[item.lookupFieldCode].lookup = true;
    fetched.push(item.lookupFieldCode);
  });
  return fetched;
}

module.exports = { isEmptyValue, decideFetch, applyAutoFetch };
