import { createSignal, onMount, Show } from "solid-js";
import "./versionupdate.css";
import { setState, state } from "../../../state";

let versionCheckPromise;

function getLatestVersion() {
  if (!versionCheckPromise) {
    versionCheckPromise = fetch("version.json", {
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (!data?.version) return null;
        return String(data.version);
      })
      .catch((error) => {
        versionCheckPromise = undefined;
        console.error("Failed to check application version:", error);
        return null;
      });
  }

  return versionCheckPromise;
}

function compareVersions(current, latest) {
  const a = String(current).split(".").map(Number);
  const b = String(latest).split(".").map(Number);
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;

    if (x < y) return -1;
    if (x > y) return 1;
  }

  return 0;
}

function getVersionDifference(current, latest) {
  const a = current.split(".").map(Number);
  const b = latest.split(".").map(Number);
  const length = Math.max(a.length, b.length);
  let differences = 0;

  for (let i = 0; i < length; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) {
      differences++;
    }
  }

  return differences;
}

export async function isVersionOutdated() {
  const latest = await getLatestVersion();
  const current = state.settings.version;

  if (current == null || latest == null) return false;

  return compareVersions(current, latest) < 0;
}

export default function VersionUpdate(props) {
  const [latestVersion, setLatestVersion] = createSignal("");
  const [currentVersion, setCurrentVersion] = createSignal("");
  const [isUpdateAvailable, setIsUpdateAvailable] = createSignal(false);

  onMount(async () => {
    const latest = await getLatestVersion();
    const current = state.settings.version;

    if (current == null || latest == null) return;

    setCurrentVersion(String(current));
    setLatestVersion(latest);
    setIsUpdateAvailable(compareVersions(current, latest) < 0);
  });

  return (
    <Show when={isUpdateAvailable()}>
      <div class="version-update">
        <div class="version-update-content">
          <h3>Your client is outdated</h3>

          <p class="version-update-description">
            Your client has{" "}
            {getVersionDifference(currentVersion(), latestVersion())} differing
            version component(s). (Indigo v{currentVersion()} to v
            {latestVersion()})
          </p>

          <button
            class="version-update-button"
            onClick={() => {
              setState("settings", "version", latestVersion());
              props.clearCacheAndReload();
            }}
          >
            Apply v{latestVersion()} now
          </button>
        </div>

        <img
          class="fill version-update-artwork"
          src="/updaterIcon.svg"
          alt=""
        />
      </div>
    </Show>
  );
}
