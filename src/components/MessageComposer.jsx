import { Show, createSignal } from "solid-js";
import EmojiPicker from "./EmojiPicker"
import { state } from "../App"

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
      <div class="text_box x">
        <textarea
          ref={textarea}
          placeholder={`Message #${props.channel}`}
          class="fill"
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