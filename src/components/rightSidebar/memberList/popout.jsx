import { createSignal } from "solid-js";

export const [popout, setPopout] = createSignal(null);

export function openPopout(user, element, status) {
  console.log(user, element)
  const rect = element.getBoundingClientRect();

  setPopout({
    user,
    x: rect.right + 8,
    y: rect.top,
    status
  });
}

export function closePopout() {
  setPopout(null);
}