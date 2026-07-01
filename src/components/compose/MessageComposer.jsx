import { Show, For, createSignal, createEffect, onMount, on } from "solid-js";
import { createStore } from "solid-js/store";
import EmojiPicker from "./EmojiPicker"
import { state, setState, tempState } from "../../App"
import { HiOutlineXMark, HiOutlinePlus, HiOutlinePencil, HiOutlineArrowUpOnSquare, HiOutlineGift, HiOutlineFaceSmile, HiOutlineFilm } from "solid-icons/hi";
import { fetchRoturValidator } from "../../server_connection";
import Typing from "./Typing";

export default function MessageComposer(props) {
  let textarea;
  let fileInput;
  const [attachments, setAttachments] = createStore([]);
  const [slashCommands, setSlashCommands] = createSignal([]);
  const [slashState, setSlashState] = createStore({
    active: false,
    command: null,
    optionIndex: 0,
    values: {},
    suggestions: [],
    selected: 0
  });
  let typingTimer;
  let lastTypingSent = 0;

  function sendTyping() {
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
  onMount(() => {
    tempState?.conn?.send({
      cmd: "slash_list"
    });
  });

  createEffect(() => {
    const event = tempState?.conn.lastEvent();
    if (!event) return;

    if (event.cmd === "slash_list") {
      setSlashCommands(event.commands);
    }
  });
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

  function parseSlash(value) {
    if (!value.startsWith("/")) {
      setSlashState("active", false);
      return;
    }

    const name = value.slice(1).trim();

    const command = slashCommands().find(c => c.name === name);

    if (!command) {
      setSlashState({
        active: true,
        command: null,
        suggestions: slashCommands().filter(c =>
          c.name.startsWith(name)
        )
      });
      return;
    }

    const values = {};

    command.options.forEach(option => {
      values[option.name] = "";
    });

    setSlashState({
      active: true,
      command,
      values
    });
  }

  function closeSlash() {
    setSlashState({
      active: false,
      command: null,
      values: {},
      suggestions: [],
      optionIndex: 0,
      selected: 0
    });

    if (textarea) {
      textarea.value = "";
      requestAnimationFrame(() => textarea.focus());
    }
  }

  async function handleFiles(e) {
    const files = [...e.target.files];

    for (const file of files) {
      queueAttachment(file);
    }

    e.target.value = "";
  }

  function updateAttachment(id, patch) {
    console.log(id, patch)
    setAttachments(
      a => a.id === id,
      attachment => ({
        ...attachment,
        ...patch
      })
    );
  }
  async function uploadAttachment(id, file) {
    const settings = JSON.parse(
      localStorage.getItem("settings") || "{}"
    );

    const validator = await fetchRoturValidator(
      props.validatorKey,
      settings.token
    );

    const xhr = new XMLHttpRequest();

    const form = new FormData();

    form.append(
      "validator_key",
      props.validatorKey
    );

    form.append(
      "validator",
      validator
    );

    form.append("file", file);
    form.append("name", file.name);
    form.append("mime_type", file.type);
    form.append(
      "channel",
      state.current.channel
    );

    xhr.open(
      "POST",
      `https://${state.current.server.src}/attachments/upload`
    );

    xhr.send(form);

    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;

      updateAttachment(id, {
        progress: Math.round(
          (e.loaded / e.total) * 100
        )
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);

        updateAttachment(id, {
          uploaded: true,
          progress: 100,
          serverAttachment: response.attachment
        });
      } else {
        updateAttachment(id, {
          error: `Upload failed (${xhr.status})`
        });
      }
    };

    xhr.onerror = () => {
      updateAttachment(id, {
        error: "Upload failed"
      });
    };
  }
  function queueAttachment(file) {
    const id = crypto.randomUUID();

    setAttachments(a => [
      ...a,
      {
        id,
        file,
        name:
          file.name ||
          `pasted-image-${Date.now()}.png`,
        mimeType: file.type,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
        progress: 0,
        uploaded: false,
        error: null
      }
    ]);

    uploadAttachment(id, file);
  }

  const [pickerOpen, setPickerOpen] = createSignal(false);

  const insertEmoji = (emoji) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    textarea.value =
      textarea.value.slice(0, start) +
      emoji +
      textarea.value.slice(end);

    const pos = start + emoji?.length;

    textarea.focus();

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
                      onClick={() =>
                        setAttachments(
                          attachments.filter(
                            a => a.id !== attachment.id
                          )
                        )
                      }
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
      <Show when={slashState.active && !slashState.command}>
        <div class="slash_popup y">
          <For each={slashState.suggestions}>
            {command => (
              <button
                class="x"
                onClick={() => {
                  textarea.value = `/${command.name}`;
                  parseSlash(textarea.value);
                  textarea.focus();
                }}
              >
                <strong>/{command.name}</strong>
                <span>{command.description}</span>
              </button>
            )}
          </For>
        </div>
      </Show>

      <div class="text_box x">
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
            <button className="icon_button text">
              <HiOutlineGift />
              <span>Send gift</span>
            </button>
          </div>
        </div>
        <Show when={slashState.active && slashState.command}>
          <div
            class="slash-form"
            tabindex="0"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                closeSlash();
              }
            }}
          >
            <div class="command">
              /{slashState.command.name}
            </div>

            <For each={slashState.command.options}>
              {(option) => (
                <label class="slash-option">
                  <span>{option.name}</span>

                  <input
                    type="text"
                    placeholder={option.type}
                    value={slashState.values[option.name] || ""}
                    onInput={(e) =>
                      setSlashState(
                        "values",
                        option.name,
                        e.currentTarget.value
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        closeSlash();
                      }
                    }}
                  />
                </label>
              )}
            </For>
          </div>

        </Show>

        <Show when={!slashState.command}>
          <textarea
            ref={textarea}
            rows={1}
            placeholder={`Message #${props.channel}`}
            class="fill"
            onPaste={async (e) => {
              const items = [...(e.clipboardData?.items || [])];

              const imageItems = items.filter(
                item => item.kind === "file" &&
                  item.type.startsWith("image/")
              );

              if (imageItems.length === 0) return;

              e.preventDefault();

              for (const item of imageItems) {
                const file = item.getAsFile();
                if (file) queueAttachment(file);
              }
            }}
            onInput={(e) => {
              parseSlash(e.target.value);

              sendTyping();

              clearTimeout(typingTimer);
              typingTimer = setTimeout(() => {
                lastTypingSent = 0;
              }, 6000);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();

                let content = e.currentTarget.value.trim();

                if (slashState.command) {
                  content =
                    "/" +
                    slashState.command.name +
                    " " +
                    slashState.command.options
                      .map(option => slashState.values[option.name] || "")
                      .join(" ");
                }

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
              }
            }}
          />
        </Show>
        <div class="action_buttons x">
          <Show when={slashState.command}>
            <button
              class="icon_button"
              onClick={closeSlash}
            >
              <HiOutlineXMark />
            </button>
          </Show>
          <div class="emoji_button_wrapper">
            <button
              class="icon_button"
              onClick={() => setPickerOpen(!pickerOpen())}
            >
              <HiOutlineFaceSmile />
            </button>

            <Show when={pickerOpen()}>
              <div class="emoji_popup">
                <EmojiPicker
                  src={state.current.server?.src}
                  onSelect={(emoji) => {
                    console.log(emoji)
                    if (emoji.url) {
                      insertEmoji(`:${emoji.name}:`);
                    } else {
                      insertEmoji(emoji);
                    }
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