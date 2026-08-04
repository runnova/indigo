import { Show, onMount, onCleanup, createSignal, children, createEffect } from "solid-js";
import { HiOutlineXMark } from "solid-icons/hi";
import { render } from "solid-js/web";

const MIN_WIDTH = 320;
const MIN_HEIGHT = 200;
const SNAP_DISTANCE = 24;

let topZIndex = 100;

export default function Dialog(props) {
  let dialog;

  const [zIndex, setZIndex] = createSignal(topZIndex);

  const bringToFront = () => {
    topZIndex += 1;
    setZIndex(topZIndex);
  };

  createEffect(() => {
    if (!props.open || !dialog) return;

    const header = dialog.querySelector(".dialog_header");
    if (!header) return;

    if (header.querySelector(".dialog_close")) return;

    const button = document.createElement("c");
    button.className = "dialog_close";
    button.setAttribute("aria-label", "Close dialog");

    const dispose = render(
      () => <HiOutlineXMark size={24} />,
      button
    );

    button.onclick = () => props.onClose?.();

    header.appendChild(button);

    onCleanup(() => {
      dispose();
      button.remove();
    });
  });

  createEffect(() => {
    if (props.open) bringToFront();
  });

  let dragging = false;
  let resizing = false;
  let resizeDir = "";

  const [rect, setRect] = createSignal({
    x: window.innerWidth / 2 - 500,
    y: window.innerHeight / 2 - 400,
    width: 1000,
    height: 800,
  });

  const handleKeyDown = (e) => {
    if (e.key === "Escape") props.onClose?.();
  };

  const beginDrag = (e) => {
    bringToFront();

    const header = e.target.closest(".dialog_header");
    if (!header) return;

    dragging = true;

    const startX = e.clientX;
    const startY = e.clientY;
    const start = rect();

    const move = (ev) => {
      if (!dragging) return;

      setRect({
        ...start,
        x: start.x + ev.clientX - startX,
        y: start.y + ev.clientY - startY,
      });
    };

    const up = () => {
      dragging = false;

      const r = rect();

      if (r.x <= SNAP_DISTANCE) {
        setRect({
          x: 0,
          y: 0,
          width: window.innerWidth / 2,
          height: window.innerHeight,
        });
      } else if (
        r.x + r.width >=
        window.innerWidth - SNAP_DISTANCE
      ) {
        setRect({
          x: window.innerWidth / 2,
          y: 0,
          width: window.innerWidth / 2,
          height: window.innerHeight,
        });
      } else if (r.y <= SNAP_DISTANCE) {
        setRect({
          x: 0,
          y: 0,
          width: window.innerWidth,
          height: window.innerHeight / 2,
        });
      }

      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const beginResize = (e, dir) => {
    e.stopPropagation();
    bringToFront();

    resizing = true;
    resizeDir = dir;

    const start = rect();
    const sx = e.clientX;
    const sy = e.clientY;

    const move = (ev) => {
      let { x, y, width, height } = start;

      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;

      if (resizeDir.includes("e"))
        width = Math.max(MIN_WIDTH, start.width + dx);

      if (resizeDir.includes("s"))
        height = Math.max(MIN_HEIGHT, start.height + dy);

      if (resizeDir.includes("w")) {
        width = Math.max(MIN_WIDTH, start.width - dx);
        x = start.x + (start.width - width);
      }

      if (resizeDir.includes("n")) {
        height = Math.max(MIN_HEIGHT, start.height - dy);
        y = start.y + (start.height - height);
      }

      setRect({ x, y, width, height });
    };

    const up = () => {
      resizing = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  const resolvedChildren = children(() => props.children);

  return (
    <Show when={props.open}>
      <div
        class="dialog_overlay"
        style={{ "z-index": zIndex() }}
      >
        <div
          ref={dialog}
          class="dialog"
          onPointerDown={(e) => {
            bringToFront();
            beginDrag(e);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            left: `${rect().x}px`,
            top: `${rect().y}px`,
            width: `${rect().width}px`,
            height: `${rect().height}px`,
          }}
        >
          {props.children}

          <div class="resize n" onPointerDown={(e) => beginResize(e, "n")} />
          <div class="resize s" onPointerDown={(e) => beginResize(e, "s")} />
          <div class="resize e" onPointerDown={(e) => beginResize(e, "e")} />
          <div class="resize w" onPointerDown={(e) => beginResize(e, "w")} />
          <div class="resize ne" onPointerDown={(e) => beginResize(e, "ne")} />
          <div class="resize nw" onPointerDown={(e) => beginResize(e, "nw")} />
          <div class="resize se" onPointerDown={(e) => beginResize(e, "se")} />
          <div class="resize sw" onPointerDown={(e) => beginResize(e, "sw")} />
        </div>
      </div>
    </Show>
  );
}