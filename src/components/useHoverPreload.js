export function createHoverPreloadHandlers(onPreload, delayMs = 300) {
  let timer = null;

  const onEnter = () => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      onPreload();
    }, delayMs);
  };

  const onLeave = () => {
    clearTimer();
  };

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    onMouseEnter: onEnter,
    onMouseLeave: onLeave,
    cleanup: clearTimer,
  };
}