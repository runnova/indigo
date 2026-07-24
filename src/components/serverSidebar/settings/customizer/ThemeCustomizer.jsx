import { createSignal, onMount, For } from "solid-js";
import { quickCss, setQuickCss } from "../../../../themeManager";
import "./style.css";

const START_MARKER = "/* @indigo-custom-theme start */";
const END_MARKER = "/* @indigo-custom-theme end */";

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

function spliceBlockIntoCss(fullCss, newBlock) {
  const startIdx = fullCss.indexOf(START_MARKER);
  const endIdx = fullCss.indexOf(END_MARKER);

  if (startIdx !== -1 && endIdx !== -1) {
    const before = fullCss.slice(0, startIdx);
    const after = fullCss.slice(endIdx + END_MARKER.length);
    return `${before}${newBlock}${after}`;
  }

  const trimmed = fullCss.trimEnd();
  if (trimmed.length === 0) return newBlock + "\n";
  return `${trimmed}\n\n${newBlock}\n`;
}

function defaultValues() {
  const values = {};
  GROUPS.forEach((group) => group.vars.forEach((v) => (values[v.key] = v.default)));
  return values;
}

export default function ThemeCustomizer() {
  const [values, setValues] = createSignal(defaultValues());
  const [fullCss, setFullCss] = createSignal("");
  const [saved, setSaved] = createSignal(true);

  onMount(async () => {
    const css = (await quickCss()) ?? "";
    setFullCss(css);

    const startIdx = css.indexOf(START_MARKER);
    const endIdx = css.indexOf(END_MARKER);

    if (startIdx !== -1 && endIdx !== -1) {
      const block = css.slice(startIdx, endIdx + END_MARKER.length);
      setValues({ ...defaultValues(), ...extractValuesFromBlock(block) });
    }
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

  const save = async () => {
    const block = buildThemeBlock(values());
    const spliced = spliceBlockIntoCss(fullCss(), block);
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
    setValues(defaultValues());
    setSaved(false);
  };

  const previewStyle = () => ({
    "--tc-p-bg-one": values()["--bg-one"],
    "--tc-p-fg-one": values()["--fg-one"],
    "--tc-p-fg-two": values()["--fg-two"],
    "--tc-p-hl-one": values()["--hl-one"],
    "--tc-p-hl-three": values()["--hl-three"]
  });

  return (
    <>
      <h2 class="settings_title">Customize Colors</h2>
      <p class="settings_subt">
        Edit colors manually using color inputs.
      </p>



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
          <button class="tc-save" onClick={save}>
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