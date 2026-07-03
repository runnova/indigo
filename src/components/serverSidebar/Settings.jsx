import { createSignal, For } from "solid-js";
import { Dynamic } from "solid-js/web";

import {
  HiOutlineCog6Tooth,
  HiOutlineUser,
  HiOutlineBell,
  HiOutlinePaintBrush,
  HiOutlineShieldCheck,
} from "solid-icons/hi";

import ThemeSettings from "./settings/Theme"

function GeneralSettings() {
  return (
    <>
    <div className="note">
      None of the general settings is usable yet. I'm working on this. Head to the themes section for the moment.
    </div>
      <h2 class="settings_title">General</h2>
      <div className="settings_item x">
        <div className="settings_section_label">DMs server</div>
        <input class="settings_input" type="text" placeholder="dms.mistium.com" />
      </div>
      <div className="settings_item x">
        <div className="settings_section_label">Profile Overlays</div>
        <input class="settings_input" type="checkbox" />
      </div>
      <h2 class="settings_title">Privacy</h2>
      <div className="settings_item x">
        <div className="settings_section_label">Send typing status</div>
        <input class="settings_input" type="checkbox" />
      </div>

      <h2 class="settings_title">Performance</h2>
      <div className="settings_item x">
        <div className="settings_section_label">Idle connections</div>
        <select name="" id="">
          <option value="Nickname" selected>Keep connected</option>
          <option value="Nickname (Username)">No idle connections</option>
          <option value="Username">Keep DMs connected</option>
        </select>
      </div>
      <div className="settings_item x">
        <div className="settings_section_label">Load attachments</div>
        <select name="" id="">
          <option value="Nickname" selected>Load everything</option>
          <option value="Nickname (Username)">Load on demand</option>
          <option value="Username">Server whitelist</option>
        </select>
      </div>
      <h2 class="settings_title">Identity</h2>
      <div className="settings_item x">
        <div className="settings_section_label">Show Nicknames</div>
        <select name="" id="">
          <option value="Nickname" selected>Nickname</option>
          <option value="Nickname (Username)">Nickname (Username)</option>
          <option value="Username">Username</option>
        </select>
      </div>
      <div className="settings_item x">
        <div className="settings_section_label">Messages from blocked users</div>
        <select name="" id="">
          <option value="Nickname" selected>Show collapsed</option>
          <option value="Nickname (Username)">Always Show</option>
          <option value="Username">Always Hide</option>
        </select>
      </div>
      <div className="settings_item x">
        <div className="settings_section_label">Owner crown</div>
        <input class="settings_input" type="checkbox" />
      </div>

      <h2 class="settings_title">Looks</h2>
      <div className="settings_item x">
        <div className="settings_section_label">Theme Stylesheets</div>
        <input class="settings_input" type="checkbox" />
      </div>
      <hr />
      <div className="settings_item x">
        <div className="settings_section_label">Indigo &bull; By dark dot
        </div>
        <div class="x" style={{"gap": ".2em"}}>
          <input class="settings_input" type="button" value={"Feedback"} />
          <input class="settings_input" type="button" value={"Tip a credit"} /></div>
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
    id: "themes",
    title: "Themes",
    icon: HiOutlinePaintBrush,
    component: ThemeSettings,
  },
  // {
  //   id: "notifications",
  //   title: "Notifications",
  //   icon: HiOutlineBell,
  //   component: NotificationsSettings,
  // },
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
      <nav class="y" style={{ "gap":".3em","padding": ".5em", "background-color": "var(--bg-two)", "min-width": "200px" }}>
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

      <main class="fill" style={{ "padding": "0 2em" }}>
        <Dynamic component={currentTab()?.component} />
      </main>
    </div>
  );
}