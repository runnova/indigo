import { createSignal, createMemo, onCleanup } from "solid-js";
import {
  HiOutlineMagnifyingGlassPlus,
  HiOutlineMagnifyingGlassMinus,
  HiOutlineArrowsPointingOut,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineArrowDownTray,
  HiOutlineLink,
  HiOutlineXMark,
} from "solid-icons/hi";

export default function MediaPreview(props) {
  let viewport;

  const [scale, setScale] = createSignal(1);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });

  const isVideo = createMemo(() =>
    props.type?.startsWith("video/")
  );

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function reset() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function zoom(delta) {
    setScale((s) => Math.max(0.2, Math.min(8, s + delta)));
  }

  function zoomTo(value) {
    setScale(Math.max(0.2, Math.min(8, value)));
  }

  function wheel(e) {
    e.preventDefault();

    const media = viewport.querySelector("img, video");
    const rect = media.getBoundingClientRect();

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const old = scale();
    const next = Math.max(0.2, Math.min(8, old * (e.deltaY < 0 ? 1.1 : 0.9)));

    const ratio = next / old;

    setOffset((o) => ({
      x: o.x - mx * (ratio - 1),
      y: o.y - my * (ratio - 1),
    }));

    setScale(next);
  }

  function down(e) {

    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function move(e) {
    if (!dragging) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    lastX = e.clientX;
    lastY = e.clientY;

    setOffset((o) => ({
      x: o.x + dx,
      y: o.y + dy,
    }));
  }

  function up() {
    dragging = false;
  }

  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);

  onCleanup(() => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
  });

  async function copyLink() {
    await navigator.clipboard.writeText(props.src);
  } ``

  return (
    <div
      class="media_preview"
      onClick={() => {
        reset();
        props.onClose?.();
      }}
    >
      <div class="media_actions" 
    onClick={(e) => e.stopPropagation()}>
        <button onClick={() => zoom(0.2)}>
          <HiOutlineMagnifyingGlassPlus />
        </button>

        <button onClick={() => zoom(-0.2)}>
          <HiOutlineMagnifyingGlassMinus />
        </button>

        <button onClick={reset}>
          <HiOutlineArrowsPointingOut />
        </button>

        <a href={props.src} target="_blank" rel="noopener noreferrer">
          <HiOutlineArrowTopRightOnSquare />
        </a>

        <a href={props.src} download>
          <HiOutlineArrowDownTray />
        </a>

        <button onClick={copyLink}>
          <HiOutlineLink />
        </button>

        <button
          onClick={() => {
            reset();
            props.onClose?.();
          }}
        >
          <HiOutlineXMark />
        </button>
      </div>

      <div
        ref={viewport}
        class="media_viewport"
        onClick={(e) => e.stopPropagation()}
        onWheel={wheel}
        onMouseDown={down}
        onDblClick={() => (scale() === 1 ? zoomTo(2) : reset())}
      >
        {isVideo() ? (
          <video
            src={props.src}
            controls
            draggable={false}
            style={{
              transform: `translate(${offset().x}px, ${offset().y}px) scale(${scale()})`,
            }}
          />
        ) : (
          <img
            src={props.src}
            draggable={false}
            style={{
              transform: `translate(${offset().x}px, ${offset().y}px) scale(${scale()})`,
            }}
          />
        )}
      </div>
    </div>
  );
}