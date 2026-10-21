import { createSignal, Show, For, onMount } from "solid-js";
import { getLoadedAddons, loadAddon, unloadAddon } from "../../../core/addons/AddonsSystem";
import { getAddonPanel } from "../../../core/addons/AddonsUI";
import { renderAddonUIElement } from "../../../core/addons/AddonsUI";
import { persistAddons, loadPersistedAddons, clearAddonData } from "../../../core/addons/AddonPersistence";
import "../../../core/addons/addons.css";
import { HiOutlineXCircle, HiOutlineChevronDown } from "solid-icons/hi";

export function AddonsSettings() {
  const [addonUrl, setAddonUrl] = createSignal("");
  const [loadedAddons, setLoadedAddons] = createSignal([]);
  const [expandedAddon, setExpandedAddon] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(false);

  const [availableAddons, setAvailableAddons] = createSignal([]);
  const [indexError, setIndexError] = createSignal(null);

  const getAddonSrc = (name) => new URL(`addons/${name}.js`, document.baseURI).href;
  const findLoadedBySrc = (name) =>
    loadedAddons().find((a) => a.url === getAddonSrc(name));

  onMount(async () => {
    try {
      setIsLoading(true);

      fetch(new URL("addons/index.json", document.baseURI))
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((list) => setAvailableAddons(list))
        .catch((err) => {
          console.warn("[Settings] Failed to load addon index:", err);
          setIndexError(err.message);
        });

      const persisted = loadPersistedAddons();

      for (const addon of persisted) {
        try {
          await loadAddon(addon.url);
          console.log(`[Settings] Restored addon: ${addon.url}`);
        } catch (error) {
          console.warn(`[Settings] Failed to restore addon ${addon.url}:`, error);
        }
      }

      setLoadedAddons([...getLoadedAddons()]);
    } catch (error) {
      console.error('[Settings] Failed to restore addons:', error);
    } finally {
      setIsLoading(false);
    }
  });

  const installAddon = async (url) => {
    try {
      setIsLoading(true);
      const addonId = await loadAddon(url);
      const updatedAddons = getLoadedAddons();
      setLoadedAddons([...updatedAddons]);
      persistAddons(updatedAddons);
      alert(`Addon loaded successfully: ${addonId}`);
    } catch (error) {
      alert(`Failed to load addon: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadAddon = async () => {
    const url = addonUrl().trim();
    if (!url) {
      alert("Please enter an addon URL");
      return;
    }
    await installAddon(url);
    setAddonUrl("");
  };

  const handleUnloadAddon = (addonId) => {
    if (unloadAddon(addonId)) {
      const updatedAddons = getLoadedAddons();
      setLoadedAddons([...updatedAddons]);
      persistAddons(updatedAddons);
      clearAddonData(addonId);

      if (expandedAddon() === addonId) {
        setExpandedAddon(null);
      }

      alert(`Addon unloaded`);
    }
  };

  const getAddonUIPanel = (addonId) => {
    const panelId = `panel-${addonId}`;
    return getAddonPanel(panelId);
  };

  return (
    <>
      <div class="addon-manager-modal">
        <h2 class="settings_title">Addon Manager</h2>

        <div class="addon-manager-section">
          <h3 class="settings_title">Load Addon</h3>
          <div class="searchbox">
            <input
              type="text"
              placeholder="https://example.com/addon.js"
              value={addonUrl()}
              onInput={(e) => setAddonUrl(e.currentTarget.value)}
              class="addon-manager-input"
              disabled={isLoading()}
            />
            <button
              onClick={handleLoadAddon}
              class="addon-manager-button addon-manager-button-primary"
              disabled={isLoading()}
            >
              {isLoading() ? "Loading..." : "Load"}
            </button>
          </div>
          <div class="addon-manager-section">
            <h3 class="settings_title">Available Addons</h3>
            <Show
              when={availableAddons().length > 0}
              fallback={
                <p class="addon-manager-empty">
                  {indexError() ? `Couldn't load addon list (${indexError()})` : "No addons available"}
                </p>
              }
            >
              <div class="addon-manager-list">
                <For each={availableAddons()}>
                  {(item) => {
                    const installed = () => findLoadedBySrc(item.name);
                    return (
                      <div class="addon-manager-item y">
                        <div class="addon-manager-item-header x">
                          <div class="addon-manager-item-info">
                            <strong>{item.name}</strong>
                            <div class="addon-manager-item-url">{item.desc}</div>
                          </div>

                          <div class="theme-actions">
                            <Show
                              when={installed()}
                              fallback={
                                <button
                                  class="addon-manager-button addon-manager-button-primary"
                                  disabled={isLoading()}
                                  onClick={() => installAddon(getAddonSrc(item.name))}
                                >
                                  Load
                                </button>
                              }
                            >
                              {(addon) => (
                                <button
                                  class="button addon-unload-button"
                                  disabled={isLoading()}
                                  onClick={() => handleUnloadAddon(addon().id)}
                                >
                                  <HiOutlineXCircle />
                                  <span>Unload</span>
                                </button>
                              )}
                            </Show>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </div>

        <div class="addon-manager-section">
          <h3 class="settings_title">
            Loaded Addons
            <Show when={loadedAddons().length > 0}>
              <span class="addon-count"> ({loadedAddons().length})</span>
            </Show>
          </h3>
          <Show
            when={loadedAddons().length > 0}
            fallback={<p class="addon-manager-empty">No addons loaded</p>}
          >
            <div class="addon-manager-list">
              <For each={loadedAddons()}>
                {(addon) => {
                  const isExpanded = () => expandedAddon() === addon.id;
                  const panel = () => getAddonUIPanel(addon.id);
                  const hasUI = () => !!panel();

                  return (
                    <div class="addon-manager-item y" data-addon-id={addon.id}>
                      <div class="addon-manager-item-header x">
                        <div class="addon-manager-item-info">
                          <small class="addon-manager-item-id">{addon.id}</small>
                          <div class="addon-manager-item-url">{addon.url}</div>
                        </div>

                        <div class="theme-actions">
                          <Show when={hasUI()}>
                            <button
                              onClick={() =>
                                setExpandedAddon(isExpanded() ? null : addon.id)
                              }
                              class={`addon-expand-button ${
                                isExpanded() ? "expanded" : ""
                              }`}
                              title={isExpanded() ? "Collapse" : "Expand"}
                            >
                              <HiOutlineChevronDown />
                            </button>
                          </Show>
                          <button
                            onClick={() => handleUnloadAddon(addon.id)}
                            class="button addon-unload-button"
                            title="Unload addon"
                            disabled={isLoading()}
                          >
                            <HiOutlineXCircle />
                            <span>Unload</span>
                          </button>
                        </div>
                      </div>
                      <Show when={isExpanded() && panel()}>
                        {(panelData) => (
                          <div class="addon-manager-item-content">
                            <div class="addon-panel-inline">
                              <div class="addon-panel-inline-content">
                                <For each={panelData().elements}>
                                  {(element) => renderAddonUIElement(element)}
                                </For>
                              </div>
                            </div>
                          </div>
                        )}
                      </Show>

                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </>
  );
}
