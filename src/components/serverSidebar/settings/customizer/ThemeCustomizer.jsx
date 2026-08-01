import { createSignal, onMount, For } from "solid-js";
import { quickCss, setQuickCss } from "../../../../themeManager";
import "./style.css";

const START_MARKER = "/* @indigo-custom-theme start */";
const END_MARKER = "/* @indigo-custom-theme end */";

const FONT_START_MARKER = "/* @indigo-custom-font start */";
const FONT_END_MARKER = "/* @indigo-custom-font end */";

const SYSTEM_FONT_VALUE = "system-default";
const DEFAULT_FONT_SIZE = "16px";

const FONT_OPTIONS = [
  { id: SYSTEM_FONT_VALUE, label: "System Font", family: null, googleName: null },
  { id: "inter", label: "Inter", family: "'Inter', sans-serif", googleName: "Inter:wght@400;500;600;700" },
  { id: "roboto", label: "Roboto", family: "'Roboto', sans-serif", googleName: "Roboto:wght@400;500;700" },
  { id: "poppins", label: "Poppins", family: "'Poppins', sans-serif", googleName: "Poppins:wght@400;500;600;700" },
  { id: "jetbrains-mono", label: "JetBrains Mono", family: "'JetBrains Mono', monospace", googleName: "JetBrains+Mono:wght@400;500;700" },
  { id: "lora", label: "Lora", family: "'Lora', serif", googleName: "Lora:wght@400;500;600;700" },
  { id: "open-sans", label: "Open Sans", family: "'Open Sans', sans-serif", googleName: "Open+Sans:wght@400;500;600;700" },
  { id: "montserrat", label: "Montserrat", family: "'Montserrat', sans-serif", googleName: "Montserrat:wght@400;500;600;700" },
  { id: "nunito", label: "Nunito", family: "'Nunito', sans-serif", googleName: "Nunito:wght@400;500;600;700" },
  { id: "nunito-sans", label: "Nunito Sans", family: "'Nunito Sans', sans-serif", googleName: "Nunito+Sans:wght@400;500;600;700" },
  { id: "raleway", label: "Raleway", family: "'Raleway', sans-serif", googleName: "Raleway:wght@400;500;600;700" },
  { id: "work-sans", label: "Work Sans", family: "'Work Sans', sans-serif", googleName: "Work+Sans:wght@400;500;600;700" },
  { id: "manrope", label: "Manrope", family: "'Manrope', sans-serif", googleName: "Manrope:wght@400;500;600;700" },
  { id: "outfit", label: "Outfit", family: "'Outfit', sans-serif", googleName: "Outfit:wght@400;500;600;700" },
  { id: "sora", label: "Sora", family: "'Sora', sans-serif", googleName: "Sora:wght@400;500;600;700" },
  { id: "dm-sans", label: "DM Sans", family: "'DM Sans', sans-serif", googleName: "DM+Sans:wght@400;500;600;700" },
  { id: "space-grotesk", label: "Space Grotesk", family: "'Space Grotesk', sans-serif", googleName: "Space+Grotesk:wght@400;500;600;700" },
  { id: "plus-jakarta-sans", label: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', sans-serif", googleName: "Plus+Jakarta+Sans:wght@400;500;600;700" },
  { id: "lexend", label: "Lexend", family: "'Lexend', sans-serif", googleName: "Lexend:wght@400;500;600;700" },
  { id: "rubik", label: "Rubik", family: "'Rubik', sans-serif", googleName: "Rubik:wght@400;500;600;700" },
  { id: "karla", label: "Karla", family: "'Karla', sans-serif", googleName: "Karla:wght@400;500;600;700" },
  { id: "figtree", label: "Figtree", family: "'Figtree', sans-serif", googleName: "Figtree:wght@400;500;600;700" },
  { id: "urbanist", label: "Urbanist", family: "'Urbanist', sans-serif", googleName: "Urbanist:wght@400;500;600;700" },
  { id: "quicksand", label: "Quicksand", family: "'Quicksand', sans-serif", googleName: "Quicksand:wght@400;500;600;700" },
  { id: "mulish", label: "Mulish", family: "'Mulish', sans-serif", googleName: "Mulish:wght@400;500;600;700" },
  { id: "cabin", label: "Cabin", family: "'Cabin', sans-serif", googleName: "Cabin:wght@400;500;600;700" },
  { id: "barlow", label: "Barlow", family: "'Barlow', sans-serif", googleName: "Barlow:wght@400;500;600;700" },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", family: "'IBM Plex Sans', sans-serif", googleName: "IBM+Plex+Sans:wght@400;500;600;700" },
  { id: "ibm-plex-mono", label: "IBM Plex Mono", family: "'IBM Plex Mono', monospace", googleName: "IBM+Plex+Mono:wght@400;500;600;700" },
  { id: "fira-code", label: "Fira Code", family: "'Fira Code', monospace", googleName: "Fira+Code:wght@400;500;600;700" },
  { id: "source-code-pro", label: "Source Code Pro", family: "'Source Code Pro', monospace", googleName: "Source+Code+Pro:wght@400;500;600;700" },
  { id: "playfair-display", label: "Playfair Display", family: "'Playfair Display', serif", googleName: "Playfair+Display:wght@400;500;600;700" },
  { id: "merriweather", label: "Merriweather", family: "'Merriweather', serif", googleName: "Merriweather:wght@400;700" },
  { id: "pt-serif", label: "PT Serif", family: "'PT Serif', serif", googleName: "PT+Serif:wght@400;700" },
  { id: "crimson-pro", label: "Crimson Pro", family: "'Crimson Pro', serif", googleName: "Crimson+Pro:wght@400;500;600;700" },
  { id: "libre-baskerville", label: "Libre Baskerville", family: "'Libre Baskerville', serif", googleName: "Libre+Baskerville:wght@400;700" },
  { id: "josefin-sans", label: "Josefin Sans", family: "'Josefin Sans', sans-serif", googleName: "Josefin+Sans:wght@400;500;600;700" },
  { id: "comfortaa", label: "Comfortaa", family: "'Comfortaa', sans-serif", googleName: "Comfortaa:wght@400;500;600;700" },
  { id: "archivo", label: "Archivo", family: "'Archivo', sans-serif", googleName: "Archivo:wght@400;500;600;700" },
  { id: "epilogue", label: "Epilogue", family: "'Epilogue', sans-serif", googleName: "Epilogue:wght@400;500;600;700" },
  { id: "red-hat-display", label: "Red Hat Display", family: "'Red Hat Display', sans-serif", googleName: "Red+Hat+Display:wght@400;500;600;700" }
];

const GROUPS = [
  {
    id: "highlights",
    label: "Highlights",
    comment: "Highlights",
    vars: [
      { key: "--hl-one", label: "Highlight 1", default: "rgb(141, 42, 255)" },
      { key: "--hl-two", label: "Highlight 2", default: "rgb(207, 164, 255)" },
      { key: "--hl-three", label: "Highlight 3", default: "rgb(84, 0, 180)" },
      { key: "--hl-four", label: "Highlight 4", default: "rgb(45 29 63)" }
    ]
  },
  {
    id: "bg",
    label: "Background",
    comment: "Background",
    vars: [
      { key: "--bg-one", label: "Background 1", default: "#010101" },
      { key: "--bg-two", label: "Background 2", default: "#0D0D0D" },
      { key: "--bg-three", label: "Background 3", default: "#1d1d1d" },
      { key: "--bg-four", label: "Background 4", default: "#3a3a3a" }
    ]
  },
  {
    id: "fg",
    label: "Foreground",
    comment: "Foreground",
    vars: [
      { key: "--fg-one", label: "Foreground 1", default: "#ffffff" },
      { key: "--fg-two", label: "Foreground 2", default: "#ffffff7a" },
      { key: "--fg-dim", label: "Foreground Dim", default: "#ffffffb7" },
      { key: "--fg-three", label: "Foreground 3", default: "rgb(207, 164, 255)" }
    ]
  }
];

function clamp255(n) {
  return Math.min(255, Math.max(0, n));
}

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  let a = 1;
  if (h.length >= 8) a = parseInt(h.slice(6, 8), 16) / 255;
  return { r, g, b, a };
}

