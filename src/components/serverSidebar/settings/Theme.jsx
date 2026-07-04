import { For, createSignal, onMount } from "solid-js";
import "./theme.css";
import { tempState } from "../../../App";
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
  const [ownedThemes, setOwnedThemes] = createSignal([]);
  const [purchasingId, setPurchasingId] = createSignal(null);
  const [disowningId, setDisowningId] = createSignal(null);

  async function refreshEnabled() {
    setEnabledThemes(await listThemes());
  }

  const themePath = (theme) =>
    `${import.meta.env.BASE_URL}themes/${theme.file}`;

  async function refreshOwned() {
    const owned = await tempState.rotur.me.getKey("indigo_themes");

    if (!owned) {
      setOwnedThemes([]);
      return;
    }

    setOwnedThemes(
      owned
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    );
  }

  onMount(async () => {

    const res = await fetch(`${import.meta.env.BASE_URL}themes/index.json`);
    setThemes(await res.json());

    await refreshEnabled();
    await refreshOwned();

    setCss(await quickCss());
  });
  const isOwned = (theme) =>
    ownedThemes().includes(theme.id);

  const isEnabled = (theme) =>
    enabledThemes().includes(themePath(theme));

  const toggleTheme = async (theme) => {
    const path = themePath(theme);

    if (isEnabled(theme)) {
      await removeTheme(path);
    } else {
console.log("BASE_URL =", import.meta.env.BASE_URL);
console.log("PATH =", path);
      await addTheme(path);
    }

    await refreshEnabled();
  };
  const grantOwnership = async (theme) => {
    const owned = new Set(ownedThemes());
    owned.add(theme.id);

    await tempState.rotur.me.update(
      "indigo_themes",
      [...owned].join(",")
    );

    await refreshOwned();
  };

  const revokeOwnership = async (theme) => {
    const owned = new Set(ownedThemes());
    owned.delete(theme.id);

    await tempState.rotur.me.update(
      "indigo_themes",
      [...owned].join(",")
    );

    if (isEnabled(theme)) {
      await removeTheme(themePath(theme));
      await refreshEnabled();
    }

    await refreshOwned();
  };

  const buyTheme = async (theme) => {
    if (!theme.price) {
      await grantOwnership(theme);
      return;
    }

    const confirmed = window.confirm(
      `Buy "${theme.name}" for ${theme.price} RC?`
    );
    if (!confirmed) return;

    setPurchasingId(theme.id);

    try {
      const balance = await tempState.rotur.me.getKey("sys.currency");

      if (typeof balance !== "number" || balance < theme.price) {
        window.alert("Insufficient balance to purchase this theme.");
        return;
      }

      if (!theme.author) {
        window.alert("This theme has no author set — cannot process purchase.");
        return;
      }

      const authorCut = Math.max(1, Math.floor(theme.price * 0.8));
      const orionCut = theme.price - authorCut;

      const authorTx = await tempState.rotur.me.transfer(
        theme.author,
        authorCut,
        `buy theme: ${theme.id}`
      );
      if (!authorTx) {
        window.alert("Purchase failed during payment to the theme author. Please try again.");
        return;
      }

      const orionTx = await tempState.rotur.me.transfer(
        "orion",
        orionCut,
        `buy theme: ${theme.id}`
      );
      if (!orionTx) {
        window.alert("Purchase partially failed. Please contact support.");
        return;
      }

      await grantOwnership(theme);
    } catch (err) {
      console.error("Theme purchase failed:", err);
      window.alert("Something went wrong during the purchase. Please try again.");
    } finally {
      setPurchasingId(null);
    }
  };

  const disownTheme = async (e, theme) => {
    e.stopPropagation();

    if (disowningId() === theme.id) return;

    if (theme.price) {
      const confirmed = window.confirm(
        `Disown "${theme.name}"? You paid ${theme.price} RC for it and this cannot be refunded.`
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(`Disown "${theme.name}"?`);
      if (!confirmed) return;
    }

    setDisowningId(theme.id);

    try {
      await revokeOwnership(theme);
    } catch (err) {
      console.error("Failed to disown theme:", err);
      window.alert("Something went wrong while disowning this theme. Please try again.");
    } finally {
      setDisowningId(null);
    }
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
                      {isEnabled(theme)
                        ? <HiOutlineCheck />
                        : isOwned(theme)
                          ? <HiOutlineCheck />
                          : theme.price
                            ? `${theme.price} RC`
                            : "Free"}
                    </div>

                    <input
                      type="button"
                      class="getbtn"
                      disabled={purchasingId() === theme.id}
                      value={
                        purchasingId() === theme.id
                          ? "Processing..."
                          : !isOwned(theme)
                            ? "Get"
                            : isEnabled(theme)
                              ? "Disable"
                              : "Apply"
                      }
                      onClick={(e) => {
                        e.stopPropagation();

                        if (purchasingId() === theme.id) return;

                        if (!isOwned(theme)) {
                          buyTheme(theme);
                        } else {
                          toggleTheme(theme);
                        }
                      }}
                    />
                  </div>
                </div>

                {theme.description && (
                  <p>{theme.description}
                    {isOwned(theme) && (
                      <a
                        href="#"
                        onClick={(e) => disownTheme(e, theme)}
                      >
                        {disowningId() === theme.id
                          ? " Disowning..."
                          : " Disown"}
                      </a>
                    )}
                  </p>
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