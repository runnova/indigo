import { onMount, onCleanup } from "solid-js";
import "./style.css"

export default function Tooltip() {
  let tooltip;
  let title;
  let description;
  let icon;

  let target = null;
  let visible = false;

  const GAP = 10;
  const SCREEN_PADDING = 8;

  const parseTooltip = (value) => {
    const separator = value.indexOf(":");

    if (separator === -1) {
      return {
        title: value.trim(),
        description: ""
      };
    }

    return {
      title: value.slice(0, separator).trim(),
      description: value.slice(separator + 1).trim()
    };
  };

  const setIcon = (value) => {
    icon.replaceChildren();

    if (!value) {
      icon.hidden = true;
      return;
    }

    const trimmed = value.trim();

    if (trimmed.startsWith("<svg")) {
      const template = document.createElement("template");
      template.innerHTML = trimmed;

      const svg = template.content.querySelector("svg");

      if (!svg) {
        icon.hidden = true;
        return;
      }

      icon.appendChild(svg);
      icon.hidden = false;
      return;
    }

    const image = document.createElement("img");
    image.src = trimmed;
    image.alt = "";
    image.draggable = false;

    image.addEventListener("error", () => {
      icon.replaceChildren();
      icon.hidden = true;
    }, { once: true });

    icon.appendChild(image);
    icon.hidden = false;
  };

  const updateContent = () => {
    if (!target) return;

    const value = target.getAttribute("data-tooltip");

    if (!value) return;

    const parsed = parseTooltip(value);

    title.textContent = parsed.title;
    description.textContent = parsed.description;
    description.hidden = !parsed.description;

    setIcon(target.getAttribute("data-tooltip-icon"));
  };

  const positionTooltip = () => {
    if (!target || !visible) return;

    const targetRect = target.getBoundingClientRect();

    tooltip.style.left = "0px";
    tooltip.style.top = "0px";

    const tooltipRect = tooltip.getBoundingClientRect();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceTop = targetRect.top;
    const spaceBottom = viewportHeight - targetRect.bottom;
    const spaceLeft = targetRect.left;
    const spaceRight = viewportWidth - targetRect.right;

    let side;

    const preferredVertical = spaceBottom >= spaceTop ? "bottom" : "top";
    const preferredHorizontal = spaceRight >= spaceLeft ? "right" : "left";

    if (
      preferredVertical === "bottom" &&
      spaceBottom >= tooltipRect.height + GAP
    ) {
      side = "bottom";
    } else if (
      preferredVertical === "top" &&
      spaceTop >= tooltipRect.height + GAP
    ) {
      side = "top";
    } else if (
      preferredHorizontal === "right" &&
      spaceRight >= tooltipRect.width + GAP
    ) {
      side = "right";
    } else if (
      preferredHorizontal === "left" &&
      spaceLeft >= tooltipRect.width + GAP
    ) {
      side = "left";
    } else if (spaceBottom >= tooltipRect.height + GAP) {
      side = "bottom";
    } else if (spaceTop >= tooltipRect.height + GAP) {
      side = "top";
    } else if (spaceRight >= tooltipRect.width + GAP) {
      side = "right";
    } else {
      side = "left";
    }

    let left;
    let top;

    if (side === "bottom") {
      left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
      top = targetRect.bottom + GAP;
    }

    if (side === "top") {
      left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
      top = targetRect.top - tooltipRect.height - GAP;
    }

    if (side === "right") {
      left = targetRect.right + GAP;
      top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
    }

    if (side === "left") {
      left = targetRect.left - tooltipRect.width - GAP;
      top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
    }

    left = Math.max(
      SCREEN_PADDING,
      Math.min(
        left,
        viewportWidth - tooltipRect.width - SCREEN_PADDING
      )
    );

    top = Math.max(
      SCREEN_PADDING,
      Math.min(
        top,
        viewportHeight - tooltipRect.height - SCREEN_PADDING
      )
    );

    tooltip.dataset.side = side;
    tooltip.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  };

  const show = (element) => {
    if (!element.hasAttribute("data-tooltip")) return;

    target = element;
    updateContent();

    visible = true;
    tooltip.hidden = false;
    tooltip.dataset.visible = "true";

    requestAnimationFrame(positionTooltip);
  };

  const hide = () => {
    target = null;
    visible = false;

    tooltip.dataset.visible = "false";
    tooltip.hidden = true;
  };

  const handlePointerOver = (event) => {
    const element = event.target.closest?.("[data-tooltip]");

    if (!element) return;

    if (element.contains(event.relatedTarget)) return;

    show(element);
  };

  const handleFocusIn = (event) => {
    const element = event.target.closest?.("[data-tooltip]");

    if (!element) return;

    show(element);
  };

  const handleFocusOut = (event) => {
    const element = event.target.closest?.("[data-tooltip]");

    if (!element) return;

    if (element.contains(event.relatedTarget)) return;

    hide();
  };

  const handlePointerMove = (event) => {
    if (!visible || !target) return;

    if (!target.matches(":hover")) {
      hide();
      return;
    }

    positionTooltip();
  };

  const handleScroll = () => {
    if (visible) positionTooltip();
  };

  const handleResize = () => {
    if (visible) positionTooltip();
  };

  onMount(() => {
    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
  });

  onCleanup(() => {
    document.removeEventListener("pointerover", handlePointerOver);
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("focusin", handleFocusIn);
    document.removeEventListener("focusout", handleFocusOut);

    window.removeEventListener("scroll", handleScroll, true);
    window.removeEventListener("resize", handleResize);
  });

  return (
    <div
      ref={tooltip}
      class="tooltip"
      role="tooltip"
      hidden
      data-visible="false"
    >
      <div ref={icon} class="tooltip-icon" hidden />

      <div class="tooltip-content">
        <div ref={title} class="tooltip-title" />
        <div ref={description} class="tooltip-description" />
      </div>
    </div>
  );
}