function rgbToHex(r, g, b) {
  const toHex = (n) => clamp255(Math.round(n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function parseColorValue(value) {
  if (!value) return { hex: "#000000", alpha: 1 };
  const v = value.trim();

  if (v.startsWith("#")) {
    const { r, g, b, a } = hexToRgb(v);
    return { hex: rgbToHex(r, g, b), alpha: a };
  }

  const match = v.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].split(/[\s,\/]+/).filter(Boolean).map((p) => p.trim());
    const [r, g, b, a] = parts;
    return {
      hex: rgbToHex(parseFloat(r), parseFloat(g), parseFloat(b)),
      alpha: a !== undefined ? parseFloat(a) : 1
    };
  }

  return { hex: "#000000", alpha: 1 };
}

function serializeColorValue(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  if (alpha >= 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(2))})`;
}

function buildThemeBlock(values) {
  const lines = [START_MARKER, ":root {"];
  GROUPS.forEach((group, i) => {
    lines.push(`  /* ${group.comment} */`);
    group.vars.forEach((v) => lines.push(`  ${v.key}: ${values[v.key]};`));
    if (i < GROUPS.length - 1) lines.push("");
  });
  lines.push("}", END_MARKER);
  return lines.join("\n");
}

function extractValuesFromBlock(block) {
  const values = {};
  const varRegex = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match;
  while ((match = varRegex.exec(block)) !== null) {
    values[match[1]] = match[2].trim();
  }
  return values;
}

function spliceBlockIntoCss(fullCss, newBlock, marker) {
  const [START, END] = marker;
  const startIdx = fullCss.indexOf(START);
  const endIdx = fullCss.indexOf(END);

  if (startIdx !== -1 && endIdx !== -1) {
    const before = fullCss.slice(0, startIdx);
    const after = fullCss.slice(endIdx + END.length);
    return `${before}${newBlock}${after}`;
  }

  const trimmed = fullCss.trimEnd();
  if (trimmed.length === 0) return newBlock + "\n";
  return `${trimmed}\n\n${newBlock}\n`;
}

function hardcodedDefaultValues() {
  const values = {};
  GROUPS.forEach((group) => group.vars.forEach((v) => (values[v.key] = v.default)));
  return values;
}

function currentComputedValues() {
  const values = {};
  if (typeof window === "undefined" || typeof document === "undefined") {
    return hardcodedDefaultValues();
  }
  const styles = getComputedStyle(document.documentElement);
  GROUPS.forEach((group) => {
    group.vars.forEach((v) => {
      const raw = styles.getPropertyValue(v.key)?.trim();
      values[v.key] = raw && raw.length > 0 ? raw : v.default;
    });
  });
  return values;
}

function currentComputedFontSize() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_FONT_SIZE;
  }
  const styles = getComputedStyle(document.documentElement);
  const raw = styles.getPropertyValue("--font-size")?.trim();
  if (raw) return raw;
  const mainEl = document.querySelector(".main");
  if (mainEl) {
    const size = getComputedStyle(mainEl).fontSize;
    if (size) return size;
  }
  return DEFAULT_FONT_SIZE;
}

function buildFontBlock(fontId, fontSize) {
  const font = FONT_OPTIONS.find((f) => f.id === fontId) ?? FONT_OPTIONS[0];

  const lines = [FONT_START_MARKER];
  let hasImport = false;

  if (font.family) {
    const importUrl = `https://fonts.googleapis.com/css2?family=${font.googleName}&display=swap`;
    lines.push(`@import url('${importUrl}');`, "");
    hasImport = true;
  }

  const declarations = [];
  if (font.family) declarations.push(`  font-family: ${font.family};`);
  if (fontSize) declarations.push(`  font-size: ${fontSize};`);

  if (declarations.length === 0) {
    return "";
  }

  lines.push(".main {", ...declarations, "}", FONT_END_MARKER);
  return lines.join("\n");
}

