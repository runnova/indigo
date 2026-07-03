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

export default function ThemeSettings() {
  const [themes, setThemes] = createSignal([]);
  const [enabledThemes, setEnabledThemes] = createSignal([]);
  const [css, setCss] = createSignal("");

  async function refreshEnabled() {
    setEnabledThemes(await listThemes());
  }

  onMount(async () => {
    const res = await fetch("/themes/index.json");
    setThemes(await res.json());

    await refreshEnabled();
    setCss(await quickCss());
  });

  const isEnabled = (theme) =>
    enabledThemes().includes("/themes/" + theme.file);

  const toggleTheme = async (theme) => {
    const path = "/themes/" + theme.file;

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

  return (
    <>
    <div className="note">
      Paid themes are unavailable.
    </div>
      <h2 class="settings_title">Themes</h2>

      <p class="settings_subt">
        80% of all paid theme revenue go towards their creators.
      </p>

      <div class="theme-actions">
        <button onClick={removeAllThemes}>
          Remove All Themes
        </button>
      </div>

      <div class="theme-grid">
        <For each={themes()}>
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
                      {(isEnabled(theme)) ?
                        <HiOutlineCheck />
                        : (theme.price
                          ? `${theme.price} RC`
                          : "Free")}
                    </div>

                    <input
                      type="button"
                      class="getbtn"
                      value={
                        theme.price
                          ? "Get"
                          : isEnabled(theme)
                            ? "Disable"
                            : "Apply"
                      }
                      disabled={!!theme.price}
                      onClick={(e) => {
                        e.stopPropagation();

                        if (!theme.price) {
                          toggleTheme(theme);
                        }
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
    </>
  );
}