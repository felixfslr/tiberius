import modalCss from "./modal.css?inline";
import type { ReplyResponse } from "@/shared/api";

type OpenOpts = {
  initial: ReplyResponse;
  onInsert: (text: string) => void;
  onRegenerate: () => Promise<ReplyResponse>;
};

let active: { host: HTMLDivElement; close: () => void } | null = null;

export function openPreviewModal(opts: OpenOpts): void {
  closePreviewModal();

  const host = document.createElement("div");
  host.id = "tiberius-modal-host";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = modalCss;
  shadow.appendChild(style);

  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  backdrop.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true" aria-label="Tiberius draft">
      <div class="head">
        <div class="title">Tiberius draft</div>
        <div class="pill" data-el="pill"></div>
      </div>
      <div class="meta" data-el="meta"></div>
      <details class="reasoning"><summary>Reasoning</summary><div data-el="reasoning"></div></details>
      <div class="body">
        <textarea data-el="textarea" spellcheck="true"></textarea>
      </div>
      <div class="error" data-el="error" hidden></div>
      <div class="foot">
        <span class="spacer" data-el="spacer"></span>
        <button data-el="regen">Regenerate</button>
        <button data-el="cancel">Cancel</button>
        <button data-el="insert" class="primary">Insert</button>
      </div>
    </div>
  `;
  shadow.appendChild(backdrop);
  document.body.appendChild(host);

  const el = <T extends Element = HTMLElement>(k: string) =>
    shadow.querySelector(`[data-el="${k}"]`) as T;
  const pill = el<HTMLSpanElement>("pill");
  const meta = el<HTMLDivElement>("meta");
  const reasoning = el<HTMLDivElement>("reasoning");
  const textarea = el<HTMLTextAreaElement>("textarea");
  const regen = el<HTMLButtonElement>("regen");
  const cancel = el<HTMLButtonElement>("cancel");
  const insert = el<HTMLButtonElement>("insert");
  const error = el<HTMLDivElement>("error");

  function render(data: ReplyResponse) {
    const pct = Math.round(data.confidence * 100);
    pill.textContent = `${pct}% confidence${data.below_threshold ? " · below threshold" : ""}`;
    pill.className = "pill " + (data.below_threshold ? "low" : pct >= 80 ? "ok" : "mid");
    meta.textContent = [data.detected_stage, data.detected_intent].filter(Boolean).join(" · ") || "—";
    reasoning.textContent = data.reasoning || "—";
    textarea.value = data.reply_text;
  }

  render(opts.initial);

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    host.remove();
    active = null;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  cancel.addEventListener("click", close);
  insert.addEventListener("click", () => {
    opts.onInsert(textarea.value);
    close();
  });
  regen.addEventListener("click", async () => {
    error.hidden = true;
    regen.disabled = true;
    insert.disabled = true;
    cancel.disabled = true;
    const prev = regen.textContent;
    regen.textContent = "Regenerating…";
    try {
      const next = await opts.onRegenerate();
      render(next);
    } catch (e) {
      error.hidden = false;
      error.textContent = e instanceof Error ? e.message : String(e);
    } finally {
      regen.disabled = false;
      insert.disabled = false;
      cancel.disabled = false;
      regen.textContent = prev;
    }
  });

  setTimeout(() => textarea.focus(), 0);
  active = { host, close };
}

export function closePreviewModal(): void {
  active?.close();
}
