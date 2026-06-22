import { For, Show } from "solid-js";
import {
  HiOutlineHashtag,
  HiOutlineSpeakerWave,
  HiOutlineMegaphone,
  HiOutlineChatBubbleLeftRight
} from "solid-icons/hi";

const channelIcons = {
  text: HiOutlineHashtag,
  voice: HiOutlineSpeakerWave,
  announcement: HiOutlineMegaphone,
  forum: HiOutlineChatBubbleLeftRight
};

const injectedChannels = [
  {
    name: "indigo-self-roles",
    display_name: "Self Roles",
    type: "self-roles"
  },
  {
    type: "separator"
  }
];

function isImageSrc(src) {
  return typeof src === "string" && src.trim().length > 0;
}

export default function ChannelList(props) {
  const channels = () => [
    ...injectedChannels,
    ...props.channels
  ];

  return (
    <div class="channel_list y">
      <For each={channels()}>
        {(ch) => {
          if (ch.type === "separator") {
            return <hr class="channel_separator" />;
          }

          const unread = props.unreads[ch.name];
          const Icon =
            channelIcons[ch.type] ??
            HiOutlineHashtag;

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
                <Show
                  when={isImageSrc(ch.icon)}
                  fallback={<Icon />}
                >
                  <img
                    src={ch.icon}
                    alt=""
                    class="channel_icon_image"
                  />
                </Show>
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