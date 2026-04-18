import {
  findComposeBodies,
  findComposeToolbar,
  getThreadMessages,
  getUserEmail,
  toReplyPayload,
} from "./gmail-dom";
import {
  alreadyInjected,
  buildButton,
  markInjected,
  setButtonLoading,
} from "./inject-button";
import { insertIntoCompose } from "./insert-reply";
import { openPreviewModal, closePreviewModal } from "./modal/modal";
import { sendDraftReply } from "@/shared/messages";
import { getSettings } from "@/shared/storage";
import type { ReplyResponse } from "@/shared/api";

const DEBOUNCE_MS = 200;
let scanScheduled = false;

function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  const run = () => {
    scanScheduled = false;
    try {
      scanAndInject();
    } catch (e) {
      console.warn("[tiberius] scan error", e);
    }
  };
  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout?: number }) => void })
      .requestIdleCallback(run, { timeout: DEBOUNCE_MS });
  } else {
    setTimeout(run, DEBOUNCE_MS);
  }
}

function scanAndInject() {
  const composes = findComposeBodies();
  for (const body of composes) {
    const toolbar = findComposeToolbar(body);
    if (!toolbar || alreadyInjected(toolbar)) continue;
    const btn = buildButton(handleClick, body);
    toolbar.insertBefore(btn, toolbar.firstChild);
    markInjected(toolbar);
  }
}

async function handleClick(composeBody: HTMLElement) {
  const btn = document.activeElement as HTMLElement | null;
  const buttonEl =
    (btn && btn.getAttribute("aria-label") === "Draft with Tiberius" ? btn : null) ??
    findButtonForCompose(composeBody);

  const setLoading = (on: boolean) => {
    if (buttonEl) setButtonLoading(buttonEl, on);
  };

  setLoading(true);

  const userEmail = getUserEmail();
  const messages = getThreadMessages();
  const payload = toReplyPayload(messages, userEmail);
  if (!payload) {
    setLoading(false);
    toast("No messages found in this thread.");
    return;
  }

  const runOnce = async (): Promise<ReplyResponse> => {
    const result = await sendDraftReply(payload);
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    return result.data;
  };

  let initial: ReplyResponse;
  try {
    initial = await runOnce();
  } catch (e) {
    setLoading(false);
    toast(e instanceof Error ? e.message : String(e));
    return;
  } finally {
    setLoading(false);
  }

  const settings = await getSettings();
  const mustPreview = settings.behavior === "always_preview" || initial.below_threshold;

  if (!mustPreview) {
    insertIntoCompose(composeBody, initial.reply_text);
    return;
  }

  openPreviewModal({
    initial,
    onInsert: (text) => insertIntoCompose(composeBody, text),
    onRegenerate: runOnce,
  });
}

function findButtonForCompose(composeBody: HTMLElement): HTMLElement | null {
  const toolbar = findComposeToolbar(composeBody);
  return toolbar?.querySelector<HTMLElement>('[aria-label="Draft with Tiberius"]') ?? null;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
function toast(msg: string) {
  let host = document.getElementById("tiberius-toast") as HTMLDivElement | null;
  if (!host) {
    host = document.createElement("div");
    host.id = "tiberius-toast";
    host.style.cssText = [
      "position: fixed",
      "bottom: 24px",
      "right: 24px",
      "max-width: 360px",
      "padding: 10px 14px",
      "border-radius: 8px",
      "background: #111",
      "color: #fff",
      "font: 500 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif",
      "box-shadow: 0 6px 24px rgba(0,0,0,0.25)",
      "z-index: 2147483646",
      "opacity: 0",
      "transition: opacity 140ms ease",
    ].join(";");
    document.body.appendChild(host);
  }
  host.textContent = msg;
  requestAnimationFrame(() => host!.style.opacity = "1");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (host) host.style.opacity = "0";
  }, 4000);
}

const observer = new MutationObserver(scheduleScan);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("hashchange", scheduleScan);
window.addEventListener("beforeunload", () => closePreviewModal());
scheduleScan();
