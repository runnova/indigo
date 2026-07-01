
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
  console.log(embed)

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