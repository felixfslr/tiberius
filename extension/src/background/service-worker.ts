import { getSettings, isConfigured } from "@/shared/storage";
import { TiberiusClient, TiberiusError } from "@/shared/api";
import type {
  DraftReplyResult,
  RpcMessage,
  TestConnectionResult,
} from "@/shared/messages";

chrome.runtime.onMessage.addListener((msg: RpcMessage, _sender, sendResponse) => {
  handle(msg)
    .then((result) => sendResponse(result))
    .catch((e) => {
      const err = e instanceof Error ? e.message : String(e);
      sendResponse({ ok: false, error: { code: "unexpected", message: err } });
    });
  return true;
});

async function handle(msg: RpcMessage): Promise<DraftReplyResult | TestConnectionResult> {
  const settings = await getSettings();
  if (!isConfigured(settings)) {
    return {
      ok: false,
      error: { code: "not_configured", message: "Open extension options and add API key + agent ID." },
    };
  }
  const client = new TiberiusClient(settings);

  switch (msg.type) {
    case "DRAFT_REPLY": {
      try {
        const data = await client.draftReply(msg.payload);
        return { ok: true, data };
      } catch (e) {
        return toError(e);
      }
    }
    case "TEST_CONNECTION": {
      try {
        await client.draftReply({
          trigger_message: "Hi — test connection.",
          history: [],
        });
        return { ok: true };
      } catch (e) {
        return toError(e);
      }
    }
  }
}

function toError(e: unknown) {
  if (e instanceof TiberiusError) {
    return { ok: false as const, error: { code: e.code, message: e.message } };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { ok: false as const, error: { code: "unexpected", message } };
}

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
