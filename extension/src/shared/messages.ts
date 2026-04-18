import type { ReplyRequest, ReplyResponse } from "./api";

export type DraftReplyMessage = {
  type: "DRAFT_REPLY";
  payload: ReplyRequest;
};

export type TestConnectionMessage = {
  type: "TEST_CONNECTION";
};

export type RpcMessage = DraftReplyMessage | TestConnectionMessage;

export type DraftReplyResult =
  | { ok: true; data: ReplyResponse }
  | { ok: false; error: { code: string; message: string } };

export type TestConnectionResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string } };

export async function sendDraftReply(payload: ReplyRequest): Promise<DraftReplyResult> {
  return chrome.runtime.sendMessage({ type: "DRAFT_REPLY", payload } satisfies DraftReplyMessage);
}

export async function sendTestConnection(): Promise<TestConnectionResult> {
  return chrome.runtime.sendMessage({ type: "TEST_CONNECTION" } satisfies TestConnectionMessage);
}
