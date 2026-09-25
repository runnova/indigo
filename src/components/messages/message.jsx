import {
  For,
  Show,
  createMemo,
  createSignal,
  createEffect,
  createResource,
} from "solid-js";
import { tempState, state, setState, setPreview } from "../../App.jsx";
import { openPopout } from "../rightSidebar/memberList/popout.jsx";
import { parseMarkdown, Embed } from "./ParseMarkdown.jsx";
import { twemojiUrl } from "./twemoji.js";
import {
  HiOutlineArrowDownTray,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineDocument,
  HiOutlineExclamationTriangle,
  HiOutlinePencil,
  HiOutlineXMark,
} from "solid-icons/hi";
import { sendMessageEdit } from "../../core/useMessageSigning.js";
import { timeAgo } from "../Utility.jsx";
import { BeamEmbed } from "./embeds/BeamEmbed.jsx";

export function Message(props) {
  const rendered = createMemo(() =>
    !state.settings.parseMarkdown
      ? props.content
      : parseMarkdown(props.content || ""),
  );
  if (props.reply) {
    props.reply.username = props.reply.user;
  }

  const member = !props.webhook
    ? tempState?.conn
        ?.members()
        ?.find((user) => user.username === props.username)
    : null;
  const gradient = member?.gradient;
  const [editValue, setEditValue] = createSignal("");

  const displayUsername = () =>
    props.webhook?.name || member?.nickname || props.username;

  const displayAvatar = () => props.webhook?.avatar || props.avatar;

  createEffect(() => {
    if (props.editing) {
      setEditValue(props.content);
    }
  });

  const dismissEphemeral = () => {
    setState("messages", state.current.channel, (msgs) =>
      msgs.filter((m) => m.id !== props.id),
    );
  };

  let editTextarea;

  createEffect(() => {
    if (props.editing && editTextarea) {
      queueMicrotask(() => {
        editTextarea.focus();
        editTextarea.setSelectionRange(
          editTextarea.value.length,
          editTextarea.value.length,
        );
      });
    }
  });

  const formatFileSize = (size) => {
    if (size === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.floor(Math.log(size) / Math.log(1024));

    return `${(size / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  };
  const [signed] = createResource(
    () => props.signed,
    (value) => value,
  );

  const user = createMemo(() =>
    !props.webhook
      ? tempState?.conn
          ?.members()
          ?.find((member) => member.username === props.username)
      : null,
  );

  const roleIcon = createMemo(() => {
    const currentUser = user();
    if (!currentUser || props.webhook) return null;

    const roles = tempState?.conn?.roles?.();
    if (!roles || !currentUser.roles) return null;

    const colorMatchingRole = currentUser.roles.find((roleId) => {
      const roleData = roles[roleId];
      return roleData?.color === currentUser.color;
    });

    if (colorMatchingRole) {
      const role = roles[colorMatchingRole];
      if (role?.icon) return { icon: role.icon, name: role.name };
    }

    const sortedRoles = [...currentUser.roles].sort((roleIdA, roleIdB) => {
      const posA = roles[roleIdA]?.position ?? -1;
      const posB = roles[roleIdB]?.position ?? -1;
      return posB - posA;
    });

    for (const roleId of sortedRoles) {
      const role = roles[roleId];
      if (role?.icon) return { icon: role.icon, name: role.name };
    }

    return null;
  });

  const autoResizeEdit = () => {
    if (!editTextarea) return;
    editTextarea.style.height = "auto";
    editTextarea.style.height = `${editTextarea.scrollHeight}px`;
    editTextarea.style.overflowY = "hidden";
  };

  createEffect(() => {
    if (props.editing && editTextarea) {
      queueMicrotask(() => {
        editTextarea.focus();
        editTextarea.setSelectionRange(
          editTextarea.value.length,
          editTextarea.value.length,
        );
        autoResizeEdit();
      });
    }
  });

  return (
    <div
      class={`message_single y ${props.grouped ? "grouped" : ""} ${props.fake || props.ephemeral ? "is-fake" : ""} ${props.deleted ? "deleted" : ""}`}
      onClick={props.onClick}
    >
      {(props.reply || props.interaction) && (
        <div class="reply_preview x">
          {props.reply ? (
            <>
              <div
                class="reply_author username x"
                onClick={(e) => openPopout(props.reply, e.currentTarget)}
              >
                <img
                  src={`https://avatars.rotur.dev/${props.reply.user}`}
                  alt=""
                  class="pfp"
                  loading="lazy"
                />
                {props.reply.user}
              </div>

              <div
                class="reply_text"
                onClick={() => {
                  tempState.virtMsgList.jumpToMessage(props.reply.id);
                }}
              >
                {props.reply.content || <HiOutlineDocument></HiOutlineDocument>}
              </div>
            </>
          ) : (
            <>
              <div class="reply_author x">
                <img
                  src={`https://avatars.rotur.dev/${props.interaction.username}`}
                  alt=""
                  class="pfp"
                  loading="lazy"
                />
                {props.interaction.username}
              </div>

              <div class="reply_text">
                <kbd>/{props.interaction.command}</kbd>
              </div>
            </>
          )}
        </div>
      )}

      <div class="actual_message x">
        {props.grouped ? (
          <div class="message_spacer">
            <div
              class="time"
              data-tooltip={`${timeAgo(props.timeRaw)} • ${new Date(props.timeRaw).toLocaleString()}`}
            >
              {props.time}
            </div>
          </div>
        ) : (
          <div
            className="pfpWO"
            onClick={(e) =>
              props.webhook ? null : openPopout(props, e.currentTarget)
            }
          >
            <img
              src={displayAvatar()}
              alt=""
              class={`pfp ${!props.renderOverlay ? "overlayless" : ""}`}
              loading="lazy"
            />

            {props.renderOverlay && !props.webhook && (
              <img
                src={`https://avatars.rotur.dev/.overlay/${props.username}`}
                alt=""
                class="overlay"
                loading="lazy"
              />
            )}
          </div>
        )}

        <div class="message_content y flex">
          {!props.grouped && (
            <div class="message_meta x">
              <div
                class={`username ${props.webhook ? "webhook" : ""}`}
                style={
                  !props.webhook && Array.isArray(gradient)
                    ? {
                        background: `linear-gradient(90deg, ${gradient.join(", ")})`,
                        "-webkit-background-clip": "text",
                        "-webkit-text-fill-color": "transparent",
                        "background-clip": "text",
                        color: "transparent",
                      }
                    : !props.webhook
                      ? {
                          color: member?.color,
                        }
                      : {}
                }
                onClick={(e) =>
                  !props.webhook && openPopout(props, e.currentTarget)
                }
              >
                {displayUsername()}{" "}
                {roleIcon() && (
                  <img
                    class="inline_emoji"
                    src={roleIcon().icon}
                    data-tooltip={roleIcon()?.name + ": Role Icon"}
                    data-tooltip-icon={roleIcon()?.icon}
                  />
                )}
              </div>
              <div
                class="time"
                data-tooltip={`${timeAgo(props.timeRaw)}: ${new Date(props.timeRaw).toLocaleString()}`}
              >
                {props.time}{" "}
              </div>{" "}
              {signed() == "verified" || props.webhook ? (
                ""
              ) : (
                <HiOutlineExclamationTriangle
                  style={{ color: "yellow" }}
                  data-tooltip="Unsigned"
                ></HiOutlineExclamationTriangle>
              )}
              <Show when={props.webhook}>
                <svg
                  data-tooltip="Webhook"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  class="lucide lucide-webhook"
                >
                  <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"></path>
                  <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"></path>
                  <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"></path>
                </svg>
              </Show>
              <Show when={props.fake}>
                <button class="fake-dismiss" onClick={props.onDismiss}>
                  Dismiss <HiOutlineXMark />
                </button>
              </Show>
              <Show when={props.ephemeral}>
                <button class="fake-dismiss" onClick={dismissEphemeral}>
                  Dismiss <HiOutlineXMark />
                </button>
              </Show>
            </div>
          )}

          <Show
            when={props.editing}
            fallback={
              <div class="message_text">
                <div class="text">{rendered()}</div>

                {props.edited && (
                  <HiOutlinePencil
                    data-tooltip={"Edited:" + timeAgo(props.edited_at)}
                    className="edited_marker"
                  />
                )}
              </div>
            }
          >
            <textarea
              class="message_edit_textarea"
              value={editValue()}
              onInput={(e) => {
                setEditValue(e.currentTarget.value);
                autoResizeEdit();
              }}
              ref={editTextarea}
              onKeyDown={async (e) => {
                if (e.key === "Escape") {
                  setState("editing", null);
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const current = props;
                  await sendMessageEdit(
                    props.id,
                    { content: editValue() },
                    current,
                  );
                  setState("editing", null);
                }
              }}
            />
            <small class="edit_instruct">
              ESC to{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setState("editing", null);
                }}
              >
                cancel
              </a>
              , ENTER to send
            </small>
          </Show>

          {props.attachments?.length > 0 && (
            <div class="attachments">
              <For each={props.attachments}>
                {(file) => {
                  if (file.mime_type?.startsWith("image/")) {
                    return (
                      <img
                        src={file.url}
                        alt={file.name}
                        class="attachment_image"
                        loading="lazy"
                        data-context="attachment"

                        onClick={() =>
                          setPreview({
                            src: file.url,
                            type: file.mime_type,
                          })
                        }
                      />
                    );
                  }

                  if (file.mime_type?.startsWith("video/")) {
                    return (
                      <video
                        data-context="attachment"
                        src={file.url}
                        class="attachment_video"
                        onClick={() =>
                          setPreview({
                            src: file.url,
                            type: file.mime_type,
                          })
                        }
                      />
                    );
                  }

                  if (file.mime_type?.startsWith("audio/")) {
                    return (
                      <audio
                        data-context="attachment"
                        src={file.url}
                        controls
                        class="attachment_audio"
                      />
                    );
                  }

                  return (
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      class="attachment_file x"
                    >
                      <HiOutlineDocument />

                      <div className="y fill">
                        <div class="file_name">{file.name}</div>
                        <div class="file_type">{file.mime_type}</div>
                      </div>

                      <div class="file_size">{formatFileSize(file.size)}</div>

                      <div class="x">
                        <button
                          type="button"
                          title="Download"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const link = document.createElement("a");
                            link.href = file.url;
                            link.download = file.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <HiOutlineArrowDownTray />
                        </button>

                        <button
                          type="button"
                          title="Open in new tab"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            window.open(
                              file.url,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                        >
                          <HiOutlineArrowTopRightOnSquare />
                        </button>
                      </div>
                    </a>
                  );
                }}
              </For>
            </div>
          )}
          <Show when={props.reactions && Object.keys(props.reactions).length}>
            <div class="messageReactions">
              <For each={Object.entries(props.reactions)}>
                {([emoji, users]) => {
                  const isCustom = emoji.startsWith("originChats://");

                  return (
                    <div
                      class="reaction_single"
                      data-tooltip={users.join(", \n")}
                      data-tooltip-icon={emoji}
                      onClick={() => {
                        tempState.conn.send({
                          cmd: "message_react_add",
                          channel: state.current.channel,
                          id: props.id,
                          emoji: emoji,
                        });
                      }}
                    >
                      {isCustom ? (
                        <img
                          class="inline_emoji"
                          src={emoji.replace("originChats://", "https://")}
                          alt=""
                        />
                      ) : state.settings.twemoji &&
                        /\p{Extended_Pictographic}/u.test(emoji) ? (
                        <img
                          class="inline_emoji twemoji"
                          src={twemojiUrl(emoji)}
                          alt={emoji}
                          draggable={false}
                          loading="lazy"
                        />
                      ) : (
                        <span>{emoji}</span>
                      )}

                      <span>{users.length}</span>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
          <Show when={props.embeds?.length}>
            <div class="message_embeds">
              <For each={props.embeds}>
                {(embed) => <Embed embed={embed} />}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
