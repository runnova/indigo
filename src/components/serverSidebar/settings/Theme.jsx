import { For, createSignal, onMount } from "solid-js";
import "./theme.css";
import { HiOutlineCheck } from "solid-icons/hi";

import {
  addTheme,
  removeTheme,
  listThemes,
  resetThemes,
  quickCss,
  setQuickCss
} from "../../../themeManager";
import ThemeCustomizer from "./customizer/ThemeCustomizer";

const afterLastDot = (str) => str.split(".").pop().toUpperCase();

const extensionColors = {
  JS: "#fff07c",
  CSS: "#8dafff"
};

const extensionColor = (file) =>
  extensionColors[afterLastDot(file)] ?? "#888";

export default function ThemeSettings() {
  const [themes, setThemes] = createSignal([]);
  const [enabledThemes, setEnabledThemes] = createSignal([]);
  const [css, setCss] = createSignal("");

  const [section, setSection] = createSignal("themes");

  const filteredThemes = () =>
    themes().filter((theme) => {
      const type = theme.type ?? "style";

      if (section() === "themes") return type === "theme";
      return type !== "theme";
    });

  async function refreshEnabled() {
    setEnabledThemes(await listThemes());
  }

  const themePath = (theme) =>
    `${import.meta.env.BASE_URL}themes/${theme.file}`;

  onMount(async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}themes/index.json`);
    setThemes(await res.json());

    await refreshEnabled();

    setCss(await quickCss());
  });

  const isEnabled = (theme) =>
    enabledThemes().includes(themePath(theme));

  const toggleTheme = async (theme) => {
    const path = themePath(theme);

    if (isEnabled(theme)) {
      await removeTheme(path);
    } else {
      await addTheme(path);
    }

    await refreshEnabled();
  };

  const removeAllThemes = async () => {
    await resetThemes();
    await refreshEnabled();
  };

  const saveQuickCss = async () => {
    await setQuickCss(css());
  };

  const resetQuickCss = async () => {
    setCss("");
    await setQuickCss("");
  };

  const themeCount = () =>
    themes().filter((theme) => (theme.type ?? "style") === "theme").length;

  const modCount = () =>
    themes().filter((theme) => (theme.type ?? "style") !== "theme").length;
  return (
    <>
      <h2 class="settings_title">Themes</h2>

      <p class="settings_subt">
        Select a theme to apply it.
      </p>

      <div class="theme-actions">
        <button onClick={removeAllThemes}>
          Remove All Themes
        </button>
      </div>
      <div class="theme-sections">
        <button
          classList={{ active: section() === "themes" }}
          onClick={() => setSection("themes")}
        >
          Themes <span class="unreaddot">{themeCount()}</span>
        </button>

        <button
          classList={{ active: section() === "mods" }}
          onClick={() => setSection("mods")}
        >
          Mods <span class="unreaddot">{modCount()}</span>
        </button>
      </div>
      {section() === "mods" ? (
        <div class="mod-list">
          <For each={filteredThemes()}>
            {(theme) => (
              <div class="mod-item x">
                <div class="mod-meta">
                  <h3>{theme.name}</h3>

                  {theme.author && (
                    <p class="author">
                      by {theme.author} &bull;{" "}
                      <span
                        style={{
                          color: extensionColor(theme.file)
                        }}
                      >
                        {afterLastDot(theme.file)}
                      </span>
                    </p>
                  )}

                  {theme.description && (
                    <p>{theme.description}</p>
                  )}
                </div>

                <div class="mod-action x">
                  <div class="price">
                    {isEnabled(theme) && <HiOutlineCheck />}
                  </div>

                  <input
                    type="button"
                    class="getbtn"
                    value={isEnabled(theme) ? "Disable" : "Apply"}
                    onClick={() => toggleTheme(theme)}
                  />
                </div>
              </div>
            )}
          </For>
        </div>
      ) : (
        <div class="theme-grid">
          <For each={filteredThemes()}>
            {(theme) => (
              <button class="theme-card y">
                <div
                  class="theme-color"
                  style={{
                    "background-color": theme.preview
                  }}
                />

                <div class="data">
                  <div class="cols x">
                    <div class="col y">
                      <h3>{theme.name}</h3>

                      {theme.author && (
                        <p class="author">
                          by {theme.author}
                        </p>
                      )}
                    </div>

                    <div class="col x buyCont">
                      <div class="price">
                        {isEnabled(theme) && <HiOutlineCheck />}
                      </div>

                      <input
                        type="button"
                        class="getbtn"
                        value={isEnabled(theme) ? "Disable" : "Apply"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTheme(theme);
                        }}
                      />
                    </div>
                  </div>

                  {theme.description && (
                    <p>{theme.description}</p>
                  )}
                </div>
              </button>
            )}
          </For>
        </div>
      )}
      <h2 class="settings_title">
        Quick CSS
      </h2>

      <p class="settings_subt">
        Use CSS to restyle Indigo into looking however you want it to.
      </p>

      <textarea
        class="quickcss"
        value={css()}
        onInput={(e) => setCss(e.currentTarget.value)}
      />

      <div class="theme-actions">
        <button class="hl" onClick={saveQuickCss}>
          Save
        </button>

        <button onClick={resetQuickCss}>
          Reset
        </button>
      </div>
      <ThemeCustomizer></ThemeCustomizer>
    </>
  );
}