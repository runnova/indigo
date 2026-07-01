import { Show, For, createSignal } from 'solid-js';
import { HiSolidChevronRight } from 'solid-icons/hi';
import SystemContextMenu, { menuState } from './Systemcontextmenu';

function MenuList(props) {
  return (
    <div class={props.class} style={props.style} ref={props.ref}>
      <For each={props.actions}>
        {(action) => (
          <Show
            when={Array.isArray(action.actions)}
            fallback={
              <button
                class="scm-item"
                onClick={() => {
                  const el = SystemContextMenu.instance.contextElement;

                  if (typeof action.fn === 'function') {
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
        )}
      </For>
    </div>
  );
}

function SubmenuItem(props) {
  const [open, setOpen] = createSignal(false);
  const [side, setSide] = createSignal('right');

  const measure = (el) => {
    queueMicrotask(() => {
      const parent = el.parentElement.getBoundingClientRect();
      const width = el.offsetWidth;

      if (parent.right + width > window.innerWidth) {
        setSide('left');
      } else {
        setSide('right');
      }
    });
  };

  return (
    <div
      class="scm-submenu-wrapper"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button class="scm-item scm-submenu-button">
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
          class={`scm-menu scm-submenu${side() === 'left' ? ' scm-submenu--left' : ''}`}
          actions={props.action.actions}
          contextElement={props.contextElement}
          ref={measure}
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
          position: 'fixed',
          left: `${menuState.x}px`,
          top: `${menuState.y}px`,
        }}
        actions={menuState.actions}
        contextElement={SystemContextMenu.instance.contextElement}
        ref={(el) => {
          SystemContextMenu.instance.setMenuRef(el);
          SystemContextMenu.instance.clampToViewport(el.getBoundingClientRect());
        }}
      />
    </Show>
  );
}