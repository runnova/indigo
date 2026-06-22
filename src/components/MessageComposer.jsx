import { Show, createSignal } from "solid-js";
import EmojiPicker from "./EmojiPicker"
import { state, setState } from "../App"
import {HiOutlineXMark} from "solid-icons/hi"

export default function MessageComposer(props) {
  let textarea;

  const [pickerOpen, setPickerOpen] = createSignal(false);

  const insertEmoji = (emoji) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    textarea.value =
      textarea.value.slice(0, start) +
      emoji +
      textarea.value.slice(end);

    const pos = start + emoji.length;

    textarea.focus();

    requestAnimationFrame(() => {
      textarea.selectionStart = pos;
      textarea.selectionEnd = pos;
    });
  };

  return (
    <div class="text_box_wrapper y">
       <Show when={state.replying}>
        <div class="reply_bar x">
          <span>Replying to @{state.replying.user}</span>
          <button onClick={() => setState("replying", null)}>
            <HiOutlineXMark/>
          </button>
        </div>
      </Show>
      <div class="text_box x">
        <textarea
          ref={textarea}
          placeholder={`Message #${props.channel}`}
          class="fill"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();

              const content = e.currentTarget.value.trim();

              if (!content) return;

              props.onSend(content);
              e.currentTarget.value = "";
            }
          }}
        />

        <div class="action_buttons">
          <div class="emoji_button_wrapper">
            <button
              class="icon_button"
              onClick={() => setPickerOpen(!pickerOpen())}
            >
              😀
            </button>

            <Show when={pickerOpen()}>
              <div class="emoji_popup">
                <EmojiPicker
                  src={state.current.server?.src}
                  onSelect={(emoji) => {
                    if (emoji.url) {
                      insertEmoji(`:${emoji.name}:`);
                    } else {
                      insertEmoji(emoji.emoji);
                    }
                  }}
                />
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}