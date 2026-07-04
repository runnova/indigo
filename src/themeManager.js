import { createSignal, createEffect } from "solid-js";

const STORAGE_KEY = "themes";

const saved = JSON.parse(
  localStorage.getItem(STORAGE_KEY) || "{}"
);

const base = import.meta.env.BASE_URL;

const migratedThemes = (saved.themes ?? []).map(href => {
  if (href.startsWith("/themes/")) {
    return `${base}themes/${href.slice("/themes/".length)}`;
  }

  if (href.startsWith("themes/")) {
    return `${base}${href}`;
  }

  return href;
});

const [themes, setThemes] = createSignal(migratedThemes);
const [quickCss, setQuickCss] = createSignal(saved.quickCss ?? "");

const links = new Map();

let quickStyle;

function ensureQuickStyle() {
  if (quickStyle) return quickStyle;

  quickStyle = document.createElement("style");
  quickStyle.id = "quickcss";
  document.head.appendChild(quickStyle);

  return quickStyle;
}

function syncThemes() {
  const active = new Set(themes());

  for (const href of active) {
    if (links.has(href)) continue;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.theme = href;

    document.head.appendChild(link);
    links.set(href, link);
  }

  for (const [href, link] of links) {
    if (active.has(href)) continue;

    link.remove();
    links.delete(href);
  }
}

function syncQuickCss() {
  ensureQuickStyle().textContent = quickCss();
}

createEffect(() => {
  syncThemes();
  syncQuickCss();

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      themes: themes(),
      quickCss: quickCss()
    })
  );
});

export function listThemes() {
  return themes();
}

export function addTheme(href) {
  if (!href) return;

  setThemes(list => {
    if (list.includes(href)) return list;
    return [...list, href];
  });
}

export function removeTheme(href) {
  setThemes(list => list.filter(x => x !== href));
}

export function resetThemes() {
  setThemes([]);
  setQuickCss("");
}

export {
  themes,
  quickCss,
  setQuickCss
};