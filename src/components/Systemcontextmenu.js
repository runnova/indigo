import { createStore } from 'solid-js/store';

const [menuState, setMenuState] = createStore({
  open: false,
  x: 0,
  y: 0,
  actions: [],
  contextElement: null,
});

class SystemContextMenu {
  static instance = new SystemContextMenu();

  constructor() {
    this.menus = [];
    this.menuRef = null;

    this.boundContextHandler = this.#handleContextMenu.bind(this);
    this.boundClickHandler = this.#handleOutsideClick.bind(this);
    this.boundKeyHandler = this.#handleKeydown.bind(this);

    document.addEventListener('contextmenu', this.boundContextHandler);
    document.addEventListener('click', this.boundClickHandler);
    document.addEventListener('keydown', this.boundKeyHandler);
  }

  static init(configs = []) {
    this.instance.register(configs);
  }

  register(configs = []) {
    this.menus.push(...configs);
  }

  close() {
    if (!menuState.open) return;
    setMenuState({
      open: false,
      actions: [],
      contextElement: null,
    });
  }

  setMenuRef(el) {
    this.menuRef = el;
  }

  clampToViewport(rect) {
    if (!menuState.open) return;

    const { innerWidth, innerHeight } = window;
    let { x, y } = menuState;

    if (x + rect.width > innerWidth) {
      x = innerWidth - rect.width - 8;
    }
    if (y + rect.height > innerHeight) {
      y = innerHeight - rect.height - 8;
    }

    if (x !== menuState.x || y !== menuState.y) {
      setMenuState({ x, y });
    }
  }

  #handleContextMenu(e) {
    const match = this.#findMatchingContext(e.target);
    if (!match) {
      this.close();
      return;
    }

    e.preventDefault();

    setMenuState({
      open: true,
      x: e.clientX,
      y: e.clientY,
      actions: match.actions,
      contextElement: match.element,
    });
  }

  #handleOutsideClick(e) {
    if (!menuState.open) return;
    if (this.menuRef && !this.menuRef.contains(e.target)) {
      this.close();
    }
  }

  #handleKeydown(e) {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  #findMatchingContext(target) {
    for (const menu of this.menus) {
      const selector = `[data-context="${menu['data-context']}"]`;
      const element = target.closest(selector);
      if (element) {
        return {
          ...menu,
          element,
        };
      }
    }
    return null;
  }
}

export default SystemContextMenu;
export { menuState };