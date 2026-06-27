import { For, createMemo } from "solid-js";
import { tempState, state, setState } from "../../App.jsx";
import { openPopout } from "../rightSidebar/memberList/popout.jsx";
function isBigEmojiMessage(input) {
  const trimmed = input.trim();

  const tokens = trimmed
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0 || tokens.length > 3) {
    return false;
  }

  return tokens.every(token =>
    token.startsWith("originChats:<emoji>//") ||
    /\p{Extended_Pictographic}/u.test(token)
  );
}
function parseMarkdown(input) {
  if (isBigEmojiMessage(input)) {
    return input
      .trim()
      .split(/\s+/)
      .map(token => {
        if (token.startsWith("originChats:<emoji>//")) {
          const url = token.slice("originChats:<emoji>//".length);
          const match = url.match(/^(.+)\/(\d+)$/);

          if (!match) return token;

          return (
            <img
              class="inline_emoji big_emoji"
              src={`https://${match[1]}/emojis/${match[2]}`}
              alt=""
            />
          );
        }

        return <span class="big_emoji">{token}</span>;
      });
  }
  const parts = [];
  let key = 0;

  const pushText = (text) => {
    if (!text) return;

    const tokens = text.split(
      /(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s]+|originChats:<emoji>\/\/[^\s]+|originChats:\/\/\S+|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|@\w+)/
    );

    for (const token of tokens) {
      if (!token) continue;

      if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(<strong>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith("__") && token.endsWith("__")) {
        parts.push(<u><i>{token.slice(2, -2)}</i></u>);
      } else if (token.startsWith("~~") && token.endsWith("~~")) {
        parts.push(<s>{token.slice(2, -2)}</s>);
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(<kbd>{token.slice(1, -1)}</kbd>);
      } else if (token.match(/^\[[^\]]+\]\(https?:\/\/[^)\s]+\)$/)) {
        const match = token.match(
          /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/
        );

        if (match) {
          const [, label, url] = match;

          parts.push(
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {parseMarkdown(label)}
            </a>
          );
        }
      } else if (token.startsWith("originChats:<emoji>//")) {
        const url = token.slice("originChats:<emoji>//".length);
        const match = url.match(/^(.+)\/(\d+)$/);

        if (match) {
          parts.push(
            <img
              class="inline_emoji"
              src={`https://${match[1]}/emojis/${match[2]}`}
              alt=""
            />
          );
        } else {
          parts.push(token);
        }
      } else if (token.startsWith("originChats://")) {
        const channel = new URL(
          token.replace("originChats://", "https://")
        ).pathname.slice(1);

        const available = tempState.conn.channels?.()?.some(
          (x) => x.name === channel
        );

        if (available) {
          parts.push(
            <a
              href="#"
              class="channel_link"
              onClick={(e) => {
                e.preventDefault();

                setState("current", "channel", channel);

                const serverSrc = state.current.server?.src;
                if (serverSrc) {
                  setState("serverChannels", serverSrc, channel);
                }
              }}
            >
              #{channel}
            </a>
          );
        } else {
          parts.push(`#${channel}`);
        }
      } else if (token.match(/^https?:\/\//)) {
        if (token.match(/^https:\/\/chats\.mistium\.com\/emojis\/\d+$/)) {
          parts.push(
            <img
              class="inline_emoji"
              src={token}
              alt=""
            />
          );
        } else {
          parts.push(
            <EmbeddedLink url={token} />
          );
        }
      } else if (token.match(/^@\w+$/)) {
        const username = token.slice(1);

        parts.push(
          <a
            href="#"
            class="mention"
            onClick={(e) => {
              e.preventDefault();
            }}
          >
            @{username}
          </a>
        );
      } else {
        parts.push(token);
      }

      key++;
    }
  };

  const lines = input.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3);
      const code = [];

      i++;

      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i++;
      }

      parts.push(
        <pre class="code_block">
          <code class={`lang-${lang}`}>
            {code.join("\n")}
          </code>
        </pre>
      );
    } else if (line.match(/^[-*] /)) {
      const items = [];

      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(lines[i].slice(2));
        i++;
      }

      i--;

      parts.push(
        <ul>
          <For each={items}>
            {(item) => <li>{parseMarkdown(item)}</li>}
          </For>
        </ul>
      );
    } else if (line.startsWith("> ")) {
      const quotes = [];

      while (
        i < lines.length &&
        lines[i].startsWith("> ")
      ) {
        quotes.push(lines[i].slice(2));
        i++;
      }

      i--;

      parts.push(
        <blockquote>
          {quotes.map((q, idx) => (
            <>
              {parseMarkdown(q)}
              {idx !== quotes.length - 1 && <br />}
            </>
          ))}
        </blockquote>
      );
    } else {
      pushText(line);

      if (i !== lines.length - 1) {
        parts.push(<br />);
      }
    }
  }

  return parts;
}
const markdownCache = new Map();

function getParsedMarkdown(id, content) {
  if (markdownCache.has(id)) {
    return markdownCache.get(id);
  }

  const parsed = parseMarkdown(content);
  markdownCache.set(id, parsed);

  return parsed;
}

function Embed(props) {
  const embed = props.embed;

  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      class="embed_card"
    >
      {embed.author && (
        <div class="embed_author">
          {embed.author.url ? (
            <a
              href={embed.author.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {embed.author.name}
            </a>
          ) : (
            embed.author.name
          )}
        </div>
      )}

      {embed.title && (
        <div class="embed_title">
          {embed.title}
        </div>
      )}

      {embed.description && (
        <div class="embed_description">
          {parseMarkdown(embed.description)}
        </div>
      )}

      {embed.timestamp && (
        <div class="embed_timestamp">
          {new Date(embed.timestamp).toLocaleString()}
        </div>
      )}
    </a>
  );
}

import { createResource, Show } from "solid-js";

function EmbeddedLink(props) {
  const [info] = createResource(async () => {
    try {
      const res = await fetch(props.url, {
        method: "HEAD"
      });

      const type = res.headers.get("content-type") || "";

      return {
        type
      };
    } catch {
      return null;
    }
  });

  return (
    <Show
      when={info()}
      fallback={
        <a href={props.url} target="_blank" rel="noopener noreferrer">
          {props.url}
        </a>
      }
    >
      {(data) => {
        const type = data().type;

        if (type.startsWith("image/")) {
          return (
            <img
              src={props.url}
              alt=""
              class="embedded_image"
              loading="lazy"
            />
          );
        }

        if (type.startsWith("video/")) {
          return (
            <video
              src={props.url}
              controls
              class="embedded_video"
              loading="lazy"
            />
          );
        }

        if (type.startsWith("audio/")) {
          return (
            <audio
              src={props.url}
              controls
              loading="lazy"
            />
          );
        }

        return (
          <a
            href={props.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {props.url}
          </a>
        );
      }}
    </Show>
  );
}

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
    <div class={`message_single y ${props.grouped ? "grouped" : ""}`}>
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
              src={`https://avatars.rotur.dev/${props.username}`}
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
                      />
                    );
                  }

                  if (file.mime_type?.startsWith("video/")) {
                    return (
                      <video
                        src={file.url}
                        controls
                        class="attachment_video"
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