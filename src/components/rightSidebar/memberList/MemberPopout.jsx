import { Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { popout, closePopout } from "./popout";
import MemberProfile from "./MemberPopoutContent";
import { state } from "../../../App";

export default function MemberPopout() {
  let popupRef;
  const [position, setPosition] = createSignal({ left: -9999, top: -9999 }); // hide off-canvas until measured
  const [ready, setReady] = createSignal(false);

  function recalcPosition() {
    const current = popout();
    if (!current || !popupRef) return;

    const width = popupRef.offsetWidth;
    const height = popupRef.offsetHeight;
    if (width === 0 || height === 0) return; // not laid out yet, bail and retry

    const padding = 12;
    const minRightGap = (state?.settings?.thirdBarWidth || 0) + 20;

    let left = current.x + padding;
    const maxLeft = Math.max(window.innerWidth - width - minRightGap, padding);
    left = Math.min(left, maxLeft);
    left = Math.max(left, padding);

    let top = current.y - 20;
    const maxTop = Math.max(window.innerHeight - height - padding, padding);
    top = Math.min(top, maxTop);
    top = Math.max(top, padding);

    setPosition({ left, top });
    setReady(true);
  }

  createEffect(() => {
    popout();
    setReady(false);
    // wait a frame so offsetWidth/offsetHeight are real
    requestAnimationFrame(() => requestAnimationFrame(recalcPosition));
  });

  let ro;
  onMount(() => {
    window.addEventListener("resize", recalcPosition);
    window.addEventListener("scroll", recalcPosition, true);
    if (popupRef) {
      ro = new ResizeObserver(recalcPosition);
      ro.observe(popupRef);
    }
  });
  onCleanup(() => {
    window.removeEventListener("resize", recalcPosition);
    window.removeEventListener("scroll", recalcPosition, true);
    ro?.disconnect();
  });

  const handlePointerDown = (e) => {
    if (!popout()) return;
    if (popupRef?.contains(e.target)) return;
    if (e.target.closest(".member_item")) return;
    closePopout();
  };
  onMount(() => document.addEventListener("mousedown", handlePointerDown));
  onCleanup(() => document.removeEventListener("mousedown", handlePointerDown));

  return (
      <Show when={popout()} keyed>
        {(data) => {
          const user =
            typeof data.user === "string"
              ? { username: data.user, roles: [], theme: {} }
              : data.user;
          return (
            <Portal>
              <div
                ref={popupRef}
                style={{
                  position: "fixed",
                  left: `${position().left}px`,
                  top: `${position().top}px`,
                  visibility: ready() ? "visible" : "hidden",
                  "--accent": user.theme?.accent,
                  "--background": user.theme?.background,
                  "--primary": user.theme?.primary,
                  "--secondary": user.theme?.secondary,
                  "--tertiary": user.theme?.tertiary,
                  "--text": user.theme?.text,
                  transition: ".3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  "z-index": "11",
                }}
              >
                <MemberProfile
                  username={user.username}
                  status={data.status?.()}
                  roles={user.roles}
                />
              </div>
            </Portal>
          );
        }}
      </Show>
  );
}
