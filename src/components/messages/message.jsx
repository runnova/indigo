import { For, createMemo } from "solid-js";
import { tempState, state, setState, setPreview } from "../../App.jsx";
import { openPopout } from "../rightSidebar/memberList/popout.jsx";
import { parseMarkdown, Embed } from "./ParseMarkdown.jsx";
import { HiOutlineXMark } from "solid-icons/hi";

export function Message(props) {
  const rendered = createMemo(() =>
    parseMarkdown(props.content)
  );
  if (props.reply) {
    props.reply.username = props.reply.user;
  }
  const member = tempState?.conn?.members()?.find(user => user.username === props.username);
  const gradient = member?.gradient;
  return (
    <div
      class={`message_single y ${props.grouped ? "grouped" : ""} ${props.fake ? "is-fake" : ""}`}
    >
      {(props.reply || props.interaction) && (
        <div class="reply_preview x">
          {props.reply ? (
            <>
              <div
                class="reply_author x"
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

              <div class="reply_text">
                {props.reply.content}
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
                <kdb>/{props.interaction.command}</kdb>
              </div>
            </>
          )}
        </div>
      )}

      <div class="actual_message x">
        {props.grouped ? (
          <div class="message_spacer">
            <div class="time">{props.time}</div>
          </div>
        ) : (
          <div className="pfpWO" onClick={(e) => openPopout(props, e.currentTarget)}>
            <img
              src={`${props.avatar}`}
              alt=""
              class="pfp"
              loading="lazy"
            />
            <img
              src={`https://avatars.rotur.dev/.overlay/${props.username}`}
              alt=""
              class="overlay"
              loading="lazy"
            />
          </div>
        )}

        <div class="message_content y flex">
          {!props.grouped && (
            <div class="message_meta x">
              <div
                class="username"

                style={
                  Array.isArray(gradient)
                    ? {
                      background: `linear-gradient(90deg, ${gradient.join(", ")})`,
                      "-webkit-background-clip": "text",
                      "-webkit-text-fill-color": "transparent",
                      "background-clip": "text",
                      color: "transparent"
                    }
                    : {
                      color: member?.color
                    }
                }
                onClick={(e) => openPopout(props, e.currentTarget)}
              >

                {props.username}
              </div>

              <div class="time">{props.time}</div>

              <Show when={props.fake}>
                <button
                  class="fake-dismiss"
                  onClick={props.onDismiss}
                >
                  Dismiss <HiOutlineXMark/>
                </button>
              </Show>
            </div>
          )}

          <div class="message_text">
            {rendered()}
          </div>

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
                        src={file.url}
                        class="attachment_video"
                        onClick={() =>
                          setPreview({
                            src: file.url,
                            type: file.mime_type,
                          })}
                      />
                    );
                  }

                  if (file.mime_type?.startsWith("audio/")) {
                    return (
                      <audio
                        src={file.url}
                        controls
                        class="attachment_audio"
                      />
                    );
                  }

                  return (
                    <a
                      href={file.url}
                      download={file.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="attachment_file"
                    >
                      <div class="file_name">{file.name}</div>
                      <div class="file_type">{file.mime_type}</div>
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
                    <div class="reaction_single">
                      {isCustom ? (
                        <img
                          class="inline_emoji"
                          src={emoji.replace(
                            "originChats://",
                            "https://"
                          )}
                          alt=""
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