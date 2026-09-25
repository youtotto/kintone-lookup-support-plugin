/* ルックアップサポート (Lookup Support) - MIT License - https://github.com/youtotto */
"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/core/constants.js
  var require_constants = __commonJS({
    "src/core/constants.js"(exports, module) {
      "use strict";
      var PLUGIN_ID2 = "gjichmnphbhhabpbijhcjgpmnopbgoem";
      var CONFIG_VERSION = 2;
      var EDITION = "free";
      var PALETTE = [
        { value: "#dfefff", band: "#3d7fcf", label: "\u9752" },
        { value: "#fefadc", band: "#c9a227", label: "\u9EC4" },
        { value: "#e1ffe1", band: "#3a9d5d", label: "\u7DD1" },
        { value: "#ffe6ef", band: "#d1508a", label: "\u6843" },
        { value: "#ebe3fb", band: "#7f5fd0", label: "\u7D2B" },
        { value: "#ffe4d1", band: "#d97a3a", label: "\u6A59" }
      ];
      var DEFAULT_COLOR = PALETTE[0].value;
      var MODES = ["whenCopyEmpty", "always", "createOnly"];
      var DEFAULT_MODE = "whenCopyEmpty";
      var MODE_LABELS = {
        whenCopyEmpty: "\u30B3\u30D4\u30FC\u5148\u304C\u7A7A\u306E\u3068\u304D\u3060\u3051",
        always: "\u5E38\u306B\u53D6\u5F97",
        createOnly: "\u65B0\u898F\u4F5C\u6210\u6642\u306E\u307F"
      };
      var ALWAYS_WARNING = "\u7DE8\u96C6\u753B\u9762\u3092\u958B\u304F\u305F\u3073\u306B\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u3092\u518D\u53D6\u5F97\u3057\u307E\u3059\u3002\u30B3\u30D4\u30FC\u5148\u3092\u624B\u4FEE\u6B63\u3057\u3066\u3044\u308B\u5834\u5408\u3001\u5024\u304C\u4E0A\u66F8\u304D\u3055\u308C\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002";
      var PLUS_MIGRATION_NOTICE = "\u65E7Lookup Color Marker Plus\u306E\u8A2D\u5B9A\u3092\u5F15\u304D\u7D99\u3044\u3067\u3044\u308B\u305F\u3081\u300E\u5E38\u306B\u53D6\u5F97\u300F\u306B\u306A\u3063\u3066\u3044\u307E\u3059\u3002\u30B3\u30D4\u30FC\u5148\u3092\u624B\u4FEE\u6B63\u3059\u308B\u5834\u5408\u306F\u300E\u30B3\u30D4\u30FC\u5148\u304C\u7A7A\u306E\u3068\u304D\u3060\u3051\u300F\u3092\u63A8\u5968\u3057\u307E\u3059\u3002";
      var MARKER_SCOPES = ["detail", "create", "edit"];
      var DEFAULT_MARKER_SCOPE = ["detail"];
      module.exports = {
        PLUGIN_ID: PLUGIN_ID2,
        CONFIG_VERSION,
        EDITION,
        PALETTE,
        DEFAULT_COLOR,
        MODES,
        DEFAULT_MODE,
        MODE_LABELS,
        ALWAYS_WARNING,
        PLUS_MIGRATION_NOTICE,
        MARKER_SCOPES,
        DEFAULT_MARKER_SCOPE
      };
    }
  });

  // src/core/lookupFields.js
  var require_lookupFields = __commonJS({
    "src/core/lookupFields.js"(exports, module) {
      "use strict";
      var isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
      function copyTargets(prop) {
        const mappings = prop && isObject(prop.lookup) && Array.isArray(prop.lookup.fieldMappings) ? prop.lookup.fieldMappings : [];
        const out = [];
        mappings.forEach((m) => {
          if (m && m.field && !out.includes(m.field)) out.push(String(m.field));
        });
        return out;
      }
      function copyTargetsOf(properties, code) {
        return copyTargets(isObject(properties) ? properties[code] : null);
      }
      function listLookups(properties) {
        const top = [];
        const subtable = [];
        Object.entries(isObject(properties) ? properties : {}).forEach(([code, prop]) => {
          if (!isObject(prop)) return;
          if (prop.type === "SUBTABLE") {
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
    }
  });

  // src/core/configSchema.js
  var require_configSchema = __commonJS({
    "src/core/configSchema.js"(exports, module) {
      "use strict";
      var C = require_constants();
      var { copyTargetsOf } = require_lookupFields();
      var isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
      var clone = (v) => JSON.parse(JSON.stringify(v));
      function safeParse(text) {
        try {
          return { ok: true, value: JSON.parse(text) };
        } catch (_e) {
          return { ok: false, value: null };
        }
      }
      function normalizeColor(color) {
        const c = String(color || "").toLowerCase();
        return C.PALETTE.some((p) => p.value === c) ? c : C.DEFAULT_COLOR;
      }
      function normalizeMode(mode) {
        return C.MODES.includes(mode) ? mode : C.DEFAULT_MODE;
      }
      function normalizeScope(scope) {
        if (!Array.isArray(scope)) return [...C.DEFAULT_MARKER_SCOPE];
        const valid = scope.filter((s) => C.MARKER_SCOPES.includes(s));
        return valid.length ? valid : [...C.DEFAULT_MARKER_SCOPE];
      }
      function emptyConfig() {
        return { version: C.CONFIG_VERSION, meta: { edition: C.EDITION, savedAt: "", migratedFrom: [] }, items: [] };
      }
      function defaultItem(lookupFieldCode, subtableCode = null) {
        return {
          lookupFieldCode,
          subtableCode,
          marker: { enabled: true, color: C.DEFAULT_COLOR, scope: [...C.DEFAULT_MARKER_SCOPE] },
          autoFetch: { enabled: true, mode: C.DEFAULT_MODE },
          conditionalFetch: { enabled: false, condition: null },
          diffCheck: { enabled: false }
        };
      }
      function normalizeItem(item) {
        const src = isObject(item) ? item : {};
        const marker = isObject(src.marker) ? src.marker : {};
        const autoFetch = isObject(src.autoFetch) ? src.autoFetch : {};
        return {
          ...src,
          lookupFieldCode: String(src.lookupFieldCode || ""),
          subtableCode: src.subtableCode ? String(src.subtableCode) : null,
          marker: { ...marker, enabled: marker.enabled !== false, color: normalizeColor(marker.color), scope: normalizeScope(marker.scope) },
          autoFetch: { ...autoFetch, enabled: autoFetch.enabled === true, mode: normalizeMode(autoFetch.mode) }
        };
      }
      function normalizeConfig2(config) {
        const src = isObject(config) ? config : {};
        const meta = isObject(src.meta) ? src.meta : {};
        return {
          ...src,
          version: C.CONFIG_VERSION,
          meta: { ...meta, edition: meta.edition || C.EDITION, savedAt: meta.savedAt || "", migratedFrom: Array.isArray(meta.migratedFrom) ? meta.migratedFrom : [] },
          items: (Array.isArray(src.items) ? src.items : []).map(normalizeItem).filter((it) => it.lookupFieldCode)
        };
      }
      function migrateLegacy(settings) {
        const list = Array.isArray(settings) ? settings.filter((s) => isObject(s) && s.lookupFieldCode) : [];
        const isPlus = list.some((s) => Object.prototype.hasOwnProperty.call(s, "lookupEnabled"));
        const config = emptyConfig();
        config.meta.migratedFrom = [isPlus ? "plus-v1" : "lcm-v1"];
        config.items = list.map((s) => {
          const code = String(s.lookupFieldCode);
          const dot = code.indexOf(".");
          const item = dot > 0 ? defaultItem(code.slice(dot + 1), code.slice(0, dot)) : defaultItem(code);
          item.marker.enabled = s.enabled !== false;
          item.marker.color = normalizeColor(s.color);
          item.autoFetch = isPlus ? { enabled: s.lookupEnabled !== false, mode: "always" } : { enabled: false, mode: C.DEFAULT_MODE };
          return item;
        });
        return { state: "migrated", config, from: config.meta.migratedFrom[0] };
      }
      function loadConfig2(raw) {
        const src = isObject(raw) ? raw : {};
        if (typeof src.config === "string" && src.config.trim() !== "") {
          const p = safeParse(src.config);
          const version = p.ok && isObject(p.value) ? Number(p.value.version) : NaN;
          if (!Number.isFinite(version)) return { state: "invalid", config: emptyConfig() };
          if (version > C.CONFIG_VERSION) return { state: "newer", config: p.value, raw: p.value };
          return { state: "v2", config: normalizeConfig2(p.value) };
        }
        if (typeof src.settings === "string" && src.settings.trim() !== "") {
          const p = safeParse(src.settings);
          if (!p.ok || !Array.isArray(p.value)) return { state: "invalid", config: emptyConfig() };
          return migrateLegacy(p.value);
        }
        return { state: "empty", config: emptyConfig() };
      }
      var sameTarget = (item, code, subtableCode) => item.lookupFieldCode === code && (item.subtableCode || null) === (subtableCode || null);
      function findItem(config, code, subtableCode = null) {
        return (config.items || []).find((it) => sameTarget(it, code, subtableCode)) || null;
      }
      function applyEdits(config, edits) {
        const next = clone(normalizeConfig2(config));
        (edits || []).forEach((edit) => {
          if (!edit || !edit.lookupFieldCode) return;
          let item = findItem(next, edit.lookupFieldCode, edit.subtableCode);
          if (!item) {
            item = defaultItem(edit.lookupFieldCode, edit.subtableCode || null);
            next.items.push(item);
          }
          if (isObject(edit.marker)) {
            item.marker = { ...item.marker, enabled: edit.marker.enabled !== false, color: normalizeColor(edit.marker.color) };
          }
          if (isObject(edit.autoFetch)) {
            item.autoFetch = { ...item.autoFetch, enabled: edit.autoFetch.enabled === true, mode: normalizeMode(edit.autoFetch.mode) };
          }
        });
        return next;
      }
      function removeItem(config, code, subtableCode = null) {
        const next = clone(normalizeConfig2(config));
        next.items = next.items.filter((it) => !sameTarget(it, code, subtableCode));
        return next;
      }
      function buildLegacySettings(config, properties) {
        return normalizeConfig2(config).items.filter((it) => !it.subtableCode).map((it) => ({
          lookupFieldCode: it.lookupFieldCode,
          enabled: it.marker.enabled,
          color: it.marker.color,
          copyFieldCodes: properties ? copyTargetsOf(properties, it.lookupFieldCode) : [],
          lookupEnabled: it.autoFetch.enabled && it.autoFetch.mode === "always"
        }));
      }
      function serialize(config, { properties = null, edition = C.EDITION, now = /* @__PURE__ */ new Date() } = {}) {
        const next = clone(normalizeConfig2(config));
        next.meta.edition = edition;
        next.meta.savedAt = now instanceof Date ? now.toISOString() : String(now);
        return { config: JSON.stringify(next), settings: JSON.stringify(buildLegacySettings(next, properties)) };
      }
      module.exports = {
        emptyConfig,
        defaultItem,
        normalizeItem,
        normalizeConfig: normalizeConfig2,
        normalizeColor,
        normalizeMode,
        migrateLegacy,
        loadConfig: loadConfig2,
        findItem,
        applyEdits,
        removeItem,
        buildLegacySettings,
        serialize
      };
    }
  });

  // src/core/autoFetch.js
  var require_autoFetch = __commonJS({
    "src/core/autoFetch.js"(exports, module) {
      "use strict";
      var { copyTargetsOf } = require_lookupFields();
      function isEmptyValue(value) {
        if (value === null || value === void 0) return true;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === "string") return value.trim() === "";
        if (typeof value === "object") return Object.keys(value).length === 0;
        return false;
      }
      function decideBase({ item, record, properties, screen }) {
        const auto = item && item.autoFetch;
        if (!auto || auto.enabled !== true) return { fetch: false, reason: "disabled" };
        if (item.subtableCode) return { fetch: false, reason: "subtable" };
        const code = item.lookupFieldCode;
        const field = record && record[code];
        if (!field || typeof field !== "object") return { fetch: false, reason: "missing-field" };
        if (isEmptyValue(field.value)) return { fetch: false, reason: "empty-key" };
        switch (auto.mode) {
          case "always":
            return { fetch: true, reason: "always" };
          case "createOnly":
            return screen === "create" ? { fetch: true, reason: "createOnly" } : { fetch: false, reason: "not-create" };
          case "whenCopyEmpty":
          default: {
            if (!properties) return { fetch: false, reason: "no-properties" };
            const targets = copyTargetsOf(properties, code).filter((c) => c !== code);
            if (!targets.length) return { fetch: false, reason: "no-copy-fields" };
            const allEmpty = targets.every((c) => !record[c] || typeof record[c] !== "object" || isEmptyValue(record[c].value));
            return allEmpty ? { fetch: true, reason: "copy-empty" } : { fetch: false, reason: "copy-filled" };
          }
        }
      }
      function decideFetch({ item, record, properties, screen, predicate }) {
        const base = decideBase({ item, record, properties, screen });
        if (!base.fetch || typeof predicate !== "function") return base;
        let ok = false;
        try {
          ok = predicate({ item, record, properties, screen });
        } catch (error) {
          return { fetch: false, reason: "predicate-error", error };
        }
        return ok ? base : { fetch: false, reason: "predicate-false" };
      }
      function applyAutoFetch2({ record, config, properties, screen, predicate }) {
        const fetched = [];
        if (!record || !config || !Array.isArray(config.items)) return fetched;
        config.items.forEach((item) => {
          const decision = decideFetch({ item, record, properties, screen, predicate });
          if (!decision.fetch) return;
          record[item.lookupFieldCode].lookup = true;
          fetched.push(item.lookupFieldCode);
        });
        return fetched;
      }
      module.exports = { isEmptyValue, decideBase, decideFetch, applyAutoFetch: applyAutoFetch2 };
    }
  });

  // src/core/marker.js
  var require_marker = __commonJS({
    "src/core/marker.js"(exports, module) {
      "use strict";
      var C = require_constants();
      var { copyTargetsOf } = require_lookupFields();
      var STYLE_ID = "ls-marker-style";
      var CLASS = "ls-marker";
      var CSS = `.${CLASS} { border-left: 4px solid var(--ls-band) !important; border-radius: 2px; background-color: var(--ls-color) !important; }`;
      function bandOf(color) {
        const p = C.PALETTE.find((x) => x.value === color);
        return p ? p.band : C.PALETTE[0].band;
      }
      function ensureStyle(doc) {
        if (doc.getElementById(STYLE_ID)) return;
        const style = doc.createElement("style");
        style.id = STYLE_ID;
        style.textContent = CSS;
        (doc.head || doc.body).appendChild(style);
      }
      function clearMarkers(doc) {
        Array.from(doc.querySelectorAll(`.${CLASS}`)).forEach((el) => {
          el.classList.remove(CLASS);
          el.removeAttribute("data-ls-color");
          el.style.removeProperty("--ls-color");
          el.style.removeProperty("--ls-band");
        });
      }
      function applyMarkers2({ document: doc, config, properties, getFieldElement }) {
        const applied = [];
        if (!doc || !config || !Array.isArray(config.items)) return applied;
        clearMarkers(doc);
        ensureStyle(doc);
        config.items.forEach((item) => {
          const marker = item && item.marker;
          if (!marker || marker.enabled === false || item.subtableCode) return;
          if (Array.isArray(marker.scope) && !marker.scope.includes("detail")) return;
          const codes = [item.lookupFieldCode, ...copyTargetsOf(properties, item.lookupFieldCode)].filter((c, i, arr) => c && arr.indexOf(c) === i);
          codes.forEach((code) => {
            let el = null;
            try {
              el = getFieldElement(code);
            } catch (_e) {
              el = null;
            }
            if (!el || applied.includes(code)) return;
            el.classList.add(CLASS);
            el.setAttribute("data-ls-color", marker.color);
            el.style.setProperty("--ls-color", marker.color);
            el.style.setProperty("--ls-band", bandOf(marker.color));
            applied.push(code);
          });
        });
        return applied;
      }
      module.exports = { applyMarkers: applyMarkers2, clearMarkers, ensureStyle, STYLE_ID, CLASS };
    }
  });

  // src/core/pluginId.js
  var require_pluginId = __commonJS({
    "src/core/pluginId.js"(exports, module) {
      "use strict";
      var C = require_constants();
      function resolvePluginId2(kintoneObj) {
        const id = kintoneObj && typeof kintoneObj.$PLUGIN_ID === "string" ? kintoneObj.$PLUGIN_ID.trim() : "";
        return id || C.PLUGIN_ID;
      }
      module.exports = { resolvePluginId: resolvePluginId2 };
    }
  });

  // src/free/desktop.js
  var { loadConfig, normalizeConfig } = require_configSchema();
  var { applyAutoFetch } = require_autoFetch();
  var { applyMarkers } = require_marker();
  var { resolvePluginId } = require_pluginId();
  var PLUGIN_ID = resolvePluginId(typeof kintone !== "undefined" ? kintone : null);
  (function main() {
    if (typeof kintone === "undefined" || !kintone.plugin || !kintone.plugin.app) return;
    let raw = null;
    try {
      raw = kintone.plugin.app.getConfig(PLUGIN_ID);
    } catch (e) {
      console.warn("\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u30B5\u30DD\u30FC\u30C8: \u8A2D\u5B9A\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F", e);
      raw = null;
    }
    const loaded = loadConfig(raw);
    if (loaded.state === "invalid" || loaded.state === "empty") return;
    const config = normalizeConfig(loaded.config);
    if (!config.items.length) return;
    let propertiesPromise = null;
    function getProperties() {
      if (!propertiesPromise) {
        propertiesPromise = Promise.resolve().then(() => kintone.app.getFormFields()).catch((e) => {
          console.warn("\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u30B5\u30DD\u30FC\u30C8: \u30D5\u30A3\u30FC\u30EB\u30C9\u60C5\u5831\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F", e);
          return null;
        });
      }
      return propertiesPromise;
    }
    function getFieldElement(code) {
      const rec = kintone.app && kintone.app.record;
      return rec && typeof rec.getFieldElement === "function" ? rec.getFieldElement(code) : null;
    }
    const screenOf = (type) => /\.create\./.test(String(type || "")) ? "create" : "edit";
    async function onFormShow(event) {
      try {
        const properties = await getProperties();
        applyAutoFetch({ record: event.record, config, properties, screen: screenOf(event.type) });
      } catch (e) {
        console.warn("\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u30B5\u30DD\u30FC\u30C8: \u81EA\u52D5\u53D6\u5F97\u306E\u5224\u5B9A\u306B\u5931\u6557\u3057\u307E\u3057\u305F", e);
      }
      return event;
    }
    async function onDetailShow(event) {
      try {
        const properties = await getProperties();
        applyMarkers({ document, config, properties, getFieldElement });
      } catch (e) {
        console.warn("\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u30B5\u30DD\u30FC\u30C8: \u30DE\u30FC\u30AB\u30FC\u306E\u8868\u793A\u306B\u5931\u6557\u3057\u307E\u3057\u305F", e);
      }
      return event;
    }
    kintone.events.on(["app.record.create.show", "app.record.edit.show", "mobile.app.record.create.show", "mobile.app.record.edit.show"], onFormShow);
    kintone.events.on(["app.record.detail.show"], onDetailShow);
  })();
})();
