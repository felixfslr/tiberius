export type ReplyMessage = { role: "user" | "assistant"; content: string };

export type ReplyRequest = {
  trigger_message: string;
  history: ReplyMessage[];
};

export type ConfidenceBreakdown = {
  retrieval: number;
  intent: number;
  groundedness: number;
  consistency: number;
};

export type SuggestedTool =
  | "send_calendly_link"
  | "attach_document"
  | "flag_for_review"
  | "none";

export type ReplyResponse = {
  reply_text: string;
  confidence: number;
  confidence_breakdown: ConfidenceBreakdown;
  detected_stage: string;
  detected_intent: string;
  detected_intents: string[];
  suggested_tool: SuggestedTool;
  tool_args: Record<string, unknown>;
  reasoning: string;
  retrieved_chunk_ids: string[];
  reply_log_id: string;
  below_threshold: boolean;
};

type Envelope<T> = { data: T; error: null } | { data: null; error: { code: string; message: string } };

export class TiberiusError extends Error {
  constructor(public code: string, message: string, public status?: number) {
    super(message);
    this.name = "TiberiusError";
  }
}

export type TiberiusClientOptions = {
  apiBaseUrl: string;
  apiKey: string;
  agentId: string;
  timeoutMs?: number;
};

export class TiberiusClient {
  constructor(private opts: TiberiusClientOptions) {}

  async draftReply(req: ReplyRequest, signal?: AbortSignal): Promise<ReplyResponse> {
    const url = `${this.opts.apiBaseUrl.replace(/\/$/, "")}/api/v1/agents/${this.opts.agentId}/reply`;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 65000);
    if (signal) signal.addEventListener("abort", () => ctrl.abort());
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });
      let json: Envelope<ReplyResponse>;
      try {
        json = (await res.json()) as Envelope<ReplyResponse>;
      } catch {
        throw new TiberiusError("network_error", `HTTP ${res.status}: could not parse response`, res.status);
      }
      if (!res.ok || json.error) {
        const code = json.error?.code ?? "http_error";
        const message = json.error?.message ?? `HTTP ${res.status}`;
        throw new TiberiusError(code, message, res.status);
      }
      if (!json.data) throw new TiberiusError("empty_response", "Empty response body");
      return json.data;
    } catch (e) {
      if (e instanceof TiberiusError) throw e;
      if ((e as Error).name === "AbortError") {
        throw new TiberiusError("timeout", "Request timed out");
      }
      throw new TiberiusError("network_error", (e as Error).message);
    } finally {
      clearTimeout(timeout);
    }
  }
}
