import { createSignal } from "solid-js";

export const [popout, setPopout] = createSignal(null);

export function openPopout(user, element) {
  const rect = element.getBoundingClientRect();

  setPopout({
    user,
    x: rect.right + 8,
    y: rect.top
  });
}

export function closePopout() {
  setPopout(null);
}