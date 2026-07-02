import { For, createSignal, onMount } from "solid-js";
import "./theme.css";

export default function ThemeSettings() {
  const [themes, setThemes] = createSignal([]);

  onMount(async () => {
    const res = await fetch("/themes/index.json");
    setThemes(await res.json());
  });

  return (
    <>
      <h2 class="settings_title">Themes</h2>
      <p className="settings_subt">80% of all paid theme revenue go towards their creators.</p>
      <div class="theme-grid">
        <For each={themes()}>
          {(theme) => (
            <button class="theme-card y">
              <div class="theme-color" style={{"background-color": theme.preview}}></div>
              <div className="data">
                <div className="cols x">
                  <div className="col y">
                    <h3>{theme.name}</h3>
                    {theme.author && <p className="author">by {theme.author}</p>}
                  </div>
                  <div className="col x buyCont">
                    <div className="price"> {(theme.price) ? `${theme.price} RC` : "Free"}</div>
                    <input type="button" class="getbtn" value={(theme.price) ? `Get` : "Apply"} />
                  </div>
                </div>
                {theme.description && <p>{theme.description}</p>}
              </div>
            </button>
          )}
        </For>
      </div>
    </>
  );
}