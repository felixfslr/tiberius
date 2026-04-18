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

/** A compose/reply box element (the contenteditable message body). */
export function findComposeBodies(root: ParentNode = document): HTMLElement[] {
  const sel =
    'div[role="textbox"][contenteditable="true"][aria-label*="Message Body" i], ' +
    'div[g_editable="true"][role="textbox"][contenteditable="true"]';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/** Given a compose body element, find its nearest toolbar (Send button cluster). */
export function findComposeToolbar(composeBody: HTMLElement): HTMLElement | null {
  // Walk up to the compose container. The Send button is inside it.
  let ancestor: HTMLElement | null = composeBody;
  for (let i = 0; i < 12 && ancestor; i++, ancestor = ancestor.parentElement) {
    const send = ancestor.querySelector<HTMLElement>(
      'div[role="button"][aria-label*="Send" i][data-tooltip*="Send" i], ' +
        'div[role="button"][aria-label^="Send" i]',
    );
    if (send) {
      return send.parentElement;
    }
  }
  return null;
}

/** Find the Send button for a given toolbar (for positioning / enable-check). */
export function findSendButton(toolbar: HTMLElement): HTMLElement | null {
  return toolbar.querySelector<HTMLElement>(
    'div[role="button"][aria-label*="Send" i]',
  );
}
