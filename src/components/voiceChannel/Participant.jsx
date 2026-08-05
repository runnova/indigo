import { HiOutlineSpeakerXMark, HiOutlineSpeakerWave } from "solid-icons/hi";
import { Show } from "solid-js";
import { setUserMuted, setUserVolume } from "../../core/voiceClient";
import { StatusDot } from "./VoiceChannelView";

export function Participant(props) {
    return (
        <div class={"voice_channel_participant y" + (props.speaking ? " speaking" : "")}>
            <StatusDot state={props.state} />

            <div class="pfpWO">
                <img
                    src={`https://avatars.rotur.dev/${props.username}`}
                    alt=""
                    class={"pfp " + (!props.renderOverlay ? "overlayless" : "")}
                    loading="lazy" />

                {props.renderOverlay && (
                    <img
                        src={`https://avatars.rotur.dev/.overlay/${props.username}`}
                        alt=""
                        class="overlay"
                        loading="lazy" />
                )}
            </div>

            <span>{props.username}</span>

            <Show when={props.muted}>
                <HiOutlineSpeakerXMark />
            </Show>

            <Show when={!props.isSelf}>
                <div class="voice_channel_participant_controls x">
                    <button
                        type="button"
                        class="voice_channel_btn_icon small"
                        aria-pressed={props.locallyMuted}
                        title={props.locallyMuted ? "Unmute for me" : "Mute for me"}
                        onClick={() => setUserMuted(props.peerId, !props.locallyMuted)}
                    >
                        {props.locallyMuted ? <HiOutlineSpeakerXMark /> : <HiOutlineSpeakerWave />}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={props.localVolume}
                        title="Volume"
                        onInput={(e) => setUserVolume(props.peerId, parseFloat(e.currentTarget.value))} />
                </div>
            </Show>
        </div>
    );
}
