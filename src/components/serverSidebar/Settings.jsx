import { createSignal, For, onMount } from "solid-js";
import { Dynamic } from "solid-js/web";
import { setState, state } from "../../App";

import {
  HiOutlineCog6Tooth,
  HiOutlineUser,
  HiOutlineBell,
  HiOutlinePaintBrush,
  HiOutlineShieldCheck,
} from "solid-icons/hi";

import ThemeSettings from "./settings/Theme"
import appIcon from "/icon_small.svg"

function AppIcon(props) {
  return <img src={appIcon} alt="" {...props} />;
}

function GeneralSettings() {
  function SettingInput(props) {
    return (
      <input
        class="settings_input"
        value={state.settings[props.setting]}
        onInput={(e) =>
          setState("settings", props.setting, e.currentTarget.value)
        }
      />
    );
  }
  function SettingCheckbox(props) {
    return (
      <input
        class="settings_input"
        type="checkbox"
        checked={state.settings[props.setting]}
        onChange={(e) =>
          setState("settings", props.setting, e.currentTarget.checked)
        }
      />
    );
  }
  function SettingSelect(props) {
    return (
      <select
        class="settings_input"
        value={state.settings[props.setting]}
        onChange={(e) =>
          setState("settings", props.setting, e.currentTarget.value)
        }
        disabled={props.disabled}
      >
        {props.children}
      </select>
    );
  }
  return (
    <>
      <h2 class="settings_title">General</h2>

      <div class="settings_item x">
        <div class="settings_section_label">DMs server</div>
        <SettingInput setting="dmsServer" />
      </div>

      <div class="settings_item x">
        <div class="settings_section_label">Profile Overlays</div>
        <SettingCheckbox setting="profileOverlays" />
      </div>

      <div class="settings_item x">
        <div class="settings_section_label">Send typing status</div>
        <SettingCheckbox setting="sendTypingStatus" />
      </div>
      <div class="settings_item x">
        <div class="settings_section_label">Parse markdown in messages</div>
        <SettingCheckbox setting="parseMarkdown" />
      </div>
      <div class="settings_item x">
        <div class="settings_section_label">Temporarily keep deleted messages</div>
        <SettingCheckbox setting="messageLogger" />
      </div>

      <h2 class="settings_title">Performance</h2>

      <div class="settings_item x">
        <div class="settings_section_label">Idle connections</div>
        <SettingSelect setting="idleConnections" disabled>
          <option value="keep">Keep connected</option>
          <option value="none">No idle connections</option>
          <option value="dms">Keep DMs connected</option>
        </SettingSelect>
      </div>

      <div class="settings_item x">
        <div class="settings_section_label">Load attachments</div>
        <SettingSelect setting="loadAttachments" disabled>
          <option value="all">Load everything</option>
          <option value="ondemand">Load on demand</option>
          <option value="whitelist">Server whitelist</option>
        </SettingSelect>
      </div>

      <div class="settings_item x">
        <div class="settings_section_label">Preload channels on hover</div>
        <SettingCheckbox setting="channelPreload" />
      </div>

      <h2 class="settings_title">Identity</h2>

      <div class="settings_item x">
        <div class="settings_section_label">Show Nicknames</div>
        <SettingSelect setting="showNicknames" disabled>
          <option value="nickname">Nickname</option>
          <option value="nickname_username">Nickname (Username)</option>
          <option value="username">Username</option>
        </SettingSelect>
      </div>

      <div class="settings_item x">
        <div class="settings_section_label">Messages from blocked users</div>
        <SettingSelect setting="blockedMessages" disabled>
          <option value="collapsed">Show collapsed</option>
          <option value="show">Always Show</option>
          <option value="hide">Always Hide</option>
        </SettingSelect>
      </div>

      <div class="settings_item x">
        <div class="settings_section_label">Owner crown</div>
        <SettingCheckbox setting="ownerCrown" />
      </div>
      <div class="settings_item x">
        <div class="settings_section_label">Display channel name above display name</div>
        <SettingCheckbox setting="displayChannelName" />
      </div>
    </>
  );
}

function AboutSettings() {
  onMount(
    window.roturEmbed.scan);
  return (
    <>
      <h2>Indigo Client</h2>
      <p>
        The cooler <a href="https://originchats.com">OriginChats</a> client. Currently under development.


      </p><p>Licensed under MPL 3.0. You can <a href="https://github.com/runnova/indigo/pulls">contribute</a>  too! issues go <a href="https://github.com/runnova/indigo/issues">here</a>.</p>
      <div data-rotur-tip="darkdot" data-amount="1"></div>
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
    id: "themes",
    title: "Themes",
    icon: HiOutlinePaintBrush,
    component: ThemeSettings,
  },
  {
    id: "about",
    title: "About",
    icon: AppIcon,
    component: AboutSettings,
  },
  // {
  //   id: "appearance",
  //   title: "Appearance",
  //   icon: HiOutlinePaintBrush,
  //   component: AppearanceSettings,
  // },
  // {
  //   id: "security",
  //   title: "Security",
  //   icon: HiOutlineShieldCheck,
  //   component: SecuritySettings,
  // },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = createSignal("general");

  const currentTab = () =>
    tabs.find((tab) => tab.id === activeTab());

  return (
    <div class="fill x" style={{ "height": "100%" }}>
      <nav class="y" style={{ "gap": ".3em", "padding": ".5em", "background-color": "var(--bg-two)", "min-width": "200px" }}>
        <For each={tabs}>
          {(tab) => {
            const Icon = tab.icon;

            return (
              <button
                type="button"
                onClick={() => setActiveTab(tab.id)}
                class={`icon_button text ${activeTab() === tab.id ? "active" : ""
                  }`}
              >
                <Icon class="tab-icon" />
                <span>{tab.title}</span>
              </button>
            );
          }}
        </For>
      </nav>

      <main class="fill settings_content" style={{ "padding": "0 2em" }}>
        <Dynamic component={currentTab()?.component} />
      </main>
    </div>
  );
}