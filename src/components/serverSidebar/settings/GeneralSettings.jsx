import { SettingCheckbox, SettingInput, SettingSelect } from "../Settings";

export function GeneralSettings() {
  return (
    <>
      <h2 class="settings_title">General</h2>
      <div class="settings_item x">
        <div class="settings_section_label">Profile Overlays</div>
        <SettingCheckbox setting="profileOverlays" />
      </div>
      <div class="settings_item x">
        <div class="settings_section_label y">
          <span>
            Send typing</span>
          <small>Turn this off and nobody knows you are typing.</small>
        </div>
        <SettingCheckbox setting="sendTypingStatus" />
      </div>
      <div class="settings_item x">
        <div class="settings_section_label y">
          <span>
            Strictly follow the user theme in popouts</span>
          <small>Use user theme from their Rotur profile.</small>
        </div>
        <SettingCheckbox setting="customProfileThemes" />
      </div>
      <div class="settings_item x">
        <div class="settings_section_label">Show send button</div>
        <SettingCheckbox setting="showSendButton" />
      </div>
      <div class="settings_item x">
        <div class="settings_section_label">
          Use twemoji instead of system emojis
        </div>
        <SettingCheckbox setting="twemoji" />
      </div>

      <div class="settings_item x">
        <div class="settings_section_label">Messages from blocked users</div>
        <SettingSelect setting="blockedMessages" disabled>
          <option value="collapsed">Show collapsed</option>
          <option value="show">Always Show</option>
          <option value="hide">Always Hide</option>
        </SettingSelect>
      </div>


      <h2 class="settings_title">Chat</h2>

      <div class="settings_item x">
        <div class="settings_section_label y">
          <span>
            Parse markdown in messages</span>
          <small>Removes markdown rendering (emojis and inline attatchments too)</small>
        </div>
        <SettingCheckbox setting="parseMarkdown" />
      </div>
      <div class="settings_item x">
        <div class="settings_section_label y">
          <span>
            Message logger</span>
          <small>Display deleted messages in red instead of removing them.</small>
        </div>
        <SettingCheckbox setting="messageLogger" />
      </div>


      <h2 class="settings_title">Performance</h2>

      <div class="settings_item x">
        <div class="settings_section_label y">
          <span>Preload channels on hover</span>
          <small>Load messages when hovering channels before clicking.</small>
        </div>
        <SettingCheckbox setting="channelPreload" />
      </div>

      <h2 class="settings_title">Identity</h2>

      <div class="settings_item x">
        <div class="settings_section_label">Owner crown</div>
        <SettingCheckbox setting="ownerCrown" />
      </div>
      <div class="settings_item x">
        <div class="settings_section_label">
          Display channel name above display name
        </div>
        <SettingCheckbox setting="displayChannelName" />
      </div>
      <div class="settings_item x">
        <div class="settings_section_label">Show Nicknames</div>
        <SettingSelect setting="showNicknames" disabled>
          <option value="nickname">Nickname</option>
          <option value="nickname_username">Nickname (Username)</option>
          <option value="username">Username</option>
        </SettingSelect>
      </div>

    </>
  );
}
