import { For } from "solid-js";
import { setState, state, tempState } from "../../App"
import { setPreview } from "../../App";
const markdownCache = new Map();

function getParsedMarkdown(id, content) {
  if (markdownCache.has(id)) {
    return markdownCache.get(id);
  }

  const parsed = parseMarkdown(content);
  markdownCache.set(id, parsed);

  return parsed;
}

function readMaskedLink(text, start) {
  if (text[start] !== "[") return null;

  let i = start + 1;
  while (i < text.length && text[i] !== "]") i++;
  if (text[i] !== "]" || text[i + 1] !== "(") return null;

  const label = text.slice(start + 1, i);

  i += 2;

  let depth = 1;
  const urlStart = i;

  while (i < text.length && depth > 0) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    i++;
  }

  if (depth !== 0) return null;

  return {
    label,
    url: text.slice(urlStart, i - 1),
    end: i
  };
}

export function Embed(props) {
  const embed = props.embed;
  console.log(embed)
  if (embed.type == "image") return;

  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      class="embed_card x"
    >
      <div className="col fill">
        {embed.url && (
          <div class="embed_url">
            {embed.url.replace(/(^\w+:|^)\/\//, '')}
          </div>
        )}
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
        )}</div>
      <div className="col">
        {embed.image && (
          <div class="embed_timestamp">
            <img src={embed.image.url} alt="" />
          </div>
        )}
      </div>
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
          console.log("d")
          return (
            <img
              src={props.url}
              alt=""
              class="embedded_image"
              loading="lazy"
              onClick={() =>
                setPreview({
                  src: props.url,
                  type,
                })
              }
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
import { parseMarkdown as tokenizeMarkdown } from "./markdown_tokenizer.js";

let keyCounter = 0;

function getKey() {
  return `key_${keyCounter++}`;
}

function renderToken(token, depth = 0) {
  if (!token) return null;

  const key = getKey();

  if (depth > 50) {
    console.warn('renderToken: max depth exceeded');
    return null;
  }

  switch (token.type) {
    case 'text':
      return token.value;

    case 'bold':
      return <strong key={key}>{token.children?.map(t => renderToken(t, depth + 1))}</strong>;

    case 'underlineItalic':
      return <u key={key}><i>{token.children?.map(t => renderToken(t, depth + 1))}</i></u>;

    case 'strikethrough':
      return <s key={key}>{token.children?.map(t => renderToken(t, depth + 1))}</s>;

    case 'codeInline':
      return <kbd key={key}>{token.code}</kbd>;

    case 'codeBlock':
      return (
        <pre key={key} class="code_block">
          <code class={`lang-${token.language}`}>
            {token.code}
          </code>
        </pre>
      );

    case 'link':
      return (
        <a key={key} href={token.url} target="_blank" rel="noopener noreferrer">
          {token.label?.map(t => renderToken(t, depth + 1))}
        </a>
      );

    case 'url':
      if (token.url.match(/^https:\/\/chats\.mistium\.com\/emojis\/\d+$/)) {
        return <img key={key} class="inline_emoji" src={token.url} alt="" />;
      }
      return <EmbeddedLink key={key} url={token.url} />;

    case 'emoji':
      return (
        <img
          key={key}
          class="inline_emoji"
          src={`https://${token.host}/emojis/${token.id}`}
          alt=""
        />
      );
    case "newline":
      return <br key={key} />;
    case 'sticker':
      return (
        <img
          key={key}
          class="inline_sticker"
          src={`https://${token.host}/stickers/${token.id}`}
          alt=""
        />
      );

    case 'channel':
      const available = tempState.conn.channels?.()?.some(
        (x) => x.name === token.name
      );

      if (available) {
        return (
          <a
            key={key}
            href="#"
            class="channel_link"
            onClick={(e) => {
              e.preventDefault();
              setState("current", "channel", token.name);
              const serverSrc = state.current.server?.src;
              if (serverSrc) {
                setState("serverChannels", serverSrc, token.name);
              }
            }}
          >
            #{token.name}
          </a>
        );
      }
      return `#${token.name}`;

    case 'mention':
      return (
        <a
          key={key}
          href="#"
          class="mention"
          onClick={(e) => {
            e.preventDefault();
          }}
        >
          @{token.username}
        </a>
      );

    case 'roleMention':
      const entry = Object.entries(tempState.conn.roles?.() ?? {})
        .find(([, role]) => role.id === token.id);

      if (entry) {
        const [name, role] = entry;
        return (
          <span
            key={key}
            class="mention role_mention"
            style={role.color ? { color: role.color } : undefined}
          >
            @{name}
          </span>
        );
      }
      return `@${token.id}`;

    case 'heading':
      switch (token.level) {
        case 1:
          return <h1 key={key}>{token.children?.map(t => renderToken(t, depth + 1))}</h1>;
        case 2:
          return <h2 key={key}>{token.children?.map(t => renderToken(t, depth + 1))}</h2>;
        case 3:
          return <h3 key={key}>{token.children?.map(t => renderToken(t, depth + 1))}</h3>;
      }

    case 'small':
      return (
        <small key={key}>
          {token.children?.map(t => renderToken(t, depth + 1))}
        </small>
      );

    case 'blockquote':
      return (
        <blockquote key={key}>
          {token.children?.map((line, i) => (
            <>
              {line.children?.map(t => renderToken(t, depth + 1))}
              {i !== token.children.length - 1 && <br />}
            </>
          ))}
        </blockquote>
      );

    case 'list':
      return (
        <ul key={key}>
          <For each={token.items}>
            {(item) => (
              <li>
                {item.children?.map(t => renderToken(t, depth + 1))}
              </li>
            )}
          </For>
        </ul>
      );

    case 'paragraph':
      return (
        <>
          {token.children?.map(t => renderToken(t, depth + 1))}
        </>
      );

    default:
      return null;
  }
}

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

export function parseMarkdown(input) {
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
              key={getKey()}
              class="inline_emoji big_emoji"
              src={`https://${match[1]}/emojis/${match[2]}`}
              alt=""
            />
          );
        }

        return <span key={getKey()} class="big_emoji">{token}</span>;
      });
  }

  keyCounter = 0;

  const tokens = tokenizeMarkdown(input);
  const parts = [];

  tokens.forEach((token, i) => {
    const rendered = renderToken(token);
    if (rendered) {
      parts.push(rendered);
    }

    if (token.type === 'paragraph' && i !== tokens.length - 1) {
      parts.push(<br key={getKey()} />);
    }
  });

  return parts;
}