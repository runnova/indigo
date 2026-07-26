import { createSignal, onCleanup, onMount } from 'solid-js';
import { render } from 'solid-js/web';

function getCssSelector(el) {
  if (!(el instanceof Element)) return '';
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts = [];
  let node = el;

  while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body.parentElement) {
    let selector = node.nodeName.toLowerCase();

    if (node.id) {
      selector = `#${CSS.escape(node.id)}`;
      parts.unshift(selector);
      break;
    } else {
      const classes = Array.from(node.classList).filter(Boolean);
      if (classes.length) {
        selector += '.' + classes.map(c => CSS.escape(c)).join('.');
      }

      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          sib => sib.nodeName === node.nodeName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(node) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
    }

    parts.unshift(selector);
    node = node.parentElement;
  }

  return parts.join(' > ');
}

function labelForElement(el) {
  if (!el) return '';
  if (el.id) return `#${el.id}`;
  const classes = Array.from(el.classList).filter(Boolean);
  if (classes.length) return `.${classes.join('.')}`;
  return el.nodeName.toLowerCase();
}

function DomSelectorOverlay(props) {
  const [hoveredEl, setHoveredEl] = createSignal(null);
  const [rect, setRect] = createSignal(null);

  const [confirmedEl, setConfirmedEl] = createSignal(null);
  const [confirmedRect, setConfirmedRect] = createSignal(null);

  let overlayRootEl;

  function updateRectFor(el) {
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top + window.scrollY,
      left: r.left + window.scrollX,
      width: r.width,
      height: r.height,
    });
  }

  function updateConfirmedRect() {
    const el = confirmedEl();
    if (!el) {
      setConfirmedRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setConfirmedRect({
      top: r.top + window.scrollY,
      left: r.left + window.scrollX,
      width: r.width,
      height: r.height,
    });
  }

  function handleMouseMove(e) {
    if (confirmedEl()) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || (overlayRootEl && overlayRootEl.contains(el))) return;
    if (el === hoveredEl()) {
      updateRectFor(el);
      return;
    }
    setHoveredEl(el);
    updateRectFor(el);
  }

  function handleClick(e) {
    if (confirmedEl()) return;

    e.preventDefault();
    e.stopPropagation();
    const el = hoveredEl();
    if (el) {
      setConfirmedEl(el);
      updateConfirmedRect();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (confirmedEl()) {
        setConfirmedEl(null);
        setConfirmedRect(null);
        return;
      }
      props.onCancel?.();
    }
  }

  function handleScrollOrResize() {
    if (confirmedEl()) {
      updateConfirmedRect();
    } else {
      updateRectFor(hoveredEl());
    }
  }

  function handleConfirm() {
    const el = confirmedEl();
    if (el) {
      const selector = getCssSelector(el);
      props.onSelect?.(selector, el);
    }
  }

  function handleChooseAnother() {
    setConfirmedEl(null);
    setConfirmedRect(null);
    setHoveredEl(null);
    setRect(null);
  }

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize, true);

    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

    onCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize, true);
      document.body.style.cursor = prevCursor;
    });
  });

  const activeRect = () => confirmedEl() ? confirmedRect() : rect();
  const isConfirming = () => !!confirmedEl();

  return (
    <div
      ref={overlayRootEl}
      style={{
        position: 'fixed',
        inset: '0',
        'z-index': '2147483647',
        'pointer-events': 'none',
      }}
    >
      {activeRect() && (
        <div
          style={{
            position: 'absolute',
            top: `${activeRect().top}px`,
            left: `${activeRect().left}px`,
            width: `${activeRect().width}px`,
            height: `${activeRect().height}px`,
            background: isConfirming()
              ? 'var(--diff-two)'
              : 'var(--diff-one)',
            outline: isConfirming()
              ? `1px solid var(--hl-one)`
              : `1px solid var(--hl-two)`,
            'outline-offset': '-1px',
            'box-sizing': 'border-box',
            transition: 'all 0.05s ease-out',
            'pointer-events': isConfirming() ? 'auto' : 'none',
          }}
        >
          {!isConfirming() && (
            <div
              style={{
                position: 'absolute',
                bottom: activeRect().top < 24 ? '-22px' : 'auto',
                top: activeRect().top < 24 ? '100%' : '-22px',
                left: '0',
                background: 'var(--bg-two)',
                color: 'var(--fg-one)',
                'font-family': 'monospace',
                'font-size': '11px',
                padding: '2px 6px',
                'border-radius': '3px',
                'white-space': 'nowrap',
                'pointer-events': 'none',
                'box-shadow': 'var(--border)',
              }}
            >
              {labelForElement(hoveredEl())}
            </div>
          )}

          {isConfirming() && (
            <div
              style={{
                position: 'absolute',
                top: activeRect().top < 100 ? '100%' : 'auto',
                bottom: activeRect().top < 100 ? 'auto' : '100%',
                left: '0',
                'margin-top': activeRect().top < 100 ? '8px' : '0',
                'margin-bottom': activeRect().top < 100 ? '0' : '8px',
                background: 'var(--bg-three)',
                'box-shadow': 'var(--border), 0 4px 16px rgba(0,0,0,0.4)',
                'border-radius': '8px',
                padding: '10px 12px',
                'font-family': 'sans-serif',
                'min-width': '220px',
                'pointer-events': 'auto',
                'z-index': '2147483647',
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  color: 'var(--fg-three)',
                  'font-family': 'monospace',
                  'font-size': '11px',
                  'margin-bottom': '8px',
                  'word-break': 'break-all',
                }}
              >
                {labelForElement(confirmedEl())}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfirm();
                  }}
                  style={{
                    background: 'var(--hl-one)',
                    color: 'var(--fg-one)',
                    border: 'none',
                    'border-radius': '5px',
                    padding: '6px 12px',
                    'font-size': '12px',
                    'font-weight': '600',
                    cursor: 'pointer',
                    'font-family': 'sans-serif',
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleChooseAnother();
                  }}
                  style={{
                    background: 'transparent',
                    color: 'var(--fg-one)',
                    border: 'none',
                    'box-shadow': 'var(--border)',
                    'border-radius': '5px',
                    padding: '6px 12px',
                    'font-size': '12px',
                    cursor: 'pointer',
                    'font-family': 'sans-serif',
                  }}
                >
                  Choose another
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-two)',
          color: 'var(--fg-one)',
          'font-family': 'sans-serif',
          'font-size': '12px',
          padding: '6px 12px',
          'border-radius': '6px',
          'box-shadow': 'var(--border)',
        }}
      >
        {isConfirming()
          ? <>Click <b>Confirm</b> to use this element, or navigate the page and click elsewhere &nbsp;•&nbsp; Press <b>ESC</b> to reselect</>
          : <>Click an element to select it &nbsp;•&nbsp; Press <b>ESC</b> to cancel</>}
      </div>
    </div>
  );
}

export function mountDomSelector({ onSelect, onCancel } = {}) {
  const container = document.createElement('div');
  container.id = 'dom-selector-overlay-root';
  document.body.appendChild(container);

  let disposed = false;
  const dispose = render(() => (
    <DomSelectorOverlay
      onSelect={(selector, el) => {
        cleanup();
        onSelect?.(selector, el);
      }}
      onCancel={() => {
        cleanup();
        onCancel?.();
      }}
    />
  ), container);

  function cleanup() {
    if (disposed) return;
    disposed = true;
    dispose();
    container.remove();
  }

  return cleanup;
}