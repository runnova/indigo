import { For } from "solid-js";
import { SettingCheckbox, SettingInput, SettingSelect } from "../Settings";
import { PING_SOUND_OPTIONS, playPingSound } from "../../../core/pingSound.js";


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
                <SettingSelect setting="idleConnections">
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
                    <option value="link">Display as link</option>
                </SettingSelect>
            </div>

            <div class="settings_item x">
                <div class="settings_section_label y">
                    <span>Ping sound</span>
                    <small>Trig wave sound played when mentioned or pinged.</small>
                </div>
                <div class="x" style={{ gap: "8px", "align-items": "center" }}>
                    <SettingSelect setting="pingSound">
                        <For each={PING_SOUND_OPTIONS}>
                            {(option) => (
                                <option value={option.value}>{option.label}</option>
                            )}
                        </For>
                    </SettingSelect>
                    <button
                        type="button"
                        class="settings_button"
                        style={{ padding: "4px 10px", "font-size": "small" }}
                        onClick={() => playPingSound()}
                        title="Test ping sound"
                    >
                        Test
                    </button>
                </div>
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
