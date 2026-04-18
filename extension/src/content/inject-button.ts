const INJECTED_ATTR = "data-tiberius-injected";

export function buildButton(onClick: (composeBody: HTMLElement) => void, composeBody: HTMLElement): HTMLElement {
  const btn = document.createElement("div");
  btn.setAttribute("role", "button");
  btn.setAttribute("tabindex", "0");
  btn.setAttribute("aria-label", "Draft with Tiberius");
  btn.title = "Draft with Tiberius";
  btn.style.cssText = [
    "display: inline-flex",
    "align-items: center",
    "gap: 6px",
    "margin-right: 8px",
    "padding: 0 12px",
    "height: 36px",
    "border-radius: 18px",
    "background: #111",
    "color: #fff",
    "font: 500 13px/1 system-ui, -apple-system, 'Segoe UI', sans-serif",
    "cursor: pointer",
    "user-select: none",
    "pointer-events: auto",
    "position: relative",
    "z-index: 10",
  ].join(";");
  btn.innerHTML = `<span style="font-size:14px;pointer-events:none">✨</span><span style="pointer-events:none">Draft with Tiberius</span>`;
  btn.addEventListener("mouseenter", () => (btn.style.background = "#000"));
  btn.addEventListener("mouseleave", () => (btn.style.background = "#111"));
  const trigger = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    console.debug("[tiberius] button clicked");
    onClick(composeBody);
  };
  btn.addEventListener("click", trigger, { capture: true });
  btn.addEventListener("mousedown", (e) => {
    // Fire on mousedown too — Gmail sometimes swallows bubbled clicks.
    if ((e as MouseEvent).button === 0) trigger(e);
  }, { capture: true });
  return btn;
}

export function setButtonLoading(btn: HTMLElement, loading: boolean): void {
  if (loading) {
    btn.setAttribute("aria-busy", "true");
    btn.style.opacity = "0.6";
    btn.style.pointerEvents = "none";
    const label = btn.querySelector("span:last-child");
    if (label) label.textContent = "Drafting…";
  } else {
    btn.removeAttribute("aria-busy");
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
    const label = btn.querySelector("span:last-child");
    if (label) label.textContent = "Draft with Tiberius";
  }
}

export function alreadyInjected(toolbar: HTMLElement): boolean {
  return toolbar.hasAttribute(INJECTED_ATTR);
}

export function markInjected(toolbar: HTMLElement): void {
  toolbar.setAttribute(INJECTED_ATTR, "1");
}
