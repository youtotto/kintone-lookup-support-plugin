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
      function normalizeConfig(config) {
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
          return { state: "v2", config: normalizeConfig(p.value) };
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
        const next = clone(normalizeConfig(config));
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
        const next = clone(normalizeConfig(config));
        next.items = next.items.filter((it) => !sameTarget(it, code, subtableCode));
        return next;
      }
      function buildLegacySettings(config, properties) {
        return normalizeConfig(config).items.filter((it) => !it.subtableCode).map((it) => ({
          lookupFieldCode: it.lookupFieldCode,
          enabled: it.marker.enabled,
          color: it.marker.color,
          copyFieldCodes: properties ? copyTargetsOf(properties, it.lookupFieldCode) : [],
          lookupEnabled: it.autoFetch.enabled && it.autoFetch.mode === "always"
        }));
      }
      function serialize(config, { properties = null, edition = C.EDITION, now = /* @__PURE__ */ new Date() } = {}) {
        const next = clone(normalizeConfig(config));
        next.meta.edition = edition;
        next.meta.savedAt = now instanceof Date ? now.toISOString() : String(now);
        return { config: JSON.stringify(next), settings: JSON.stringify(buildLegacySettings(next, properties)) };
      }
      module.exports = {
        emptyConfig,
        defaultItem,
        normalizeItem,
        normalizeConfig,
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

  // src/core/plusLink.js
  var require_plusLink = __commonJS({
    "src/core/plusLink.js"(exports, module) {
      "use strict";
      var PLUS_PRODUCT_NAME = "\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u30B5\u30DD\u30FC\u30C8\uFF0B";
      var PLUS_PRODUCT_URL = "";
      var UPSELL_TEXT_BEFORE = "\u6761\u4EF6\u4ED8\u304D\u81EA\u52D5\u53D6\u5F97\u3001\u30C6\u30FC\u30D6\u30EB\u5185\u306E\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u53D6\u5F97\u3001\u53C2\u7167\u5143\u3068\u306E\u5DEE\u5206\u8868\u793A\u306F ";
      var UPSELL_TEXT_AFTER = " \u3067\u5229\u7528\u3067\u304D\u307E\u3059\u3002";
      var SUBTABLE_NOTICE = (count) => `\u30C6\u30FC\u30D6\u30EB\u5185\u306E\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7 ${count} \u4EF6\u306F ${PLUS_PRODUCT_NAME} \u3067\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u3059\uFF08\u7121\u6599\u7248\u3067\u306F\u5BFE\u8C61\u5916\u3067\u3059\uFF09\u3002`;
      module.exports = { PLUS_PRODUCT_NAME, PLUS_PRODUCT_URL, UPSELL_TEXT_BEFORE, UPSELL_TEXT_AFTER, SUBTABLE_NOTICE };
    }
  });

  // src/core/configUi.js
  var require_configUi = __commonJS({
    "src/core/configUi.js"(exports, module) {
      "use strict";
      var C = require_constants();
      var P = require_plusLink();
      var S = require_configSchema();
      var { listLookups } = require_lookupFields();
      function el(doc, tag, className, text) {
        const node = doc.createElement(tag);
        if (className) node.className = className;
        if (text !== void 0) node.textContent = text;
        return node;
      }
      function getBasePath(pathname) {
        const m = /^\/k\/guest\/(\d+)/.exec(pathname || "");
        return m ? `/k/guest/${m[1]}` : "/k";
      }
      function pluginListUrl(pathname, appId, saved) {
        return `${getBasePath(pathname)}/admin/app/${appId}/plugin/${saved ? "?message=CONFIG_SAVED#/" : ""}`;
      }
      function notice(doc, kind, text) {
        return el(doc, "div", `ls-notice ls-notice-${kind}`, text);
      }
      function buildUpsell(doc) {
        const wrap = el(doc, "div", "ls-upsell");
        wrap.appendChild(doc.createTextNode(P.UPSELL_TEXT_BEFORE));
        if (P.PLUS_PRODUCT_URL) {
          const a = el(doc, "a", "", P.PLUS_PRODUCT_NAME);
          a.href = P.PLUS_PRODUCT_URL;
          a.target = "_blank";
          a.rel = "noopener";
          wrap.appendChild(a);
        } else {
          wrap.appendChild(el(doc, "span", "ls-upsell-name", P.PLUS_PRODUCT_NAME));
        }
        wrap.appendChild(doc.createTextNode(P.UPSELL_TEXT_AFTER));
        return wrap;
      }
      function buildColorSelect(doc, value) {
        const select = el(doc, "select", "ls-color kintoneplugin-select");
        C.PALETTE.forEach((p) => {
          const opt = el(doc, "option", "", `\u3000${p.label}\u3000`);
          opt.value = p.value;
          opt.style.backgroundColor = p.value;
          select.appendChild(opt);
        });
        select.value = S.normalizeColor(value);
        const paint = () => {
          select.style.backgroundColor = select.value;
          select.style.borderLeft = `6px solid ${(C.PALETTE.find((p) => p.value === select.value) || C.PALETTE[0]).band}`;
        };
        select.addEventListener("change", paint);
        paint();
        return select;
      }
      function buildModeSelect(doc, value) {
        const select = el(doc, "select", "ls-mode kintoneplugin-select");
        C.MODES.forEach((mode) => {
          const opt = el(doc, "option", "", C.MODE_LABELS[mode]);
          opt.value = mode;
          select.appendChild(opt);
        });
        select.value = S.normalizeMode(value);
        return select;
      }
      function buildCard(doc, lookup, item, readOnly) {
        const card = el(doc, "div", "ls-card");
        card.dataset.code = lookup.code;
        card.appendChild(el(doc, "div", "ls-card-title", `${lookup.label}\uFF08${lookup.code}\uFF09`));
        card.appendChild(el(doc, "div", "ls-card-copy", lookup.copyFieldCodes.length ? `\u30B3\u30D4\u30FC\u5148\uFF1A${lookup.copyFieldCodes.join("\u3001")}` : "\u30B3\u30D4\u30FC\u5148\uFF1A\u306A\u3057"));
        const marker = el(doc, "section", "ls-section ls-section-marker");
        marker.appendChild(el(doc, "h3", "ls-section-title", "\u30AB\u30E9\u30FC\u30DE\u30FC\u30AB\u30FC\uFF08\u30EC\u30B3\u30FC\u30C9\u8A73\u7D30\u753B\u9762\uFF09"));
        marker.appendChild(el(doc, "p", "ls-section-note", "\u30EC\u30B3\u30FC\u30C9\u8A73\u7D30\u753B\u9762\u3067\u3001\u3053\u306E\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u30D5\u30A3\u30FC\u30EB\u30C9\u3068\u30B3\u30D4\u30FC\u5148\u30D5\u30A3\u30FC\u30EB\u30C9\u3092\u540C\u3058\u8272\u3067\u8868\u793A\u3057\u307E\u3059\u3002\u8FFD\u52A0\u30FB\u7DE8\u96C6\u753B\u9762\u306B\u306F\u8868\u793A\u3055\u308C\u307E\u305B\u3093\u3002"));
        const mLabel = el(doc, "label", "ls-check");
        const mCheck = el(doc, "input", "ls-marker-enabled");
        mCheck.type = "checkbox";
        mCheck.checked = item.marker.enabled !== false;
        mLabel.appendChild(mCheck);
        mLabel.appendChild(doc.createTextNode(" \u6709\u52B9"));
        marker.appendChild(mLabel);
        const colorRow = el(doc, "div", "ls-row");
        colorRow.appendChild(el(doc, "span", "ls-row-label", "\u8272"));
        colorRow.appendChild(buildColorSelect(doc, item.marker.color));
        marker.appendChild(colorRow);
        card.appendChild(marker);
        const fetch = el(doc, "section", "ls-section ls-section-fetch");
        fetch.appendChild(el(doc, "h3", "ls-section-title", "\u81EA\u52D5\u53D6\u5F97\uFF08\u8FFD\u52A0\u30FB\u7DE8\u96C6\u753B\u9762\uFF09"));
        fetch.appendChild(el(doc, "p", "ls-section-note", "\u30EC\u30B3\u30FC\u30C9\u306E\u8FFD\u52A0\u30FB\u7DE8\u96C6\u753B\u9762\uFF08PC / \u30E2\u30D0\u30A4\u30EB\uFF09\u3092\u958B\u3044\u305F\u3068\u304D\u3001\u53D6\u5F97\u30BF\u30A4\u30DF\u30F3\u30B0\u306B\u5FDC\u3058\u3066\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u3092\u81EA\u52D5\u3067\u53D6\u5F97\u3057\u307E\u3059\u3002"));
        const fLabel = el(doc, "label", "ls-check");
        const fCheck = el(doc, "input", "ls-fetch-enabled");
        fCheck.type = "checkbox";
        fCheck.checked = item.autoFetch.enabled === true;
        fLabel.appendChild(fCheck);
        fLabel.appendChild(doc.createTextNode(" \u6709\u52B9"));
        fetch.appendChild(fLabel);
        const modeRow = el(doc, "div", "ls-row");
        modeRow.appendChild(el(doc, "span", "ls-row-label", "\u53D6\u5F97\u30BF\u30A4\u30DF\u30F3\u30B0"));
        const modeSelect = buildModeSelect(doc, item.autoFetch.mode);
        modeRow.appendChild(modeSelect);
        fetch.appendChild(modeRow);
        const warning = el(doc, "div", "ls-warning", C.ALWAYS_WARNING);
        const updateWarning = () => {
          warning.hidden = modeSelect.value !== "always";
        };
        modeSelect.addEventListener("change", updateWarning);
        updateWarning();
        fetch.appendChild(warning);
        card.appendChild(fetch);
        if (readOnly) Array.from(card.querySelectorAll("input, select")).forEach((n) => {
          n.disabled = true;
        });
        return card;
      }
      function buildOrphanCard(doc, item, readOnly, onDelete) {
        const card = el(doc, "div", "ls-card ls-card-orphan");
        card.dataset.code = item.lookupFieldCode;
        card.appendChild(el(doc, "div", "ls-card-title", item.lookupFieldCode));
        card.appendChild(el(doc, "div", "ls-orphan-note", "\u30D5\u30A9\u30FC\u30E0\u306B\u898B\u3064\u304B\u308A\u307E\u305B\u3093"));
        const btn = el(doc, "button", "ls-orphan-delete kintoneplugin-button-normal", "\u3053\u306E\u8A2D\u5B9A\u3092\u524A\u9664");
        btn.type = "button";
        btn.disabled = Boolean(readOnly);
        btn.addEventListener("click", () => {
          onDelete(item.lookupFieldCode);
          card.remove();
        });
        card.appendChild(btn);
        return card;
      }
      function collectEdits(root) {
        return Array.from(root.querySelectorAll(".ls-card:not(.ls-card-orphan)")).map((card) => ({
          lookupFieldCode: card.dataset.code,
          subtableCode: null,
          marker: { enabled: card.querySelector(".ls-marker-enabled").checked, color: card.querySelector(".ls-color").value },
          autoFetch: { enabled: card.querySelector(".ls-fetch-enabled").checked, mode: card.querySelector(".ls-mode").value }
        }));
      }
      function renderConfigUi2({ document: doc, loaded, properties, setConfig, appId, pathname, navigate, now }) {
        const root = doc.querySelector(".ls-config");
        const notices = root.querySelector("#ls-notices");
        const cards = root.querySelector("#ls-cards");
        const subtableNotice = root.querySelector("#ls-subtable-notice");
        const upsell = root.querySelector("#ls-upsell");
        const saveBtn = root.querySelector("#ls-save");
        const cancelBtn = root.querySelector("#ls-cancel");
        [notices, cards, subtableNotice, upsell].forEach((n) => {
          while (n.firstChild) n.removeChild(n.firstChild);
        });
        const readOnly = loaded.state === "newer" || loaded.state === "unavailable" || !properties;
        const config = loaded.state === "newer" ? loaded.config : S.normalizeConfig(loaded.config);
        const deleted = [];
        if (loaded.state === "unavailable") {
          notices.appendChild(notice(doc, "error", "\u4FDD\u5B58\u3055\u308C\u3066\u3044\u308B\u8A2D\u5B9A\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30DA\u30FC\u30B8\u3092\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u3053\u306E\u72B6\u614B\u3067\u306F\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\uFF09\u3002"));
        }
        if (loaded.state === "newer") {
          notices.appendChild(notice(doc, "error", `\u65B0\u3057\u3044\u30D0\u30FC\u30B8\u30E7\u30F3\u306E\u8A2D\u5B9A\uFF08version ${loaded.config.version}\uFF09\u304C\u4FDD\u5B58\u3055\u308C\u3066\u3044\u307E\u3059\u3002\u3053\u306E\u30D0\u30FC\u30B8\u30E7\u30F3\u306E\u30D7\u30E9\u30B0\u30A4\u30F3\u3067\u306F\u8868\u793A\u306E\u307F\u3067\u3001\u4FDD\u5B58\u306F\u3067\u304D\u307E\u305B\u3093\u3002`));
        }
        if (loaded.state === "invalid") {
          notices.appendChild(notice(doc, "error", "\u4FDD\u5B58\u3055\u308C\u3066\u3044\u308B\u8A2D\u5B9A\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3053\u306E\u307E\u307E\u4FDD\u5B58\u3059\u308B\u3068\u3001\u8A2D\u5B9A\u306F\u65B0\u3057\u304F\u4F5C\u308A\u76F4\u3055\u308C\u307E\u3059\u3002"));
        }
        if (loaded.state === "migrated" && loaded.from === "lcm-v1") {
          notices.appendChild(notice(doc, "info", "\u65E7 Lookup Color Marker \u306E\u8A2D\u5B9A\u3092\u5F15\u304D\u7D99\u304E\u307E\u3057\u305F\u3002\u4FDD\u5B58\u3059\u308B\u3068\u65B0\u3057\u3044\u5F62\u5F0F\u3067\u4FDD\u5B58\u3055\u308C\u307E\u3059\u3002"));
        }
        const migratedFromPlus = (config.meta && Array.isArray(config.meta.migratedFrom) ? config.meta.migratedFrom : []).includes("plus-v1");
        const hasAlways = (config.items || []).some((it) => it.autoFetch && it.autoFetch.enabled && it.autoFetch.mode === "always");
        const showPlusNotice = migratedFromPlus && hasAlways && !(config.meta && config.meta.noticedPlusAlways);
        if (showPlusNotice) notices.appendChild(notice(doc, "info", C.PLUS_MIGRATION_NOTICE));
        if (!properties) {
          notices.appendChild(notice(doc, "error", "\u30D5\u30A3\u30FC\u30EB\u30C9\u60C5\u5831\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30DA\u30FC\u30B8\u3092\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
        }
        const lookups = listLookups(properties);
        if (properties) {
          lookups.top.forEach((lookup) => {
            const item = S.findItem(config, lookup.code) || S.defaultItem(lookup.code);
            cards.appendChild(buildCard(doc, lookup, S.normalizeItem(item), readOnly));
          });
          const formCodes = new Set(lookups.top.map((l) => l.code));
          (config.items || []).filter((it) => it && it.lookupFieldCode && !it.subtableCode && !formCodes.has(it.lookupFieldCode)).forEach((it) => {
            cards.appendChild(buildOrphanCard(doc, it, readOnly, (code) => deleted.push(code)));
          });
          if (!lookups.top.length) cards.appendChild(el(doc, "p", "ls-empty", "\u3053\u306E\u30A2\u30D7\u30EA\u306B\u306F\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u30D5\u30A3\u30FC\u30EB\u30C9\u304C\u3042\u308A\u307E\u305B\u3093\u3002"));
          if (lookups.subtable.length) subtableNotice.appendChild(el(doc, "p", "ls-subtable-notice", P.SUBTABLE_NOTICE(lookups.subtable.length)));
        }
        upsell.appendChild(buildUpsell(doc));
        saveBtn.disabled = readOnly;
        saveBtn.onclick = () => {
          if (readOnly) return;
          let next = S.applyEdits(config, collectEdits(root));
          deleted.forEach((code) => {
            next = S.removeItem(next, code);
          });
          if (showPlusNotice) next.meta.noticedPlusAlways = true;
          const payload = S.serialize(next, { properties, edition: C.EDITION, now: now || /* @__PURE__ */ new Date() });
          setConfig(payload, () => navigate(pluginListUrl(pathname, appId, true)));
        };
        cancelBtn.onclick = () => navigate(pluginListUrl(pathname, appId, false));
        return { config, readOnly, deleted, lookups };
      }
      module.exports = { renderConfigUi: renderConfigUi2, collectEdits, getBasePath, pluginListUrl, buildColorSelect };
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

  // src/free/config.js
  var { loadConfig } = require_configSchema();
  var { renderConfigUi } = require_configUi();
  var { resolvePluginId } = require_pluginId();
  var PLUGIN_ID = resolvePluginId(typeof kintone !== "undefined" ? kintone : null);
  (async function main() {
    const root = document.querySelector(".ls-config");
    if (!root || typeof kintone === "undefined") return;
    let raw = null;
    let unavailable = false;
    try {
      raw = kintone.plugin.app.getConfig(PLUGIN_ID);
    } catch (e) {
      console.warn("\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u30B5\u30DD\u30FC\u30C8: \u8A2D\u5B9A\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F", e);
      unavailable = true;
    }
    let properties = null;
    try {
      properties = await kintone.app.getFormFields();
    } catch (e) {
      console.warn("\u30EB\u30C3\u30AF\u30A2\u30C3\u30D7\u30B5\u30DD\u30FC\u30C8: \u30D5\u30A3\u30FC\u30EB\u30C9\u60C5\u5831\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F", e);
      properties = null;
    }
    renderConfigUi({
      document,
      loaded: unavailable ? { state: "unavailable", config: loadConfig(null).config } : loadConfig(raw),
      properties,
      setConfig: (payload, done) => kintone.plugin.app.setConfig(payload, done),
      appId: kintone.app.getId(),
      pathname: location.pathname,
      navigate: (url) => {
        location.href = url;
      }
    });
  })();
})();
