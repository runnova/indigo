import { For, Show, createMemo, createSignal, createEffect } from "solid-js";
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
import "./embeds/BeamEmbed.jsx";

const SIZE_UNITS = ["B", "KB", "MB", "GB"];
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const SIGN_TIMEOUT_MS = 10000;

const memberIndexCache = new WeakMap();
const roleIconCache = new WeakMap();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findMember = (username) => {
  const members = tempState?.conn?.members?.();
  if (!members) return null;
  let index = memberIndexCache.get(members);
  if (!index) {
    index = new Map();
    for (const m of members) index.set(m.username, m);
    memberIndexCache.set(members, index);
  }
  return index.get(username) ?? null;
};

const computeRoleIcon = (member, roles) => {
  const colorMatch = member.roles.find(
    (roleId) => roles[roleId]?.color === member.color,
  );
  const matched = colorMatch && roles[colorMatch];
  if (matched?.icon) return { icon: matched.icon, name: matched.name };

  const sorted = [...member.roles].sort(
    (a, b) => (roles[b]?.position ?? -1) - (roles[a]?.position ?? -1),
  );

  for (const roleId of sorted) {
    const role = roles[roleId];
    if (role?.icon) return { icon: role.icon, name: role.name };
  }

  return null;
};

const getRoleIcon = (member, roles) => {
  const cached = roleIconCache.get(member);
  if (cached && cached.roles === roles) return cached.value;
  const value = computeRoleIcon(member, roles);
  roleIconCache.set(member, { roles, value });
  return value;
};

const formatFileSize = (size) => {
  if (!size) return "0 B";
  const index = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    SIZE_UNITS.length - 1,
  );
  return `${(size / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${SIZE_UNITS[index]}`;
};

