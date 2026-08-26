import { iconToSvg } from "rotur-sdk";

const ALLOWED_TAGS = new Set(["svg", "path", "line", "circle", "rect", "polyline", "polygon"]);
const ALLOWED_ATTRS = new Set([
  "xmlns",
  "viewBox",
  "d",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "width",
  "height",
  "points",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "fill",
]);

export function renderICN(code) {
  const raw = iconToSvg(code);
  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");

  if (doc.querySelector("parsererror")) return "";

  const root = doc.documentElement;

  if (root.tagName !== "svg") return "";

  const walk = (el) => {
    for (const child of Array.from(el.children)) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.remove();
        continue;
      }

      walk(child);
    }

    for (const attr of Array.from(el.attributes)) {
      if (!ALLOWED_ATTRS.has(attr.name)) {
        el.removeAttribute(attr.name);
      }
    }
  };

  walk(root);

  return new XMLSerializer().serializeToString(root);
}
