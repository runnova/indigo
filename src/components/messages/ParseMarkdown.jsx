import { For, createResource, createSignal, Show } from "solid-js";
import { setPreview } from "../../App";
import { openPopout } from "../rightSidebar/memberList/popout.jsx";
import { twemojiUrl } from "./twemoji.js";
import { getEmbedProvider } from "./embeds/registry.jsx";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import { state, tempState } from "../../App";
import { parseMarkdown as tokenizeMarkdown } from "./markdown_tokenizer.js";

const markdownCache = new Map();

const ROTUR_API_HOST = "api.rotur.dev";

function customEmojiUrl(host, id) {
  if (host === ROTUR_API_HOST) {
    return `https://${ROTUR_API_HOST}/v2/emojis/${id}`;
  }
  return `https://${host}/emojis/${id}`;
}

function customStickerUrl(host, id) {
  return `https://${host}/stickers/${id}`;
}

function emojiOwnerLabel(host) {
  return host.startsWith("api.rotur") ? "User" : "Server";
}

function resolveUsername(id) {
  const me = tempState.conn?.me?.();
  if (me?.id === id) return me.username;
  const users = tempState.conn?.users?.();
  const list = Array.isArray(users) ? users : Object.values(users ?? {});
  return list.find((u) => u?.id === id)?.username ?? null;
}

function getParsedMarkdown(id, content) {
  if (markdownCache.has(id)) {
    return markdownCache.get(id);
  }

  const parsed = parseMarkdown(content);
  markdownCache.set(id, parsed);

  return parsed;
}

