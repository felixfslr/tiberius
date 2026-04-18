/**
 * Insert text into a Gmail compose contenteditable. Gmail's editor treats
 * each top-level <div> as a paragraph; \n\n → paragraph break, \n → <br>.
 * Uses document.execCommand("insertHTML") because Gmail itself does — it
 * integrates with the editor's undo stack. Falls back to Range.insertNode.
 */

export function insertIntoCompose(composeBody: HTMLElement, text: string): void {
  composeBody.focus();
  placeCaretAtStart(composeBody);
  const hasContent = composeBody.textContent?.trim().length ?? 0;
  const prefix = hasContent > 0 ? "<div><br></div>" : "";
  const html = prefix + textToHtml(text);
  const ok = tryExecInsert(html);
  if (!ok) rangeInsert(composeBody, html);
  composeBody.dispatchEvent(new Event("input", { bubbles: true }));
}

function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => `<div>${escapeHtml(para).replace(/\n/g, "<br>")}</div>`)
    .join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function placeCaretAtStart(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function tryExecInsert(html: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.execCommand("insertHTML", false, html);
  } catch {
    return false;
  }
}

function rangeInsert(composeBody: HTMLElement, html: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    composeBody.insertAdjacentHTML("afterbegin", html);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const template = document.createElement("template");
  template.innerHTML = html;
  const frag = template.content;
  range.insertNode(frag);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}
