import { SettingCheckbox, SettingInput, SettingSelect } from "../Settings";


export function ConfigSettings() {
    return (
        <>
            <h2 class="settings_title">Configuration</h2>
            <div class="settings_item x">
                <div class="settings_section_label">Use client name / domain</div>
                <SettingInput setting="clientName" />
            </div>

            <div class="settings_item x">
                <div class="settings_section_label">DMs server</div>
                <SettingInput setting="dmsServer" />
            </div>

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
            <h2 class="settings_title">Client UI</h2>
            <div class="settings_item x">
              <div class="settings_section_label y">
                <span>
                  Window manager</span>
                <small>Display pages like settings and explore as draggable windows.</small>
              </div>
              <SettingCheckbox setting="windowManager" />
            </div>
        </>
    );
}
