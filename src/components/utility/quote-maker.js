const DEFAULTS = {
  width: 1600,
  height: 900,
  background: '#1e1f22',
  textColor: '#f2f3f5',
  authorColor: '#b5bac1',
  contentFont: 'Georgia, "Times New Roman", serif',
  authorFont: '"Segoe UI", Helvetica, Arial, sans-serif',
  watermarkText: 'indigo client',
  watermarkIconUrl: '/icon_small.svg',
  grayscalePfp: false,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl = null;

    if (src instanceof Blob) {
      objectUrl = URL.createObjectURL(src);
      img.src = objectUrl;
    } else {
      img.crossOrigin = 'anonymous';
      img.src = src;
    }

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (err) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${src instanceof Blob ? '[blob]' : src}`));
    };
  });
}

function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const rectRatio = w / h;

  let sx, sy, sw, sh;
  if (imgRatio > rectRatio) {
    sh = img.height;
    sw = sh * rectRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / rectRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapText(ctx, text, maxWidth) {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ').filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${current} ${words[i]}`;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

function fitTextToBox(ctx, text, { maxWidth, maxHeight, maxSize, minSize, fontFamily, fontWeight = 400, lineHeightRatio = 1.28 }) {
  let fontSize = maxSize;
  let lines = [];
  let lineHeight = 0;

  while (fontSize >= minSize) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    lines = wrapText(ctx, text, maxWidth);
    lineHeight = fontSize * lineHeightRatio;
    const totalHeight = lines.length * lineHeight;
    if (totalHeight <= maxHeight) {
      return { fontSize, lines, lineHeight };
    }
    fontSize -= 2;
  }
  ctx.font = `${fontWeight} ${minSize}px ${fontFamily}`;
  lines = wrapText(ctx, text, maxWidth);
  lineHeight = minSize * lineHeightRatio;
  return { fontSize: minSize, lines, lineHeight };
}

export async function generateQuoteImage(options) {
  const opts = { ...DEFAULTS, ...options };
  const {
    pfpUrl, content, author,
    width, height, background, textColor, authorColor,
    contentFont, authorFont, watermarkText, watermarkIconUrl,
    grayscalePfp,
  } = opts;

  if (!content) throw new Error('generateQuoteImage: "content" is required.');

  const canvas = opts.canvas || document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const pfpAreaWidth = width * 0.52; 
  const fadeStart = width * 0.16; 
  const fadeEnd = pfpAreaWidth; 
  const contentX = width * 0.40;
  const contentRightMargin = width * 0.06;
  const contentMaxWidth = width - contentX - contentRightMargin;
  const contentCenterX = contentX + contentMaxWidth / 2;

  if (pfpUrl) {
    try {
      const img = await loadImage(pfpUrl);

      if (grayscalePfp) {
        const off = document.createElement('canvas');
        off.width = pfpAreaWidth;
        off.height = height;
        const offCtx = off.getContext('2d');
        drawImageCover(offCtx, img, 0, 0, pfpAreaWidth, height);
        const frame = offCtx.getImageData(0, 0, pfpAreaWidth, height);
        const d = frame.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          d[i] = d[i + 1] = d[i + 2] = gray;
        }
        offCtx.putImageData(frame, 0, 0);
        ctx.drawImage(off, 0, 0);
      } else {
        drawImageCover(ctx, img, 0, 0, pfpAreaWidth, height);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, pfpAreaWidth, height);
    } catch (err) {
      console.warn(err.message);
    }
  }

  const gradient = ctx.createLinearGradient(fadeStart, 0, fadeEnd, 0);
  gradient.addColorStop(0, hexToRgba(background, 0));
  gradient.addColorStop(1, hexToRgba(background, 1));
  ctx.fillStyle = gradient;
  ctx.fillRect(fadeStart, 0, fadeEnd - fadeStart, height);

  const authorFontSize = Math.round(height * 0.033);
  const watermarkFontSize = Math.round(height * 0.022);
  const topMargin = height * 0.12;
  const bottomReserved = authorFontSize * 1.28 + watermarkFontSize * 3;
  const contentMaxHeight = height - topMargin - bottomReserved;

  const { fontSize, lines, lineHeight } = fitTextToBox(ctx, content, {
    maxWidth: contentMaxWidth,
    maxHeight: contentMaxHeight,
    maxSize: Math.round(height * 0.14),
    minSize: Math.round(height * 0.035),
    fontFamily: contentFont,
    fontWeight: 400,
    lineHeightRatio: 1.3,
  });

  ctx.font = `${fontSize}px ${contentFont}`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const totalTextHeight = lines.length * lineHeight;
  const textStartY = topMargin + (contentMaxHeight - totalTextHeight) / 2 + fontSize * 0.85;

  ctx.save();
  ctx.font = `italic ${Math.round(fontSize * 1.6)}px ${contentFont}`;
  ctx.fillStyle = hexToRgba(textColor, 0.18);
  ctx.textAlign = 'center';
  ctx.fillText('“', contentCenterX, textStartY - lineHeight * 0.55);
  ctx.restore();

  lines.forEach((line, i) => {
    ctx.fillText(line, contentCenterX, textStartY + i * lineHeight);
  });

  if (author) {
    const authorY = textStartY + (lines.length - 1) * lineHeight + authorFontSize * 1.9;
    ctx.font = `600 ${authorFontSize}px ${authorFont}`;
    ctx.fillStyle = authorColor;
    ctx.textAlign = 'right';
    ctx.fillText(`- ${author}`, contentX + contentMaxWidth, authorY);
  }

  await drawWatermark(ctx, {
    width, height, watermarkText, watermarkIconUrl, watermarkFontSize, authorFont,
  });

  return canvas;
}

async function drawWatermark(ctx, { width, height, watermarkText, watermarkIconUrl, watermarkFontSize, authorFont }) {
  const margin = width * 0.03;
  const iconSize = watermarkFontSize * 1.4;
  const gap = watermarkFontSize * 0.5;

  ctx.font = `500 ${watermarkFontSize}px ${authorFont}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const textWidth = ctx.measureText(watermarkText).width;

  const y = height - margin - iconSize / 2;
  const textX = width - margin;
  const iconX = textX - textWidth - gap - iconSize;

  let icon = null;
  if (watermarkIconUrl) {
    try {
      icon = await loadImage(watermarkIconUrl);
    } catch (err) {
      console.warn(`Watermark icon not loaded (${err.message}); falling back to text-only watermark.`);
    }
  }

  ctx.save();
  ctx.globalAlpha = 0.75;

  if (icon) {
    ctx.drawImage(icon, iconX, y - iconSize / 2, iconSize, iconSize);
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillText(watermarkText, textX, y + 1);
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((ch) => ch + ch).join('');
  }
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob() returned null.'));
    }, type, quality);
  });
}

export async function downloadQuoteImage(canvas, filename = 'quote.png') {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}