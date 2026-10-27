import emojis from "emoji-picker-element-data/en/emojibase/data.json";

function isWhitespace(char) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

const SHORTCODE_EMOJI_MAP = emojis.reduce((acc, entry) => {
  if (entry.shortcodes && entry.emoji) {
    for (const code of entry.shortcodes) {
      const key = code.toLowerCase();
      if (!(key in acc)) acc[key] = entry.emoji;
    }
  }
  return acc;
}, Object.create(null));

const NATIVE_EMOJI_REGEX =
  /^(?:\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)/u;

const CUSTOM_EMOJI_REGEX = /^<emoji:([a-zA-Z0-9.:-]+)\/([a-zA-Z0-9_-]+)>/;
const STICKER_REGEX = /^<sticker:([a-zA-Z0-9.:-]+)\/([a-zA-Z0-9_-]+)>/;
const USER_MENTION_REGEX = /^<@([a-zA-Z0-9-]+)>/;
const ROLE_MENTION_REGEX = /^<@&([a-zA-Z0-9-]+)>/;

function parseInlineContent(text, start = 0, endMarker = null) {
  const tokens = [];
  let i = start;
  const MAX_ITERATIONS = text.length * 2;
  let iterations = 0;

  while (i < text.length && iterations < MAX_ITERATIONS) {
    iterations++;
    const char = text[i];
    if (char === '\n') {
      tokens.push({ type: 'newline' });
      i++;
      continue;
    }

    if (endMarker && text.slice(i, i + endMarker.length) === endMarker) {
      break;
    }

    const italicMatch = tryParseItalic(text, i);
    if (italicMatch) {
      tokens.push(italicMatch.token);
      i = italicMatch.end;
      continue;
    }

    const boldMatch = tryParseBold(text, i);
    if (boldMatch) {
      tokens.push(boldMatch.token);
      i = boldMatch.end;
      continue;
    }

    const underlineMatch = tryParseUnderline(text, i);
    if (underlineMatch) {
      tokens.push(underlineMatch.token);
      i = underlineMatch.end;
      continue;
    }

    const strikethroughMatch = tryParseStrikethrough(text, i);
    if (strikethroughMatch) {
      tokens.push(strikethroughMatch.token);
      i = strikethroughMatch.end;
      continue;
    }

    const codeMatch = tryParseInlineCode(text, i);
    if (codeMatch) {
      tokens.push(codeMatch.token);
      i = codeMatch.end;
      continue;
    }

    const linkMatch = tryParseMaskedLink(text, i);
    if (linkMatch) {
      tokens.push(linkMatch.token);
      i = linkMatch.end;
      continue;
    }

    const timestampMatch = tryParseTimestamp(text, i);
    if (timestampMatch) {
      tokens.push(timestampMatch.token);
      i = timestampMatch.end;
      continue;
    }

    const emojiMatch = tryParseEmoji(text, i);
    if (emojiMatch) {
      tokens.push(emojiMatch.token);
      i = emojiMatch.end;
      continue;
    }

    const stickerMatch = tryParseSticker(text, i);
    if (stickerMatch) {
      tokens.push(stickerMatch.token);
      i = stickerMatch.end;
      continue;
    }

    const roleMentionMatch = tryParseRoleMention(text, i);
    if (roleMentionMatch) {
      tokens.push(roleMentionMatch.token);
      i = roleMentionMatch.end;
      continue;
    }

    const mentionMatch = tryParseMention(text, i);
    if (mentionMatch) {
      tokens.push(mentionMatch.token);
      i = mentionMatch.end;
      continue;
    }

    const urlMatch = tryParseUrl(text, i);
    if (urlMatch) {
      tokens.push(urlMatch.token);
      i = urlMatch.end;
      continue;
    }

    const shortcodeEmojiMatch = tryParseShortcodeEmoji(text, i);
    if (shortcodeEmojiMatch) {
      tokens.push(shortcodeEmojiMatch.token);
      i = shortcodeEmojiMatch.end;
      continue;
    }

    const nativeEmojiMatch = tryParseNativeEmoji(text, i);
    if (nativeEmojiMatch) {
      tokens.push(nativeEmojiMatch.token);
      i = nativeEmojiMatch.end;
      continue;
    }

    const textStart = i;
    while (
      i < text.length &&
      !isSpecialChar(text, i) &&
      (!endMarker || text.slice(i, i + endMarker.length) !== endMarker)
    ) {
      i++;
    }

    if (i > textStart) {
      const value = text.slice(textStart, i);
      if (tokens.length > 0 && tokens[tokens.length - 1].type === 'text') {
        tokens[tokens.length - 1].value += value;
      } else {
        tokens.push({ type: 'text', value });
      }
    }

    if (i === textStart) {
      tokens.push({ type: 'text', value: text[i] });
      i++;
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    console.warn('parseInlineContent: max iterations reached, possible infinite loop');
  }

  return { tokens, end: i };
}

function isSpecialChar(text, i) {
  const char = text[i];
  const next = text[i + 1];

  if (char === '*' && next === '*') return true;
  if (char === '*') return true;
  if (char === '_' && next === '_') return true;
  if (char === '~' && next === '~') return true;
  if (char === '`') return true;
  if (char === '[') return true;
  if (char === 'h' && (text.startsWith('http://', i) || text.startsWith('https://', i))) return true;
  if (char === '\n') return true;
  if (
    char === '<' &&
    (text.startsWith('<t:', i) ||
      text.startsWith('<emoji:', i) ||
      text.startsWith('<sticker:', i) ||
      text.startsWith('<@', i) ||
      text.startsWith('<http://', i) ||
      text.startsWith('<https://', i))
  ) {
    return true;
  }
  if (char === ':' && /^:[a-zA-Z0-9_+-]+:/.test(text.slice(i))) return true;
  if (NATIVE_EMOJI_REGEX.test(text.slice(i))) return true;

  return false;
}

function tryParseItalic(text, i) {
  if (text[i] !== '*') return null;
  if (text[i + 1] === '*') return null;

  const j = text.indexOf('*', i + 1);
  if (j === -1) return null;

  const content = text.slice(i + 1, j);
  const { tokens } = parseInlineContent(content, 0);

  return {
    token: { type: 'italic', children: tokens },
    end: j + 1
  };
}

function tryParseBold(text, i) {
  if (text.slice(i, i + 2) !== '**') return null;

  const j = text.indexOf('**', i + 2);
  if (j === -1) return null;

  const content = text.slice(i + 2, j);
  const { tokens } = parseInlineContent(content, 0);

  return {
    token: { type: 'bold', children: tokens },
    end: j + 2
  };
}

function tryParseUnderline(text, i) {
  if (text.slice(i, i + 2) !== '__') return null;

  const j = text.indexOf('__', i + 2);
  if (j === -1) return null;

  const content = text.slice(i + 2, j);
  const { tokens } = parseInlineContent(content, 0);

  return {
    token: { type: 'underlineItalic', children: tokens },
    end: j + 2
  };
}

function tryParseStrikethrough(text, i) {
  if (text.slice(i, i + 2) !== '~~') return null;

  const j = text.indexOf('~~', i + 2);
  if (j === -1) return null;

  const content = text.slice(i + 2, j);
  const { tokens } = parseInlineContent(content, 0);

  return {
    token: { type: 'strikethrough', children: tokens },
    end: j + 2
  };
}

function tryParseInlineCode(text, i) {
  if (text[i] !== '`') return null;

  const j = text.indexOf('`', i + 1);
  if (j === -1) return null;

  const code = text.slice(i + 1, j);

  return {
    token: { type: 'codeInline', code },
    end: j + 1
  };
}

function tryParseMaskedLink(text, i) {
  if (text[i] !== '[') return null;

  let j = i + 1;
  while (j < text.length && text[j] !== ']') {
    j++;
  }

  if (j >= text.length || text[j + 1] !== '(') return null;

  const label = text.slice(i + 1, j);
  let k = j + 2;
  let depth = 1;
  const urlStart = k;

  while (k < text.length && depth > 0) {
    if (text[k] === '(') depth++;
    else if (text[k] === ')') depth--;
    k++;
  }

  if (depth !== 0) return null;

  const url = text.slice(urlStart, k - 1);
  const { tokens: labelTokens } = parseInlineContent(label, 0);

  return {
    token: { type: 'link', label: labelTokens, url },
    end: k
  };
}

function tryParseUrl(text, i) {
  const wrapped = text[i] === '<';
  const start = wrapped ? i + 1 : i;

  let protocolLen;

  if (text.slice(start, start + 7) === 'http://') {
    protocolLen = 7;
  } else if (text.slice(start, start + 8) === 'https://') {
    protocolLen = 8;
  } else {
    return null;
  }

  let j = start + protocolLen;

  while (
    j < text.length &&
    !isWhitespace(text[j]) &&
    text[j] !== '"' &&
    text[j] !== "'" &&
    (!wrapped || text[j] !== '>')
  ) {
    j++;
  }

  if (wrapped) {
    if (text[j] !== '>') return null;
    j++;
  }

  const url = text.slice(start, wrapped ? j - 1 : j);

  return {
    token: { type: 'url', url: wrapped ? `<${url}>` : url },
    end: j
  };
}

function tryParseTimestamp(text, i) {
  if (text[i] !== '<') return null;

  const match = text
    .slice(i)
    .match(/^<t:(\d+)(?::([tTdDfFR]))?>/);

  if (!match) return null;

  return {
    token: {
      type: "timestamp",
      unix: Number(match[1]),
      style: match[2] || "f"
    },
    end: i + match[0].length
  };
}

function tryParseEmoji(text, i) {
  if (text[i] !== '<') return null;

  const match = text.slice(i).match(CUSTOM_EMOJI_REGEX);
  if (!match) return null;

  return {
    token: { type: 'emoji', host: match[1], id: match[2] },
    end: i + match[0].length
  };
}

function tryParseSticker(text, i) {
  if (text[i] !== '<') return null;

  const match = text.slice(i).match(STICKER_REGEX);
  if (!match) return null;

  return {
    token: { type: 'sticker', host: match[1], id: match[2] },
    end: i + match[0].length
  };
}

function tryParseRoleMention(text, i) {
  if (text[i] !== '<') return null;

  const match = text.slice(i).match(ROLE_MENTION_REGEX);
  if (!match) return null;

  return {
    token: { type: 'roleMention', id: match[1] },
    end: i + match[0].length
  };
}

function tryParseMention(text, i) {
  if (text[i] !== '<') return null;

  const match = text.slice(i).match(USER_MENTION_REGEX);
  if (!match) return null;

  return {
    token: { type: 'mention', id: match[1] },
    end: i + match[0].length
  };
}

function tryParseShortcodeEmoji(text, i) {
  if (text[i] !== ':') return null;

  const match = text.slice(i).match(/^:([a-zA-Z0-9_+-]+):/);
  if (!match) return null;

  const name = match[1].toLowerCase();
  const char = SHORTCODE_EMOJI_MAP[name];
  if (typeof char !== "string" || !char) return null;

  return {
    token: { type: 'nativeEmoji', char, shortcode: name },
    end: i + match[0].length
  };
}

function tryParseNativeEmoji(text, i) {
  const slice = text.slice(i);
  const match = slice.match(NATIVE_EMOJI_REGEX);

  if (!match || !match[0]) return null;

  return {
    token: { type: 'nativeEmoji', char: match[0] },
    end: i + match[0].length
  };
}

function parseMarkdown(input) {
  if (!input?.length) return;
  const lines = input.split('\n');
  const tokens = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      const codeBlock = parseCodeBlock(lines, i);
      tokens.push(codeBlock.token);
      i = codeBlock.end;
      continue;
    }

    if (line.startsWith('### ')) {
      tokens.push(parseHeading(line, 3));
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      tokens.push(parseHeading(line, 2));
      i++;
      continue;
    }

    if (line.startsWith('# ')) {
      tokens.push(parseHeading(line, 1));
      i++;
      continue;
    }

    if (line.startsWith('-# ')) {
      const { tokens: children } = parseInlineContent(line.slice(3));
      tokens.push({ type: 'small', children });
      i++;
      continue;
    }

    if (line.match(/^[-*] /)) {
      const list = parseList(lines, i);
      tokens.push(list.token);
      i = list.end;
      continue;
    }

    if (line.startsWith('> ')) {
      const blockquote = parseBlockquote(lines, i);
      tokens.push(blockquote.token);
      i = blockquote.end;
      continue;
    }

    if (line.trim()) {
      const paragraph = [line];
      i++;

      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].startsWith("```") &&
        !lines[i].startsWith("#") &&
        !lines[i].startsWith("> ") &&
        !lines[i].match(/^[-*] /) &&
        !lines[i].startsWith("-# ")
      ) {
        paragraph.push(lines[i]);
        i++;
      }

      const { tokens: inlineTokens } = parseInlineContent(
        paragraph.join("\n")
      );

      tokens.push({
        type: "paragraph",
        children: inlineTokens
      });

      continue;
    }

    i++;
  }

  return tokens;
}

