import { Show, For, createSignal, createEffect, onMount, on } from "solid-js";
import EmojiPicker from "./EmojiPicker"
import { state, setState, tempState, emojiPicker, setEmojiPicker } from "../../App"
import { HiOutlineXMark, HiOutlinePlus, HiOutlineArrowUpOnSquare, HiOutlineGift, HiOutlineFaceSmile, HiOutlinePencil } from "solid-icons/hi";
import Typing from "./Typing";
import {
  attachments,
  setAttachments,
  addAttachment,
  removeAttachment
} from "./attachmentStore.js";
import {
  createSlashCommands,
  SlashSuggestions,
  SlashForm,
  SlashCloseButton,
  SlashSendButton
} from "./SlashComposer";

import GiftPopup from "./GiftPopup";

const MAX_TEXTAREA_HEIGHT = 200;
const MIN_TEXTAREA_HEIGHT = 26;

export default function MessageComposer(props) {
  let textarea;
  let fileInput;
  let typingTimer;
  let lastTypingSent = 0;
  const sendTypinghuh = state.settings.sendTypingStatus;

  const [giftOpen, setGiftOpen] = createSignal(false);

  const {
    slashState,
    setSlashState,
    slashCommands,
    providerFilter,
    setProviderFilter,
    parseSlash,
    closeSlash,
    buildContent,
    sendSlash
  } = createSlashCommands();

  const handleSlashSend = () => sendSlash(props.channel, textarea);

  let slashNav = {
    moveNext: () => { },
    movePrev: () => { },
    selectCurrent: () => { },
    hasSuggestions: () => false
  };

  function pickSuggestion(command) {
    textarea.value = `/${command.name}`;
    parseSlash(textarea.value);
    textarea.focus();
    autoResize();
  }

  function sendTyping() {
    if (!sendTypinghuh) return;
    const duration = 6000;
    const now = Date.now();

    if (now - lastTypingSent < duration) return;

    lastTypingSent = now;

    tempState?.conn?.send({
      cmd: "typing",
      channel: props.channel,
      duration,
      global: true,
      thread_id: null,
      user: tempState?.conn.me().username
    });
  }

  function autoResize() {
    if (!textarea) return;

    textarea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;

    const newHeight = Math.min(
      Math.max(textarea.scrollHeight - 12, MIN_TEXTAREA_HEIGHT),
      MAX_TEXTAREA_HEIGHT
    );

    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }

  createEffect(
    on(
      () => state.replying?.id,
      (id) => {
        if (!id || !textarea) return;

        requestAnimationFrame(() => {
          textarea.focus();

          const pos = textarea.value.length;
          textarea.setSelectionRange(pos, pos);
        });
      }
    )
  );

  onMount(() => {
    autoResize();
  });

  async function handleFiles(e) {
    for (const file of e.target.files) {
      await addAttachment(file);
    }

    e.target.value = "";
  }

  const insertEmoji = (emoji) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    textarea.value =
      textarea.value.slice(0, start) +
      emoji +
      textarea.value.slice(end);

    const pos = start + emoji?.length;

    textarea.focus();
    autoResize();

    requestAnimationFrame(() => {
      textarea.selectionStart = pos;
      textarea.selectionEnd = pos;
    });
  };

  return (
    <div class="text_box_wrapper y">
      <Typing></Typing>
      <Show when={state.replying}>
        <div class="reply_bar x">
          <span>Replying to @{state.replying.user}</span>
          <button onClick={() => setState("replying", null)}>
            <HiOutlineXMark />
          </button>
        </div>
      </Show>
      <Show when={attachments.length > 0}>
        <div className="x attachment_queue">
          <For each={attachments}>
            {(attachment) => (
              <div class="attachment_single">
                <div class="attachment_header">
                  <div class="title">
                    {attachment.name}
                  </div>

                  <div class="x">
                    <button>
                      <HiOutlinePencil />
                    </button>

                    <button
                      onClick={() => removeAttachment(attachment.id)}
                    >
                      <HiOutlineXMark />
                    </button>
                  </div>
                </div>

                <span style={{ "font-size": "0.75em" }}>
                  {attachment.progress}%
                  <span class="cooking">
                    {attachment.progress === 100 ? "(done)" : "(uploading...)"}
                  </span>
                </span>
                <Show when={attachment.preview}>
                  <img
                    src={attachment.preview}
                    alt={attachment.name}
                    class="attachment_preview"
                  />
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <SlashSuggestions
        slashState={slashState}
        setSlashState={setSlashState}
        slashCommands={slashCommands}
        providerFilter={providerFilter}
        setProviderFilter={setProviderFilter}
        onPick={pickSuggestion}
        onNavRef={(nav) => { slashNav = nav; }}
      />

      <Show when={giftOpen()}>
        <GiftPopup
          onClose={() => setGiftOpen(false)}
          onCreated={(url) => {
            const text = textarea.value;

            textarea.value =
              text.length > 0
                ? `${text} ${url}`
                : url;

            textarea.focus();
            autoResize();

            const pos = textarea.value.length;
            textarea.setSelectionRange(pos, pos);
          }}
        />
      </Show>
      <div class="text_box x" style={{ "align-items": "stretch" }}>
        <div className="dropdown_container">
          <div className="action_buttons">
            <button className="icon_button"><HiOutlinePlus></HiOutlinePlus></button>
          </div>
          <div className="dropdown_content">
            <button
              class="icon_button text"
              onClick={() => fileInput.click()}
            >
              <HiOutlineArrowUpOnSquare />
              <span>Upload file</span>
            </button>
            <button
              class="icon_button text"
              onClick={() => setGiftOpen(true)}
            >
              <HiOutlineGift />
              <span>Send gift</span>
            </button>
          </div>
        </div>

        <SlashForm
          slashState={slashState}
          setSlashState={setSlashState}
          onClose={() => closeSlash(textarea)}
          onSend={handleSlashSend}
        />

        <Show when={!slashState.command}>
          <textarea
            ref={textarea}
            rows={1}
            placeholder={`Message #${props.channel}`}
            class="fill"
            style={{
              resize: "none",
              "min-height": `${MIN_TEXTAREA_HEIGHT}px`,
              "max-height": `${MAX_TEXTAREA_HEIGHT}px`
            }}
            onPaste={async e => {
              const items = [...(e.clipboardData?.items || [])];

              for (const item of items) {
                if (
                  item.kind === "file" &&
                  item.type.startsWith("image/")
                ) {
                  const file = item.getAsFile();
                  if (file) {
                    await addAttachment(file);
                  }
                }
              }

              requestAnimationFrame(autoResize);
            }}
            onInput={(e) => {
              parseSlash(e.target.value);

              autoResize();

              sendTyping();

              clearTimeout(typingTimer);
              typingTimer = setTimeout(() => {
                lastTypingSent = 0;
              }, 6000);
            }}
            onKeyDown={(e) => {
              if (
                slashState.active &&
                !slashState.command &&
                slashNav.hasSuggestions()
              ) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  slashNav.moveNext();
                  return;
                }

                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  slashNav.movePrev();
                  return;
                }

                if (e.key === "Tab") {
                  e.preventDefault();
                  if (e.shiftKey) {
                    slashNav.movePrev();
                  } else {
                    slashNav.moveNext();
                  }
                  return;
                }

                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  slashNav.selectCurrent();
                  return;
                }
              }

              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();

                const content = buildContent(e.currentTarget.value.trim());

                if (
                  !content &&
                  attachments.filter(a => a.uploaded).length === 0
                ) {
                  return;
                }

                props.onSend(
                  content,
                  attachments
                    .filter(a => a.uploaded)
                    .map(a => a.serverAttachment)
                );

                setAttachments([]);
                e.currentTarget.value = "";
                autoResize();
              }
            }}
          />
        </Show>
        <div class="action_buttons x">
          <SlashCloseButton
            slashState={slashState}
            onClose={() => closeSlash(textarea)}
          />
          <SlashSendButton
            slashState={slashState}
            onSend={handleSlashSend}
          />
          <div class="emoji_button_wrapper">
            <button
              class="icon_button"
              onClick={() =>
                setEmojiPicker("open", open => !open)
              }
            >
              <HiOutlineFaceSmile />
            </button>

            <Show when={emojiPicker.open}>
              <div class="emoji_popup">
                <EmojiPicker
                  src={state.current.server?.src}
                  onSelect={(emoji) => {
                    insertEmoji(emoji);

                    setEmojiPicker({
                      open: false,
                      onSelect: null
                    });
                  }}
                />
              </div>
            </Show>
          </div>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={handleFiles}
      />

    </div>
  );
}