const downloadFile = (file) => {
  const link = document.createElement("a");
  link.href = file.url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const stop = (handler) => (e) => {
  e.preventDefault();
  e.stopPropagation();
  handler();
};

const previewFile = (file) => () =>
  setPreview({ src: file.url, type: file.mime_type });

function WebhookIcon() {
  return (
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
  );
}

function AliasIcon(props) {
  return (
    <svg
      data-tooltip={`Alias: Posted by ${props.username}`}
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
      class="lucide lucide-venetian-mask"
    >
      <path d="M18 11c-1.5 0-2.5.5-3 2"></path>
      <path d="M4 6a2 2 0 0 0-2 2v4a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V8a2 2 0 0 0-2-2h-3a8 8 0 0 0-5 2 8 8 0 0 0-5-2z"></path>
      <path d="M6 11c1.5 0 2.5.5 3 2"></path>
    </svg>
  );
}

function Attachment(props) {
  const file = props.file;
  const mime = file.mime_type;

  if (mime?.startsWith("image/")) {
    return (
      <img
        src={file.url}
        alt={file.name}
        class="attachment_image"
        loading="lazy"
        data-context="attachment"
        onClick={previewFile(file)}
      />
    );
  }

  if (mime?.startsWith("video/")) {
    return (
      <video
        data-context="attachment"
        src={file.url}
        class="attachment_video"
        onClick={previewFile(file)}
      />
    );
  }

  if (mime?.startsWith("audio/")) {
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
    <a target="_blank" rel="noopener noreferrer" class="attachment_file x">
      <HiOutlineDocument />

      <div class="y fill">
        <div class="file_name">{file.name}</div>
        <div class="file_type">{mime}</div>
      </div>

      <div class="file_size">{formatFileSize(file.size)}</div>

      <div class="x">
        <button
          type="button"
          title="Download"
          onClick={stop(() => downloadFile(file))}
        >
          <HiOutlineArrowDownTray />
        </button>

        <button
          type="button"
          title="Open in new tab"
          onClick={stop(() =>
            window.open(file.url, "_blank", "noopener,noreferrer"),
          )}
        >
          <HiOutlineArrowTopRightOnSquare />
        </button>
      </div>
    </a>
  );
}

function Reaction(props) {
  const isCustom = props.emoji.startsWith("originChats://");

  return (
    <div
      class="reaction_single"
      data-tooltip={props.users.join(", \n")}
      data-tooltip-icon={props.emoji}
      onClick={props.onToggle}
    >
      {isCustom ? (
        <img
          class="inline_emoji"
          src={props.emoji.replace("originChats://", "https://")}
          alt=""
        />
      ) : state.settings.twemoji && PICTOGRAPHIC.test(props.emoji) ? (
        <img
          class="inline_emoji twemoji"
          src={twemojiUrl(props.emoji)}
          alt={props.emoji}
          draggable={false}
          loading="lazy"
        />
      ) : (
        <span>{props.emoji}</span>
      )}

      <span>{props.users.length}</span>
    </div>
  );
}

export function Message(props) {
  const [signed, setSigned] = createSignal("pending");

  let signTimer;
  const signTimeout = new Promise((resolve) => {
    signTimer = setTimeout(() => resolve("unavailable"), SIGN_TIMEOUT_MS);
  });

  Promise.race([Promise.resolve(props.signed), signTimeout])
    .then(setSigned, () => setSigned("unavailable"))
    .finally(() => clearTimeout(signTimer));

  const replyUser = props.reply
    ? { ...props.reply, username: props.reply.user }
    : null;

  const member = !props.webhook ? findMember(props.username) : null;
  const gradient = member?.gradient;

  const [editValue, setEditValue] = createSignal("");
  let editTextarea;

  const rendered = createMemo(() =>
    !state.settings.parseMarkdown
      ? props.content
      : parseMarkdown(props.content || ""),
  );

  const isMentioned = createMemo(() => {
    const me = tempState?.conn?.me?.()?.username;
    if (!me) return false;

    if (props.pings?.users?.includes(me)) return true;

    const content = props.content;
    if (typeof content !== "string") return false;

    return new RegExp(
      `(^|\\s)@${escapeRegex(me)}(?=[^a-zA-Z0-9_]|$)`,
      "i",
    ).test(content);
  });

  const displayUsername = () =>
    props.alias?.name ||
    props.webhook?.name ||
    member?.nickname ||
    props.username;

  const displayAvatar = () =>
    props.alias?.avatar || props.webhook?.avatar || props.avatar;

  const usernameStyle = () => {
    if (props.webhook) return {};
    if (props.alias?.usercolor) return { color: props.alias.usercolor };
    if (Array.isArray(gradient)) {
      return {
        background: `linear-gradient(90deg, ${gradient.join(", ")})`,
        "-webkit-background-clip": "text",
        "-webkit-text-fill-color": "transparent",
        "background-clip": "text",
        color: "transparent",
      };
    }
    return { color: member?.color };
  };

  const dismissEphemeral = () => {
    setState("messages", state.current.channel, (msgs) =>
      msgs.filter((m) => m.id !== props.id),
    );
  };

  const autoResizeEdit = () => {
    if (!editTextarea) return;
    editTextarea.style.height = "auto";
    editTextarea.style.height = `${editTextarea.scrollHeight}px`;
    editTextarea.style.overflowY = "hidden";
  };

  createEffect(() => {
    if (!props.editing) return;
    setEditValue(props.content);
    queueMicrotask(() => {
      if (!editTextarea) return;
      editTextarea.focus();
      editTextarea.setSelectionRange(
        editTextarea.value.length,
        editTextarea.value.length,
      );
      autoResizeEdit();
    });
  });

  const roleIcon = createMemo(() => {
    if (!member?.roles) return null;
    const roles = tempState?.conn?.roles?.();
    if (!roles) return null;
    return getRoleIcon(member, roles);
  });

  const submitEdit = async () => {
    await sendMessageEdit(props.id, { content: editValue() }, props);
    setState("editing", null);
  };

  const toggleReaction = (emoji) => () => {
    tempState.conn.send({
      cmd: "message_react_add",
      channel: state.current.channel,
      id: props.id,
      emoji,
    });
  };

  return (
    <div
      class={`message_single y ${props.grouped ? "grouped" : ""} ${props.fake || props.ephemeral ? "is-fake" : ""} ${props.deleted ? "deleted" : ""} ${isMentioned() ? "is-mention" : ""}`}
      onClick={props.onClick}
    >
      <Show when={props.reply || props.interaction}>
        <div class="reply_preview x">
          <Show
            when={replyUser}
            fallback={
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
            }
          >
            <div
              class="reply_author username x"
              onClick={(e) => openPopout(replyUser, e.currentTarget)}
            >
              <img
                src={`https://avatars.rotur.dev/${replyUser.user}`}
                alt=""
                class="pfp"
                loading="lazy"
              />
              {replyUser.user}
            </div>

            <div
              class="reply_text"
              onClick={() => tempState.virtMsgList.jumpToMessage(replyUser.id)}
            >
              {replyUser.content || <HiOutlineDocument />}
            </div>
          </Show>
        </div>
      </Show>

      <div class="actual_message x">
        <Show
          when={props.grouped}
          fallback={
            <div
              class="pfpWO"
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

              <Show when={props.renderOverlay && !props.webhook}>
                <img
                  src={`https://avatars.rotur.dev/.overlay/${props.username}`}
                  alt=""
                  class="overlay"
                  loading="lazy"
                />
              </Show>
            </div>
          }
        >
          <div class="message_spacer">
            <div
              class="time"
              data-tooltip={`${timeAgo(props.timeRaw)} • ${new Date(props.timeRaw).toLocaleString()}`}
            >
              {props.time}
            </div>
          </div>
        </Show>

        <div class="message_content y flex">
          <Show when={!props.grouped}>
            <div class="message_meta x">
              <div
                class={`username ${props.webhook ? "webhook" : ""}`}
                style={usernameStyle()}
                onClick={(e) =>
                  !props.webhook && openPopout(props, e.currentTarget)
                }
              >
                {displayUsername()}{" "}
                <Show when={roleIcon()}>
                  <img
                    class="inline_emoji"
                    src={roleIcon().icon}
                    data-tooltip={roleIcon().name + ": Role Icon"}
                    data-tooltip-icon={roleIcon().icon}
                  />
                </Show>
              </div>
              <div
                class="time"
                data-tooltip={`${timeAgo(props.timeRaw)}: ${new Date(props.timeRaw).toLocaleString()}`}
              >
                {props.time}{" "}
              </div>{" "}
              <Show
                when={
                  signed() !== "verified" &&
                  signed() !== "pending" &&
                  !props.webhook
                }
              >
                <HiOutlineExclamationTriangle
                  style={{ color: "yellow" }}
                  data-tooltip="Unsigned"
                />
              </Show>
              <Show when={props.webhook}>
                <WebhookIcon />
              </Show>
              <Show when={props.alias}>
                <AliasIcon username={props.username} />
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
          </Show>

          <Show
            when={props.editing}
            fallback={
              <div class="message_text">
                <div class="text">{rendered()}</div>

                <Show when={props.edited}>
                  <HiOutlinePencil
                    data-tooltip={"Edited:" + timeAgo(props.edited_at)}
                    class="edited_marker"
                  />
                </Show>
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
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setState("editing", null);
                } else if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitEdit();
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

          <Show when={props.attachments?.length}>
            <div class="attachments">
              <For each={props.attachments}>
                {(file) => <Attachment file={file} />}
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

          <Show when={props.reactions && Object.keys(props.reactions).length}>
            <div class="messageReactions">
              <For each={Object.entries(props.reactions)}>
                {([emoji, users]) => (
                  <Reaction
                    emoji={emoji}
                    users={users}
                    onToggle={toggleReaction(emoji)}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
