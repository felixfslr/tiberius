/**
 * All Gmail selectors live here. If Gmail renames a class, this is the
 * only file to fix. Selectors prefer role/aria/data attributes; class
 * names are used only as fallbacks.
 */

import type { ReplyMessage } from "@/shared/api";

export type ScrapedMessage = {
  from: string; // lowercased email, "" if not found
  body: string;
};

export type ThreadScrape = {
  trigger: ScrapedMessage | null;
  history: ScrapedMessage[];
};

/** Find all Gmail message bubbles in the currently open thread. */
export function getThreadMessages(root: ParentNode = document): ScrapedMessage[] {
  const items = root.querySelectorAll<HTMLElement>('div[role="main"] div[role="listitem"]');
  const out: ScrapedMessage[] = [];
  for (const item of items) {
    const from = scrapeSender(item);
    const body = scrapeBody(item);
    if (!body) continue;
    out.push({ from, body });
  }
  return out;
}

function scrapeSender(item: HTMLElement): string {
  const primary =
    item.querySelector<HTMLElement>(".gD[email]") ??
    item.querySelector<HTMLElement>("span[email]");
  const email = primary?.getAttribute("email") ?? "";
  return email.trim().toLowerCase();
}

function scrapeBody(item: HTMLElement): string {
  const bodyEl = item.querySelector<HTMLElement>("div.a3s");
  if (!bodyEl) return "";
  const clone = bodyEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".gmail_quote, blockquote").forEach((n) => n.remove());
  const text = (clone.innerText || clone.textContent || "").trim();
  return text;
}

/**
 * Thread → trigger + history. Last message = trigger. Earlier messages
 * mapped to user/assistant by comparing sender vs the logged-in email.
 */
export function toReplyPayload(
  messages: ScrapedMessage[],
  userEmail: string,
): { trigger_message: string; history: ReplyMessage[] } | null {
  if (messages.length === 0) return null;
  const last = messages[messages.length - 1];
  const prior = messages.slice(0, -1);
  const me = userEmail.trim().toLowerCase();
  const history: ReplyMessage[] = prior.map((m) => ({
    role: m.from && m.from === me ? "assistant" : "user",
    content: truncate(m.body, 4000),
  }));
  // Schema cap
  const trimmedHistory = history.slice(-99);
  return {
    trigger_message: truncate(last.body, 4000),
    history: trimmedHistory,
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 16) + "… [truncated]";
}

/** Find the Gmail account email for the current `/u/N/` window. */
export function getUserEmail(): string {
  // Try account switcher: role=button with aria-label containing "Google Account"
  const switcher = document.querySelector<HTMLElement>(
    'a[aria-label*="Google Account" i], a[href*="SignOutOptions"]',
  );
  const label = switcher?.getAttribute("aria-label") ?? "";
  const m = label.match(/([\w.+-]+@[\w.-]+\.[a-z]{2,})/i);
  if (m) return m[1].toLowerCase();

  // Fallback: scan header for any visible email string
  const header = document.querySelector<HTMLElement>('header[role="banner"]') ?? document.body;
  const m2 = (header.innerText || "").match(/([\w.+-]+@[\w.-]+\.[a-z]{2,})/i);
  return m2 ? m2[1].toLowerCase() : "";
}

/**
 * Multi-locale aria-label prefixes for Gmail's Send button.
 * Gmail localizes aria-label but keeps the prefix stable. If your locale
 * is missing, add it here.
 */
const SEND_LABEL_PREFIXES = [
  "Send", // EN
  "Senden", // DE
  "Envoyer", // FR
  "Enviar", // ES / PT
  "Invia", // IT
  "Verzenden", // NL
  "Wyślij", // PL
  "Skicka", // SV
  "Sende", // DA / NO
  "Lähetä", // FI
  "送信", // JA
  "发送", // ZH-CN
  "傳送", // ZH-TW
  "전송", // KO
  "Gönder", // TR
  "Отправить", // RU
  "שליחה", // HE
  "إرسال", // AR
];

const SEND_BUTTON_SELECTOR = SEND_LABEL_PREFIXES.map(
  (w) => `div[role="button"][aria-label^="${w}"]`,
).join(", ");

/** A compose/reply box element (the contenteditable message body). */
export function findComposeBodies(root: ParentNode = document): HTMLElement[] {
  // aria-multiline="true" is locale-agnostic and distinguishes body from subject.
  // g_editable is a legacy Gmail marker, used as fallback.
  const sel =
    'div[role="textbox"][contenteditable="true"][aria-multiline="true"], ' +
    'div[g_editable="true"][role="textbox"][contenteditable="true"]';
  const bodies = Array.from(root.querySelectorAll<HTMLElement>(sel));
  // If nothing matched (older Gmail), fall back to any editable textbox that
  // sits inside a <tr> containing a Send button.
  if (bodies.length === 0) {
    const fallback = Array.from(
      root.querySelectorAll<HTMLElement>('div[role="textbox"][contenteditable="true"]'),
    );
    return fallback.filter((el) => findComposeToolbar(el) !== null);
  }
  return bodies;
}

/**
 * Returns the <tr> toolbar row that holds the Send button for a compose.
 * We inject into this row (as a new <td>) rather than inside the Send cell,
 * to avoid fighting Gmail's flex sizing.
 */
export function findComposeToolbar(composeBody: HTMLElement): HTMLElement | null {
  let ancestor: HTMLElement | null = composeBody;
  for (let i = 0; i < 20 && ancestor; i++, ancestor = ancestor.parentElement) {
    const send = ancestor.querySelector<HTMLElement>(SEND_BUTTON_SELECTOR);
    if (send) {
      let r: HTMLElement | null = send;
      while (r && r.tagName !== "TR") r = r.parentElement;
      // Prefer the toolbar row; fall back to Send's parent div (legacy path).
      return r ?? send.parentElement;
    }
  }
  return null;
}

/** Find the Send button for a given toolbar (for positioning / enable-check). */
export function findSendButton(toolbar: HTMLElement): HTMLElement | null {
  return toolbar.querySelector<HTMLElement>(SEND_BUTTON_SELECTOR);
}
