'use strict';

/** フォーム定義（kintone.app.getFormFields() の戻り = properties）からルックアップを列挙する */

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** ルックアップのコピー先フィールドコード（lookup.fieldMappings から導出。保存はしない） */
function copyTargets(prop) {
  const mappings = prop && isObject(prop.lookup) && Array.isArray(prop.lookup.fieldMappings) ? prop.lookup.fieldMappings : [];
  const out = [];
  mappings.forEach((m) => { if (m && m.field && !out.includes(m.field)) out.push(String(m.field)); });
  return out;
}

function copyTargetsOf(properties, code) {
  return copyTargets(isObject(properties) ? properties[code] : null);
}

/**
 * @returns {{ top: Array<{code, label, copyFieldCodes}>, subtable: Array<{tableCode, tableLabel, code, label}> }}
 */
function listLookups(properties) {
  const top = [];
  const subtable = [];
  Object.entries(isObject(properties) ? properties : {}).forEach(([code, prop]) => {
    if (!isObject(prop)) return;
    if (prop.type === 'SUBTABLE') {
      Object.entries(isObject(prop.fields) ? prop.fields : {}).forEach(([subCode, subProp]) => {
        if (isObject(subProp) && isObject(subProp.lookup)) {
          subtable.push({ tableCode: code, tableLabel: prop.label || code, code: subCode, label: subProp.label || subCode });
        }
      });
      return;
    }
    if (isObject(prop.lookup)) top.push({ code, label: prop.label || code, copyFieldCodes: copyTargets(prop) });
  });
  return { top, subtable };
}

module.exports = { copyTargets, copyTargetsOf, listLookups };