function parseCodeBlock(lines, startLine) {
  const langLine = lines[startLine];
  const language = langLine.slice(3).trim() || '';
  const code = [];

  let i = startLine + 1;
  while (i < lines.length && !lines[i].trim().startsWith('```')) {
    code.push(lines[i]);
    i++;
  }

  return {
    token: {
      type: 'codeBlock',
      language,
      code: code.join('\n')
    },
    end: i + 1
  };
}

function parseHeading(line, level) {
  const prefix = '#'.repeat(level) + ' ';
  const content = line.slice(prefix.length);
  const { tokens: children } = parseInlineContent(content);

  return {
    type: 'heading',
    level,
    children
  };
}

function parseList(lines, startLine) {
  const items = [];
  let i = startLine;

  while (i < lines.length && lines[i].match(/^[-*] /)) {
    const itemContent = lines[i].slice(2);
    const { tokens: children } = parseInlineContent(itemContent);
    items.push({ type: 'listItem', children });
    i++;
  }

  return {
    token: {
      type: 'list',
      items
    },
    end: i
  };
}

function parseBlockquote(lines, startLine) {
  const quotes = [];
  let i = startLine;

  while (i < lines.length && lines[i].startsWith('> ')) {
    const content = lines[i].slice(2);
    const { tokens: children } = parseInlineContent(content);
    quotes.push({ type: 'line', children });
    i++;
  }

  return {
    token: {
      type: 'blockquote',
      children: quotes
    },
    end: i
  };
}

export { parseMarkdown };
