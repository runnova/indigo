import { For, Show } from "solid-js";
import {
  HiSolidHashtag,
  HiSolidSpeakerWave,
  HiSolidMegaphone,
  HiSolidChatBubbleLeftRight
} from "solid-icons/hi";

const channelIcons = {
  text: HiSolidHashtag,
  voice: HiSolidSpeakerWave,
  announcement: HiSolidMegaphone,
  forum: HiSolidChatBubbleLeftRight
};

export default function ChannelList(props) {
  return (
    <div class="channel_list y">
      <For each={props.channels}>
        {(ch) => {
          const unread = props.unreads[ch.name];
          const Icon =
            channelIcons[ch.type] ??
            HiSolidHashtag;

          return (
            <div
              class={`x channel_item${
                props.currentChannel === ch.name
                  ? " channel_item--active"
                  : ""
              }`}
              onClick={() => props.onSelect(ch.name)}
            >
              <span class="channel_icon">
                <Icon />
              </span>

              {ch.display_name || ch.name}

              <Show when={unread?.unread_count > 0}>
                <span class="channel_badge">
                  {unread.unread_count}
                </span>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}