function spliceFontBlockIntoCss(fullCss, newBlock) {
  const startIdx = fullCss.indexOf(FONT_START_MARKER);
  const endIdx = fullCss.indexOf(FONT_END_MARKER);

  let base = fullCss;
  if (startIdx !== -1 && endIdx !== -1) {
    const before = fullCss.slice(0, startIdx);
    const after = fullCss.slice(endIdx + FONT_END_MARKER.length);
    base = `${before}${after}`;
  }

  base = base.replace(/^\s*\n/, "").trimStart();

  if (!newBlock) return base;

  const trimmed = base.trimEnd();
  if (trimmed.length === 0) return newBlock + "\n";
  return `${newBlock}\n\n${trimmed}\n`;
}

function extractFontIdFromCss(fullCss) {
  const startIdx = fullCss.indexOf(FONT_START_MARKER);
  const endIdx = fullCss.indexOf(FONT_END_MARKER);
  if (startIdx === -1 || endIdx === -1) return SYSTEM_FONT_VALUE;

  const block = fullCss.slice(startIdx, endIdx + FONT_END_MARKER.length);
  const match = block.match(/font-family:\s*([^;]+);/i);
  if (!match) return SYSTEM_FONT_VALUE;

  const familyValue = match[1].trim();
  const found = FONT_OPTIONS.find((f) => f.family === familyValue);
  return found ? found.id : SYSTEM_FONT_VALUE;
}

