import { Show, For, createSignal } from 'solid-js';
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
                  SystemContextMenu.instance.close();
                  if (typeof action.fn === 'function') {
                    action.fn(props.contextElement);
                  }
                }}
              >
                {action.label}
              </button>
            }
          >
            <SubmenuItem action={action} contextElement={props.contextElement} />
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
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSide(rect.right > window.innerWidth ? 'left' : 'right');
  };

  return (
    <div
      class="scm-submenu-wrapper"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button class="scm-item scm-submenu-button">{props.action.label}</button>
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
        contextElement={menuState.contextElement}
        ref={(el) => {
          SystemContextMenu.instance.setMenuRef(el);
          SystemContextMenu.instance.clampToViewport(el.getBoundingClientRect());
        }}
      />
    </Show>
  );
}