function isWhitespace(char) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function isAlphanumeric(char) {
  return /[a-zA-Z0-9_]/.test(char);
}

function peekChar(text, i, offset = 1) {
  return text[i + offset] || null;
}

function consumeWhile(text, i, predicate) {
  while (i < text.length && predicate(text[i])) {
    i++;
  }
  return i;
}

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

    const urlMatch = tryParseUrl(text, i);
    if (urlMatch) {
      tokens.push(urlMatch.token);
      i = urlMatch.end;
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

    const channelMatch = tryParseChannel(text, i);
    if (channelMatch) {
      tokens.push(channelMatch.token);
      i = channelMatch.end;
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
  if (char === '_' && next === '_') return true;
  if (char === '~' && next === '~') return true;
  if (char === '`') return true;
  if (char === '[') return true;
  if (char === 'h' && (text.slice(i, i + 7) === 'http://' || text.slice(i, i + 8) === 'https://')) return true;
  if (char === 'o' && text.slice(i, i + 11) === 'originChats:') return true;
  if (char === '@') return true;
  if (char === '\n') return true;

  return false;
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
  if (text.slice(i, i + 7) === 'http://') {
    return parseHttpUrl(text, i, 7);
  }
  if (text.slice(i, i + 8) === 'https://') {
    return parseHttpUrl(text, i, 8);
  }
  return null;
}

function parseHttpUrl(text, i, protocolLen) {
  let j = i + protocolLen;
  while (j < text.length && !isWhitespace(text[j]) && text[j] !== '"' && text[j] !== "'") {
    j++;
  }

  const url = text.slice(i, j);
  return { token: { type: 'url', url }, end: j };
}

function tryParseEmoji(text, i) {
  if (!text.slice(i).startsWith('originChats:<emoji>//')) return null;

  const urlStart = i + 'originChats:<emoji>//'.length;
  let j = urlStart;

  while (j < text.length && !isWhitespace(text[j])) {
    j++;
  }

  const urlPart = text.slice(urlStart, j);
  const match = urlPart.match(/^(.+)\/(\d+)$/);

  if (!match) return null;

  const [, host, id] = match;

  return {
    token: { type: 'emoji', host, id },
    end: j
  };
}

function tryParseSticker(text, i) {
  if (!text.slice(i).startsWith('originChats:<sticker>//')) return null;

  const urlStart = i + 'originChats:<sticker>//'.length;
  let j = urlStart;

  while (j < text.length && !isWhitespace(text[j])) {
    j++;
  }

  const urlPart = text.slice(urlStart, j);
  const match = urlPart.match(/^(.+)\/(\d+)$/);

  if (!match) return null;

  const [, host, id] = match;

  return {
    token: { type: 'sticker', host, id },
    end: j
  };
}

function tryParseChannel(text, i) {
  if (!text.slice(i).startsWith('originChats://')) return null;

  let j = i + 'originChats://'.length;

  while (j < text.length && !isWhitespace(text[j])) {
    j++;
  }

  const channel = text.slice(i + 'originChats://'.length, j);

  return {
    token: { type: 'channel', name: channel },
    end: j
  };
}

function tryParseRoleMention(text, i) {
  if (text[i] !== '@' || text[i + 1] !== '&') return null;

  let j = i + 2;
  while (j < text.length && (isAlphanumeric(text[j]) || text[j] === '-')) {
    j++;
  }

  if (j === i + 2) return null;

  const id = text.slice(i + 2, j);

  return {
    token: { type: 'roleMention', id },
    end: j
  };
}

function tryParseMention(text, i) {
  if (text[i] !== '@') return null;

  let j = i + 1;
  while (j < text.length && isAlphanumeric(text[j])) {
    j++;
  }

  if (j === i + 1) return null;

  const username = text.slice(i + 1, j);

  return {
    token: { type: 'mention', username },
    end: j
  };
}

function parseMarkdown(input) {
  const lines = input.split('\n');
  const tokens = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const codeBlock = parseCodeBlock(lines, i);
      tokens.push(codeBlock.token);
      i = codeBlock.end;
      continue;
    }

    if (line.startsWith('### ')) {
      const heading = parseHeading(line, 3);
      tokens.push(heading);
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      const heading = parseHeading(line, 2);
      tokens.push(heading);
      i++;
      continue;
    }

    if (line.startsWith('# ')) {
      const heading = parseHeading(line, 1);
      tokens.push(heading);
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
  while (i < lines.length && !lines[i].startsWith('```')) {
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