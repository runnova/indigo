import { createSignal, For, onMount } from "solid-js";
import { Dynamic } from "solid-js/web";
import { logout, tempState, state, setState } from "../../App";

import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineCog6Tooth,
  HiOutlinePaintBrush,
  HiOutlinePencilSquare,
  HiOutlineUser,
} from "solid-icons/hi";

import ThemeSettings from "./settings/Theme";
import appIcon from "/icon_small.svg";
import Customize from "./settings/Customize.jsx";
import { GeneralSettings } from "./settings/GeneralSettings.jsx";
import { ConfigSettings } from "./settings/ConfigSettings.jsx";

function AppIcon(props) {
  return <img src={appIcon} alt="" {...props} />;
}

function SettingInput(props) {
    return (
        <input
            class="settings_input"
            value={state.settings[props.setting]}
            onInput={(e) => setState("settings", props.setting, e.currentTarget.value)} />
    );
}
function SettingCheckbox(props) {
    return (
        <input
            class="settings_input"
            type="checkbox"
            checked={state.settings[props.setting]}
            onChange={(e) => setState("settings", props.setting, e.currentTarget.checked)} />
    );
}
function SettingSelect(props) {
    return (
        <select
            class="settings_input"
            value={state.settings[props.setting]}
            onChange={(e) => setState("settings", props.setting, e.currentTarget.value)}
            disabled={props.disabled}
        >
            {props.children}
        </select>
    );
}
export { SettingInput, SettingCheckbox, SettingSelect };

function AboutSettings() {
  onMount(window.roturEmbed.scan);
  return (
    <>
      <h2>Indigo Client</h2>
      <p>
        The cooler <a href="https://originchats.com?ref=runnova">OriginChats</a>{" "}
        client, built in SolidJS and vanila Javascript.
      </p>
      <p>
        Licensed under MPL 3.0. You can{" "}
        <a href="https://github.com/runnova/indigo/pulls">contribute</a> too!
        issues go <a href="https://github.com/runnova/indigo/issues">here</a>.
      </p>
      <p>Proudly ships less bugs than official client! ❤️</p>
      <div class="theme-actions">
        <button
          class="hl"
          onclick={() => {
            window.open("https://rotur.dev/pay/darkdot", "_blank");
          }}
        >
          Tip Indigo
        </button>
        <button
          onclick={() => {
            window.open("https://github.com/runnova/indigo", "_blank");
          }}
        >
          View Source
        </button>
        <button
          onclick={() => {
            window.open(
              "https://darkdotblog.blogspot.com/2026/09/how-can-i-help-make-indigo-better.html",
              "_blank",
            );
          }}
        >
          Make indigo better
        </button>
      </div>
    </>
  );
}

function YouSettings() {
  return (
    <>
      <p>Logged in as {tempState.conn.me()?.username}</p>
      <div class="theme-actions">
        <button
          class="hl"
          onclick={() => {
            logout();
          }}
        >
          Log Out or Switch Accounts
        </button>
        <button
          onclick={() => {
            window.open("https://rotur.dev/me/profile", "_blank");
          }}
        >
          Edit Profile
        </button>
      </div>
    </>
  );
}

const tabs = [
  {
    id: "general",
    title: "General",
    icon: HiOutlineCog6Tooth,
    component: GeneralSettings,
  },
  {
    id: "config",
    title: "Client",
    icon: HiOutlineAdjustmentsHorizontal,
    component: ConfigSettings,
  },
  {
    id: "themes",
    title: "Themes",
    icon: HiOutlinePaintBrush,
    component: ThemeSettings,
  },
  {
    id: "customize",
    title: "Customize",
    icon: HiOutlinePencilSquare,
    component: Customize,
  },
  {
    id: "you",
    title: "Account",
    icon: HiOutlineUser,
    component: YouSettings,
  },
  {
    id: "about",
    title: "About",
    icon: AppIcon,
    component: AboutSettings,
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = createSignal("general");

  const currentTab = () => tabs.find((tab) => tab.id === activeTab());

  return (
    <>
      <div className="dialog_header">
        <div
          className="x"
          style={{
            gap: ".3em",
            "align-items": "center",
            "padding-left": ".5em",
          }}
        >
          <HiOutlineCog6Tooth />
          <span>Settings</span>
        </div>
      </div>
      <div class="fill x" style={{ height: "100%" }}>
        <nav
          class="y"
          style={{
            gap: ".3em",
            padding: ".5em",
            "background-color": "var(--bg-two)",
            "min-width": "200px",
          }}
        >
          <For each={tabs}>
            {(tab) => {
              const Icon = tab.icon;

              return (
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  class={`icon_button text ${
                    activeTab() === tab.id ? "active" : ""
                  }`}
                >
                  <Icon class="tab-icon" />
                  <span>{tab.title}</span>
                </button>
              );
            }}
          </For>
        </nav>

        <main class="fill settings_content" style={{ padding: "0 2em" }}>
          <Dynamic component={currentTab()?.component} />
        </main>
      </div>
    </>
  );
}
