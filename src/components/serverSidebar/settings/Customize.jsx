import { createSignal, onMount } from "solid-js";

import { quickCss, setQuickCss } from "../../../themeManager";
import { mountDomSelector } from "../../utility/Dom-selector.jsx";
import ThemeCustomizer from "./customizer/ThemeCustomizer";

export default function Customize() {
  const [css, setCss] = createSignal("");

  onMount(async () => {
    setCss(await quickCss());
  });

  const saveQuickCss = async () => {
    await setQuickCss(css());
  };

  const resetQuickCss = async () => {
    setCss("");
    await setQuickCss("");
  };

  return (
    <>
      <h2 class="settings_title">Quick CSS</h2>

      <p class="settings_subt">
        Use CSS to restyle Indigo into looking however you want it to.
      </p>

      <textarea
        style={{ "font-family": "monospace", resize: "vertical" }}
        class="quickcss"
        value={css()}
        rows={5}
        onInput={(e) => setCss(e.currentTarget.value)}
      />

      <div class="theme-actions">
        <button class="hl" onClick={saveQuickCss}>
          Save
        </button>
        <button
          onClick={() => {
            mountDomSelector({
              onSelect: (selector, el) => {
                console.log("Selected:", selector, el);
                setCss((prev) => `${prev}\n${selector} {\n  \n}\n`);
              },
              onCancel: () => {
                console.log("Selection cancelled");
              },
            });
          }}
        >
          Select element
        </button>
        <button onClick={resetQuickCss}>Reset</button>
      </div>
      <ThemeCustomizer></ThemeCustomizer>
    </>
  );
}