function extractFontSizeFromCss(fullCss) {
  const startIdx = fullCss.indexOf(FONT_START_MARKER);
  const endIdx = fullCss.indexOf(FONT_END_MARKER);
  if (startIdx === -1 || endIdx === -1) return null;

  const block = fullCss.slice(startIdx, endIdx + FONT_END_MARKER.length);
  const match = block.match(/font-size:\s*([^;]+);/i);
  return match ? match[1].trim() : null;
}

function parseFontSizePx(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 16;
}

export default function ThemeCustomizer() {
  const [values, setValues] = createSignal(hardcodedDefaultValues());
  const [fullCss, setFullCss] = createSignal("");
  const [fontId, setFontId] = createSignal(SYSTEM_FONT_VALUE);
  const [fontSize, setFontSize] = createSignal(DEFAULT_FONT_SIZE);
  const [saved, setSaved] = createSignal(true);

  onMount(async () => {
    const css = (await quickCss()) ?? "";
    setFullCss(css);

    const startIdx = css.indexOf(START_MARKER);
    const endIdx = css.indexOf(END_MARKER);

    if (startIdx !== -1 && endIdx !== -1) {
      const block = css.slice(startIdx, endIdx + END_MARKER.length);
      setValues({ ...currentComputedValues(), ...extractValuesFromBlock(block) });
    } else {
      setValues(currentComputedValues());
    }

    setFontId(extractFontIdFromCss(css));

    const savedFontSize = extractFontSizeFromCss(css);
    setFontSize(savedFontSize ?? currentComputedFontSize());
  });

  const updateVar = (key, cssValue) => {
    setValues((prev) => ({ ...prev, [key]: cssValue }));
    setSaved(false);
  };

  const onHexInput = (key, hex) => {
    const current = parseColorValue(values()[key]);
    updateVar(key, serializeColorValue(hex, current.alpha));
  };

  const onAlphaInput = (key, alpha) => {
    const current = parseColorValue(values()[key]);
    updateVar(key, serializeColorValue(current.hex, alpha));
  };

  const onFontChange = (id) => {
    setFontId(id);
    setSaved(false);
  };

  const onFontSizeChange = (px) => {
    setFontSize(`${px}px`);
    setSaved(false);
  };

  const saveAll = async () => {
    const themeBlock = buildThemeBlock(values());
    let spliced = spliceBlockIntoCss(fullCss(), themeBlock, [START_MARKER, END_MARKER]);

    const fontBlock = buildFontBlock(fontId(), fontSize());
    spliced = spliceFontBlockIntoCss(spliced, fontBlock);

    await setQuickCss(spliced);
    setFullCss(spliced);
    setSaved(true);
  };

  const resetGroup = (group) => {
    setValues((prev) => {
      const next = { ...prev };
      group.vars.forEach((v) => (next[v.key] = v.default));
      return next;
    });
    setSaved(false);
  };

  const resetAll = () => {
    setValues(hardcodedDefaultValues());
    setFontId(SYSTEM_FONT_VALUE);
    setFontSize(DEFAULT_FONT_SIZE);
    setSaved(false);
  };

  return (
    <>
      <h2 class="settings_title">Customize Indigo</h2>
      <p class="settings_subt">
        Edit below inputs to match what you think indigo should look like.
      </p>

      <div class="tc-group">
        <div class="tc-group-header">
          <h3>Font</h3>
        </div>

        <div class="tc-row">
          <div class="tc-row-info">
            <span class="tc-row-name">Interface Font</span>
            <span class="tc-row-key">.main</span>
          </div>

          <select
            class="settings_input"
            value={fontId()}
            onChange={(e) => onFontChange(e.currentTarget.value)}
          >
            <For each={FONT_OPTIONS}>
              {(font) => <option value={font.id}>{font.label}</option>}
            </For>
          </select>
        </div>

        <div class="tc-row">
          <div class="tc-row-info">
            <span class="tc-row-name">Font Size</span>
            <span class="tc-row-key">.main</span>
          </div>

          <div class="tc-alpha">
            <input
              type="range"
              min="10"
              max="24"
              step="1"
              value={parseFontSizePx(fontSize())}
              onInput={(e) => onFontSizeChange(e.currentTarget.value)}
            />
            <span class="tc-alpha-value">{fontSize()}</span>
          </div>
        </div>
      </div>

      <For each={GROUPS}>
        {(group) => (
          <div class="tc-group">
            <div class="tc-group-header">
              <h3>{group.label}</h3>
              <button class="tc-reset" onClick={() => resetGroup(group)}>
                Reset
              </button>
            </div>

            <For each={group.vars}>
              {(v) => {
                const parsed = () => parseColorValue(values()[v.key]);
                return (
                  <div class="tc-row">
                    <button class="tc-swatch-btn" title={`Choose ${v.label}`}>
                      <span
                        class="tc-swatch-fill"
                        style={{
                          background: values()[v.key],
                          opacity: 1
                        }}
                      />
                      <input
                        type="color"
                        value={parsed().hex}
                        onInput={(e) => onHexInput(v.key, e.currentTarget.value)}
                      />
                    </button>

                    <div class="tc-row-info">
                      <span class="tc-row-name">{v.label}</span>
                      <span class="tc-row-key">{v.key}</span>
                    </div>

                    <div class="tc-alpha">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={parsed().alpha}
                        onInput={(e) =>
                          onAlphaInput(v.key, parseFloat(e.currentTarget.value))
                        }
                      />
                      <span class="tc-alpha-value">
                        {Math.round(parsed().alpha * 100)}%
                      </span>
                    </div>

                    <input
                      type="text"
                      class="tc-value-input"
                      value={values()[v.key]}
                      onChange={(e) => updateVar(v.key, e.currentTarget.value)}
                      spellcheck={false}
                    />
                  </div>
                );
              }}
            </For>
          </div>
        )}
      </For>

      {!saved() && (
        <div class="tc-actions">
          <button class="tc-save" onClick={saveAll}>
            Save changes
          </button>
          <button class="tc-reset-all" onClick={resetAll}>
            Reset all
          </button>
          <span class="tc-unsaved-dot" title="Unsaved changes" />
        </div>
      )}
    </>
  );
}