export function Embed(props) {
  const embed = props.embed;
  if (embed.type == "image") return;

  const provider = getEmbedProvider(embed.url);
  if (provider) {
    const Custom = provider.Component;
    return <Custom url={embed.url} embed={embed} />;
  }

  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      class="embed_card x"
    >
      <div className="col fill">
        {embed.url && (
          <div class="embed_url">{embed.url.replace(/(^\w+:|^)\/\//, "")}</div>
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

        {embed.title && <div class="embed_title">{embed.title}</div>}

        {embed.description && (
          <div class="embed_description">
            {renderTokens(tokenizeMarkdown(embed.description))}
          </div>
        )}

        {embed.timestamp && (
          <div class="embed_timestamp">
            {new Date(embed.timestamp).toLocaleString()}
          </div>
        )}
      </div>
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

function EmbeddedLink(props) {
  const [info] = createResource(async () => {
    try {
      const res = await fetch(props.url, {
        method: "HEAD",
      });

      const type = res.headers.get("content-type") || "";

      return {
        type,
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
              data-context="attachment"
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
              data-context="attachment"
              controls
              class="embedded_video"
              loading="lazy"
            />
          );
        }

        if (type.startsWith("audio/")) {
          return (
            <audio
              data-context="attachment"
              src={props.url}
              controls
              loading="lazy"
            />
          );
        }

        return (
          <a href={props.url} target="_blank" rel="noopener noreferrer">
            {props.url}
          </a>
        );
      }}
    </Show>
  );
}

let keyCounter = 0;

function getKey() {
  return `key_${keyCounter++}`;
}

function syntaxHighlight(code, language) {
  if (!language) {
    return code;
  }

  try {
    return hljs.highlight(code, { language }).value;
  } catch (e) {
    return hljs.highlightAuto(code).value;
  }
}

function CodeBlockDisplay(props) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(props.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightedCode = syntaxHighlight(props.code, props.language);

  return (
    <div class="code_block_container">
      <div class="code_block_header">
        <span class="code_block_language">{props.language || "text"}</span>
        <button class="code_block_copy" onClick={handleCopy} title="Copy code">
          {copied() ? "Copied" : "Copy"}
        </button>
      </div>
      <pre class="code_block_content">
        <code
          class={`hljs lang-${props.language || "text"}`}
          innerHTML={highlightedCode}
        />
      </pre>
    </div>
  );
}

function renderToken(token, depth = 0) {
  if (!token) return null;

  const key = getKey();

  if (depth > 50) {
    console.warn("renderToken: max depth exceeded");
    return null;
  }

  switch (token.type) {
    case "text":
      return token.value;

    case "italic":
      return (
        <i key={key}>{token.children?.map((t) => renderToken(t, depth + 1))}</i>
      );

    case "bold":
      return (
        <strong key={key}>
          {token.children?.map((t) => renderToken(t, depth + 1))}
        </strong>
      );

    case "underlineItalic":
      return (
        <u key={key}>
          <i>{token.children?.map((t) => renderToken(t, depth + 1))}</i>
        </u>
      );

    case "strikethrough":
      return (
        <s key={key}>{token.children?.map((t) => renderToken(t, depth + 1))}</s>
      );

    case "codeInline":
      return <kbd key={key}>{token.code}</kbd>;

    case "codeBlock":
      return (
        <CodeBlockDisplay
          key={key}
          code={token.code}
          language={token.language}
        />
      );

    case "link":
      return (
        <a key={key} href={token.url} target="_blank" rel="noopener noreferrer">
          {token.label?.map((t) => renderToken(t, depth + 1))}
        </a>
      );

    case "url": {
      const url = token.url;
      const isEmbedless =
        url.startsWith("<") && url.endsWith(">") && url.length > 2;
      const cleanUrl = isEmbedless ? url.slice(1, -1) : url;

      const provider = getEmbedProvider(cleanUrl);
      if (provider) {
        const Custom = provider.Component;
        return <Custom key={key} url={cleanUrl} />;
      }
      if (isEmbedless) {
        return (
          <span key={key} class="embedless_link">
            {cleanUrl}
          </span>
        );
      }
      return <EmbeddedLink key={key} url={cleanUrl} />;
    }

    case "emoji": {
      const src = customEmojiUrl(token.host, token.id);
      return (
        <img
          key={key}
          class="inline_emoji"
          src={src}
          alt=""
          data-tooltip={`${emojiOwnerLabel(token.host)} Emoji: Emoji from ${token.host}`}
          data-tooltip-icon={src}
        />
      );
    }

    case "nativeEmoji": {
      if (!state.settings.twemoji) {
        return token.char;
      }
      return (
        <img
          key={key}
          class="inline_emoji twemoji"
          src={twemojiUrl(token.char)}
          alt={token.char}
          draggable={false}
          loading="lazy"
          data-tooltip="System Emoji: This is a default emoji"
          data-tooltip-icon={twemojiUrl(token.char)}
        />
      );
    }

    case "newline":
      return <br key={key} />;

    case "sticker": {
      const src = customStickerUrl(token.host, token.id);
      return (
        <img
          key={key}
          class="inline_sticker"
          src={src}
          alt=""
          data-tooltip={`${emojiOwnerLabel(token.host)} Sticker: Sticker from ${token.host}`}
          data-tooltip-icon={src}
        />
      );
    }

    case "timestamp": {
      const date = new Date(token.unix * 1000);

      switch (token.style) {
        case "R": {
          const diff = token.unix - Math.floor(Date.now() / 1000);
          const abs = Math.abs(diff);

          let value;
          if (abs < 60) value = `${abs} second${abs !== 1 ? "s" : ""}`;
          else if (abs < 3600) {
            const m = Math.floor(abs / 60);
            value = `${m} minute${m !== 1 ? "s" : ""}`;
          } else if (abs < 86400) {
            const h = Math.floor(abs / 3600);
            value = `${h} hour${h !== 1 ? "s" : ""}`;
          } else {
            const d = Math.floor(abs / 86400);
            value = `${d} day${d !== 1 ? "s" : ""}`;
          }

          return diff >= 0 ? `in ${value}` : `${value} ago`;
        }

        case "t":
          return date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          });

        case "T":
          return date.toLocaleTimeString();

        case "d":
          return date.toLocaleDateString();

        case "D":
          return date.toLocaleDateString([], {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

        case "f":
          return date.toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          });

        case "F":
          return date.toLocaleString([], {
            dateStyle: "full",
            timeStyle: "long",
          });

        default:
          return date.toLocaleString();
      }
    }

    case "mention": {
      const username = resolveUsername(token.id);
      const me = tempState?.conn?.me?.();
      const isMe = me?.id === token.id;
      const name = username ?? token.id;
      return (
        <a
          key={key}
          href=""
          class={`mention ${isMe ? "is-self" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            openPopout(name, e.currentTarget);
          }}
        >
          @
          <img
            src={`https://avatars.rotur.dev/${name}`}
            alt=""
            class="pfp"
            loading="lazy"
          />
          {name}
        </a>
      );
    }

    case "roleMention": {
      const entry = Object.entries(tempState.conn?.roles?.() ?? {}).find(
        ([, role]) => role.id === token.id,
      );

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
    }

    case "heading":
      switch (token.level) {
        case 1:
          return (
            <h1 key={key}>
              {token.children?.map((t) => renderToken(t, depth + 1))}
            </h1>
          );
        case 2:
          return (
            <h2 key={key}>
              {token.children?.map((t) => renderToken(t, depth + 1))}
            </h2>
          );
        case 3:
          return (
            <h3 key={key}>
              {token.children?.map((t) => renderToken(t, depth + 1))}
            </h3>
          );
        default:
          return null;
      }

    case "small":
      return (
        <small key={key}>
          {token.children?.map((t) => renderToken(t, depth + 1))}
        </small>
      );

    case "blockquote":
      return (
        <blockquote key={key}>
          {token.children?.map((line, i) => (
            <>
              {line.children?.map((t) => renderToken(t, depth + 1))}
              {i !== token.children.length - 1 && <br />}
            </>
          ))}
        </blockquote>
      );

    case "list":
      return (
        <ul key={key}>
          <For each={token.items}>
            {(item) => (
              <li>{item.children?.map((t) => renderToken(t, depth + 1))}</li>
            )}
          </For>
        </ul>
      );

    case "paragraph":
      return <>{token.children?.map((t) => renderToken(t, depth + 1))}</>;

    default:
      return null;
  }
}

function renderTokens(tokens) {
  keyCounter = 0;
  const parts = [];

  tokens?.forEach((token, i) => {
    const rendered = renderToken(token);

    if (rendered) {
      parts.push(rendered);
    }

    if (token.type === "paragraph" && tokens[i + 1]?.type === "paragraph") {
      parts.push(<br key={getKey()} />);
      parts.push(<br key={getKey()} />);
    }
  });

  return parts;
}

const BIG_EMOJI_CUSTOM_REGEX = /^<emoji:([a-zA-Z0-9.:-]+)\/([a-zA-Z0-9_-]+)>$/;

function isBigEmojiMessage(input) {
  if (!input) return;
  const trimmed = input.trim();

  const tokens = trimmed.split(/\s+/).filter(Boolean);

  if (tokens.length === 0 || tokens.length > 3) {
    return false;
  }

  return tokens.every(
    (token) =>
      BIG_EMOJI_CUSTOM_REGEX.test(token) ||
      /\p{Extended_Pictographic}/u.test(token),
  );
}

export function parseMarkdown(input) {
  if (isBigEmojiMessage(input)) {
    return input
      .trim()
      .split(/\s+/)
      .map((token) => {
        const match = token.match(BIG_EMOJI_CUSTOM_REGEX);

        if (match) {
          const src = customEmojiUrl(match[1], match[2]);
          return (
            <img
              key={getKey()}
              class="inline_emoji big_emoji"
              src={src}
              alt=""
              data-tooltip={`${emojiOwnerLabel(match[1])} Emoji: Emoji from ${match[1]}`}
              data-tooltip-icon={src}
            />
          );
        }

        if (
          state.settings.twemoji &&
          /\p{Extended_Pictographic}/u.test(token)
        ) {
          return (
            <img
              key={getKey()}
              class="inline_emoji big_emoji twemoji"
              src={twemojiUrl(token)}
              alt={token}
              draggable={false}
              loading="lazy"
              data-tooltip="System Emoji: This is a default emoji"
              data-tooltip-icon={twemojiUrl(token)}
            />
          );
        }

        return (
          <span key={getKey()} class="big_emoji">
            {token}
          </span>
        );
      });
  }

  return renderTokens(tokenizeMarkdown(input));
}
