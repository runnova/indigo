import { For, Show, createMemo } from "solid-js";
import {
  HiOutlineChatBubbleOvalLeft,
  HiOutlineFaceSmile,
  HiOutlinePencil,
  HiOutlineDocumentDuplicate,
  HiOutlineTrash,
} from "solid-icons/hi";

import { state } from "../../state";
import { twemojiUrl } from "./twemoji";

export function MessageActions(props) {
  const reactions = createMemo(() =>
    (props.quickReactions ?? "👍, ❤️, 😂, 🎉, 👎")
      .split(",")
      .map((emoji) => emoji.trim())
      .filter(Boolean),
  );

  return (
    <div class="message_actions x">
      <Show when={reactions().length > 0}>
        <div class="quick_reactions x">
          <For each={reactions()}>
            {(emoji) => (
              <button
                data-tooltip={emoji}
                onClick={() =>
                  props.onQuickReact?.(emoji, props.messageId, props.channel)
                }
              >
                <Show
                  when={state.settings.twemoji === true}
                  fallback={emoji}
                >
                  <img
                    src={twemojiUrl(emoji)}
                    alt={emoji}
                    class="twemoji"
                  />
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>

      <vr></vr>

      <button
        data-tooltip="Copy Text"
        onClick={() => navigator.clipboard.writeText(props.content)}
      >
        <HiOutlineDocumentDuplicate />
      </button>

      <Show when={props.canEdit}>
        <button data-tooltip="Edit" onClick={() => props.onEdit?.()}>
          <HiOutlinePencil />
        </button>
      </Show>

      <Show when={props.canDelete}>
        <button data-tooltip="Delete" onClick={() => props.onDelete?.()}>
          <HiOutlineTrash />
        </button>
      </Show>

      <button onClick={() => props.onReact?.()} data-tooltip="React">
        <HiOutlineFaceSmile />
      </button>

      <button onClick={() => props.onReply?.()} data-tooltip="Reply">
        <HiOutlineChatBubbleOvalLeft />
      </button>
    </div>
  );
}
