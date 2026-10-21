import { createSignal, onMount, Show } from "solid-js";
import "./versionupdate.css";
import { HiOutlineArrowRight } from "solid-icons/hi";

export default function VersionUpdate(props) {
  const [latestVersion, setLatestVersion] = createSignal("");
  const [currentVersion, setCurrentVersion] = createSignal("");
  const [isUpdateAvailable, setIsUpdateAvailable] = createSignal(false);

  const compareVersions = (current, latest) => {
    const a = current.split(".").map(Number);
    const b = latest.split(".").map(Number);
    const length = Math.max(a.length, b.length);

    for (let i = 0; i < length; i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;

      if (x < y) return -1;
      if (x > y) return 1;
    }

    return 0;
  };

  onMount(async () => {
    try {
      const response = await fetch("/version.json", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = await response.json();
      const current = props.state.settings.version;
      const latest = String(data.version);

      if (current == null || !latest) return;

      setCurrentVersion(String(current));
      setLatestVersion(latest);
      setIsUpdateAvailable(compareVersions(String(current), latest) < 0);
    } catch (error) {
      console.error("Failed to check application version:", error);
    }
  });

  return (
    <>
    <Show when={isUpdateAvailable()}>
      <div class="version-update">
        <div class="version-update-content">
          <h3>Your client is outdated</h3>

          <p class="version-update-description">
            Your client is {latestVersion() - currentVersion()} version(s) behind.
            </p>

          <button
            class="version-update-button"
            onClick={() => {
              state.settings.version = latestVersion()
              props.clearCacheAndReload()
            }}
          >
            Apply v{latestVersion()} now
          </button>
          <div class="version-update-versions">
              <span>{currentVersion()}</span>
              <HiOutlineArrowRight></HiOutlineArrowRight>
            <span>{latestVersion()}</span>
          </div>
        </div>

          <img class="fill version-update-artwork" src="/updaterIcon.svg" alt="" />
      </div>
      </Show>
    </>
  );
}
