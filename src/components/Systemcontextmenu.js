import { createStore } from 'solid-js/store';

const MENU_PADDING = 8;

const menuStack = [];

const [menuState, setMenuState] = createStore({
  open: false,
  anchorX: 0,
  anchorY: 0,
  x: 0,
  y: 0,
  actions: [],
  contextElement: null,
});

function getActiveMenu() {
  return menuStack[menuStack.length - 1] || null;
}

function pushMenu(menu) {
  menuStack.push(menu);
  applyMenuState(menu);
}

function popMenu() {
  menuStack.pop();
  if (menuStack.length > 0) {
    applyMenuState(menuStack[menuStack.length - 1]);
  } else {
    setMenuState({
      open: false,
      actions: [],
    });
  }
}

function applyMenuState(menu) {
  setMenuState({
    open: true,
    anchorX: menu.anchorX,
    anchorY: menu.anchorY,
    x: menu.x,
    y: menu.y,
    actions: menu.actions,
    contextElement: menu.contextElement,
  });
}

/**
 * Converts a string to title case
 * @param {string} str - Input string (e.g., "server_group")
 * @returns {string} Title case string (e.g., "Server Group")
 */
export function toTitleCase(str) {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

class SystemContextMenu {
  static instance = new SystemContextMenu();

  #handleContextMenu(e) {
    const match = this.#findMatchingContext(e.target);

    if (!match) {
      this.close();
      return;
    }

    e.preventDefault();

    pushMenu({
      actions: match.actions,
      anchorX: e.clientX,
      anchorY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      contextElement: match.element,
      menuRef: null,
      resizeObserver: null,
    });
  }

  constructor() {
    this.menus = [];
    this.menuRef = null;
    this.contextElement = null;
    this.resizeObserver = null;

    this.boundContextHandler = this.#handleContextMenu.bind(this);
    this.boundClickHandler = this.#handleOutsideClick.bind(this);
    this.boundKeyHandler = this.#handleKeydown.bind(this);
    this.boundWindowHandler = this.#handleWindowChange.bind(this);

    document.addEventListener('contextmenu', this.boundContextHandler);
    document.addEventListener('click', this.boundClickHandler);
    document.addEventListener('keydown', this.boundKeyHandler);
    window.addEventListener('resize', this.boundWindowHandler);
    window.addEventListener('scroll', this.boundWindowHandler, true);
  }

  static init(configs = []) {
    this.instance.register(configs);
  }

  register(configs = []) {
    this.menus.push(...configs);
  }

  /**
   * Opens a menu at a specific position
   * @param {Array} actions - Menu actions to display
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Element} contextElement - The element that triggered the menu
   */
  openAt(actions, x, y, contextElement = null) {
    pushMenu({
      actions,
      anchorX: x,
      anchorY: y,
      x,
      y,
      contextElement,
      menuRef: null,
      resizeObserver: null,
    });
  }

  close() {
    if (menuStack.length === 0) return;

    const activeMenu = getActiveMenu();
    if (activeMenu?.resizeObserver) {
      activeMenu.resizeObserver.disconnect();
      activeMenu.resizeObserver = null;
    }

    popMenu();
  }

  setMenuRef(el) {
    const activeMenu = getActiveMenu();
    if (!activeMenu) return;

    activeMenu.menuRef = el;
    this.#observeResize(el, activeMenu);

    if (el) {
      this.clampToViewport(el.getBoundingClientRect(), activeMenu);
    }
  }

  #observeResize(el, menu) {
    if (menu.resizeObserver) {
      menu.resizeObserver.disconnect();
      menu.resizeObserver = null;
    }

    if (!el || typeof ResizeObserver === 'undefined') return;

    menu.resizeObserver = new ResizeObserver(() => {
      if (!menu.menuRef) return;
      this.clampToViewport(menu.menuRef.getBoundingClientRect(), menu);
    });

    menu.resizeObserver.observe(el);
  }

  #handleWindowChange() {
    if (!menuState.open) return;
    const activeMenu = getActiveMenu();
    if (!activeMenu?.menuRef) return;
    this.clampToViewport(activeMenu.menuRef.getBoundingClientRect(), activeMenu);
  }

  clampToViewport(rect, menu = null) {
    if (!menuState.open || !rect) return;

    const activeMenu = menu || getActiveMenu();
    if (!activeMenu) return;

    const { innerWidth, innerHeight } = window;
    const { width, height } = rect;

    let x = activeMenu.anchorX;
    let y = activeMenu.anchorY;

    if (x + width + MENU_PADDING > innerWidth) {
      x = innerWidth - width - MENU_PADDING;
    }
    if (y + height + MENU_PADDING > innerHeight) {
      y = innerHeight - height - MENU_PADDING;
    }

    x = Math.max(MENU_PADDING, x);
    y = Math.max(MENU_PADDING, y);

    if (x !== activeMenu.x || y !== activeMenu.y) {
      activeMenu.x = x;
      activeMenu.y = y;
      applyMenuState(activeMenu);
    }
  }

  #handleOutsideClick(e) {
    if (!menuState.open) return;
    const activeMenu = getActiveMenu();
    if (activeMenu?.menuRef && !activeMenu.menuRef.contains(e.target)) {
      this.close();
    }
  }

  #handleKeydown(e) {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  #findMatchingContext(target) {
    const matches = [];
    let current = target;

    while (current && current !== document) {
      for (const menu of this.menus) {
        const selector = `[data-context="${menu['data-context']}"]`;
        if (current.matches(selector)) {
          matches.push({
            ...menu,
            element: current,
          });
          break;
        }
      }
      current = current.parentElement;
    }

    if (matches.length === 0) return null;

    if (matches.length === 1) {
      return matches[0];
    }

    const innermost = matches[0];
    const restContexts = matches.slice(1);

    const nestedActions = restContexts.map((menu) => {
      const contextName = menu['data-context'];
      const label = toTitleCase(contextName);
      return {
        label,
        actions: menu.actions,
      };
    });

    return {
      ...innermost,
      actions: [
        ...innermost.actions,
        nestedActions.length > 0 ? { special: 'hr' } : null,
        ...nestedActions,
      ].filter(Boolean),
    };
  }
}

export default SystemContextMenu;
export { menuState };
