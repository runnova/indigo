import { Show, For, createSignal, onCleanup } from "solid-js";
import { HiSolidChevronRight } from "solid-icons/hi";
import SystemContextMenu, { menuState } from "./Systemcontextmenu";

function MenuList(props) {
  return (
    <div class={props.class} style={props.style} ref={props.ref}>
      <For each={props.actions}>
        {(action) => (
          <Show
            when={action.special !== "hr"}
            fallback={<div class="scm-divider" role="separator" />}
          >
            <Show
              when={Array.isArray(action.actions)}
              fallback={
                <button
                  class="scm-item"
                  style={action.color ? { color: action.color } : undefined}
                  onClick={() => {
                    const el = SystemContextMenu.instance.contextElement;

                    if (typeof action.fn === "function") {
                      action.fn(el);
                    }

                    SystemContextMenu.instance.close();
                  }}
                >
                  <span class="scm-item-content">
                    <Show when={action.icon}>
                      <span class="scm-item-icon">
                        <action.icon />
                      </span>
                    </Show>

                    <span class="scm-item-label">{action.label}</span>
                  </span>
                </button>
              }
            >
              <SubmenuItem
                action={action}
                contextElement={props.contextElement}
              />
            </Show>
          </Show>
        )}
      </For>
    </div>
  );
}

const SUBMENU_PADDING = 8;

function SubmenuItem(props) {
  const [open, setOpen] = createSignal(false);
  const [side, setSide] = createSignal("right");
  const [align, setAlign] = createSignal("top");

  let wrapperEl;
  let submenuEl;
  let resizeObserver;

  const measure = () => {
    if (!submenuEl || !wrapperEl) return;

    const wrapperRect = wrapperEl.getBoundingClientRect();
    const submenuRect = submenuEl.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;

    if (
      side() === "right" &&
      wrapperRect.right + submenuRect.width > innerWidth - SUBMENU_PADDING
    ) {
      setSide("left");
    } else if (
      side() === "left" &&
      wrapperRect.left - submenuRect.width < SUBMENU_PADDING
    ) {
      setSide("right");
    }

    if (
      align() === "top" &&
      wrapperRect.top + submenuRect.height > innerHeight - SUBMENU_PADDING
    ) {
      setAlign("bottom");
    } else if (
      align() === "bottom" &&
      wrapperRect.bottom - submenuRect.height < SUBMENU_PADDING
    ) {
      setAlign("top");
    }
  };

  const setSubmenuRef = (el) => {
    submenuEl = el;

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (!el) return;

    queueMicrotask(measure);

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => measure());
      resizeObserver.observe(el);
    }
  };

  onCleanup(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  });

  const openSubmenu = () => {
    setSide("right");
    setAlign("top");
    setOpen(true);
  };

  const closeSubmenu = () => setOpen(false);

  return (
    <div
      class="scm-submenu-wrapper"
      ref={(el) => (wrapperEl = el)}
      onMouseEnter={openSubmenu}
      onMouseLeave={closeSubmenu}
    >
      <button
        class="scm-item scm-submenu-button"
        style={props.action.color ? { color: props.action.color } : undefined}
      >
        <span class="scm-item-content">
          <Show when={props.action.icon}>
            <span class="scm-item-icon">
              <props.action.icon />
            </span>
          </Show>

          <span class="scm-item-label">{props.action.label}</span>
        </span>

        <HiSolidChevronRight class="scm-submenu-chevron" />
      </button>

      <Show when={open()}>
        <MenuList
          class={[
            "scm-menu",
            "scm-submenu",
            side() === "left" ? "scm-submenu--left" : "",
            align() === "bottom" ? "scm-submenu--up" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          actions={props.action.actions}
          contextElement={props.contextElement}
          ref={setSubmenuRef}
        />
      </Show>
    </div>
  );
}

export default function ContextMenu() {
  return (
    <Show when={menuState.open}>
      <MenuList
        class="scm-menu"
        style={{
          position: "fixed",
          left: `${menuState.x}px`,
          top: `${menuState.y}px`,
        }}
        actions={menuState.actions}
        contextElement={SystemContextMenu.instance.contextElement}
        ref={(el) => SystemContextMenu.instance.setMenuRef(el)}
      />
    </Show>
  );
}
