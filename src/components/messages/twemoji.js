export function toTwemojiCodepoints(char) {
  const codepoints = [];
  for (const c of char) {
    let cp = c.codePointAt(0);
    if (cp === 0xfe0f) continue;
    codepoints.push(cp.toString(16));
  }
  return codepoints.join("-");
}

export function twemojiUrl(char) {
  const cp = toTwemojiCodepoints(char);
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${cp}.png`;
}
