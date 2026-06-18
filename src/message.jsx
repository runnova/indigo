import { For, createMemo } from "solid-js";
import { tempState, state, setState } from "./App.jsx";

function parseMarkdown(input) {
  const parts = [];
  let key = 0;

  const pushText = (text) => {
    if (!text) return;

    const tokens = text.split(
      /(https?:\/\/[^\s]+|originChats:<emoji>\/\/[^\s]+|originChats:\/\/\S+|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~)/
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
            <a href={token} target="_blank" rel="noopener noreferrer">
              {token}
            </a>
          );
        }
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
export function Message(props) {
  const rendered = createMemo(() =>
    parseMarkdown(props.content)
  );
  return (
    <div class={`message_single y ${props.grouped ? "grouped" : ""}`}>
      {props.reply && (
        <div class="reply_preview x">
          <div class="text">{props.reply}</div>
        </div>
      )}

      <div class="actual_message x">
        {props.grouped ? (
          <div class="message_spacer">
            <div class="time">{props.time}</div>
          </div>
        ) : (
          <img src={props.avatar} alt="" class="pfp" />
        )}

        <div class="message_content y flex">
          {!props.grouped && (
            <div class="message_meta x">
              <div class="username">{props.username}</div>
              <div class="time">{props.time}</div>
            </div>
          )}

          <div class="message_text">
            {rendered()}
          </div>

          {props.attachment && (
            <div class="attatchments">
              <img src={props.attachment} alt="" class="attatched" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}