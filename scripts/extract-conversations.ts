import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { generateObject } from "ai";
import { z } from "zod";
import { miniModel } from "@/lib/openai";

const SRC = "data/raw/example_chats.md";
const OUT_DIR = "data/conversations";

const STAGE_ENUM = [
  "cold",
  "qualifying",
  "scheduling",
  "scheduled",
  "post_call",
  "stalled",
  "any",
] as const;

const OUTCOME_ENUM = [
  "call_booked",
  "fit_mismatch",
  "disqualified",
  "ongoing",
  "no_response",
  "other",
] as const;

const ConversationShape = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["lead", "sales"]),
        sender: z.string().nullable(),
        content: z.string(),
        ts: z.string().nullable(),
      }),
    )
    .min(1),
  outcome: z.enum(OUTCOME_ENUM),
  stages_covered: z.array(z.enum(STAGE_ENUM)),
  notes: z.string().nullable(),
});

type Conversation = z.infer<typeof ConversationShape> & { id: string };

function splitBlocks(md: string): { id: string; raw: string }[] {
  const lines = md.split("\n");
  const headers: { line: number; n: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(?:##\s*)?(\d{1,2})\s*$/);
    if (!m) continue;
    const n = Number(m[1]);
    if (n >= 1 && n <= 20) {
      const last = headers[headers.length - 1];
      if (!last || n === last.n + 1) headers.push({ line: i, n });
    }
  }
  if (headers.length !== 20) {
    console.warn(`Warning: found ${headers.length} boundary headers, expected 20.`);
  }
  const blocks: { id: string; raw: string }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].line + 1;
    const end = i + 1 < headers.length ? headers[i + 1].line : lines.length;
    const body = lines.slice(start, end).join("\n").trim();
    blocks.push({ id: `convo_${String(headers[i].n).padStart(2, "0")}`, raw: body });
  }
  return blocks;
}

const SYSTEM_PROMPT = `You parse messy sales-email threads into structured JSON.

Input is one conversation from a sales outreach scenario. It may contain:
- Email threads in reverse-chronological order (newest at top, quoted older replies below with "On <date>, <name> wrote:" markers)
- Chat-style turns with no delimiters, just concatenated paragraphs
- Markdown code blocks (triple backticks) containing nested reply chains
- Anonymization: the lead's name is often replaced with literal "X"
- Misformatted timestamps like "10  36 AM" (double space where colon should be), "20. 3. 2026. 14 04" (dots and spaces for :)

Your job:
1. Identify each distinct message/turn written by a distinct human.
2. Assign role='sales' to messages written by Ivy team members (common names: Ruben / Ruben Reuter, Ferdi / Ferdinand / Ferdinand Dabitz, Jacob). Sender signatures like "Best, Ruben" or "Ivy" also imply sales.
3. Assign role='lead' to messages from the prospect (often the other party in a thread; name often anonymized to "X").
4. Reconstruct CHRONOLOGICAL order (oldest first, newest last). Reverse the email-thread ordering if needed.
5. For each message, extract the content verbatim (do NOT paraphrase or translate). Preserve line breaks within content.
6. Set 'ts' to ISO-8601 if you can infer date+time from the message's header. Otherwise null.
7. Set 'sender' to the name you identified, or null if unknown.
8. Classify the whole conversation:
   - outcome: call_booked (prospect agreed to a discovery/intro call), fit_mismatch (product doesn't fit prospect's need), disqualified (prospect excluded, e.g. no license), ongoing (active conversation, no clear end), no_response (no reply from lead after outreach), other.
   - stages_covered: subset of [cold, qualifying, scheduling, scheduled, post_call, stalled, any]. "cold" = initial outreach. "qualifying" = exchanging info about fit. "scheduling" = trying to book a meeting. "scheduled" = meeting booked. "post_call" = follow-up after a call happened. "stalled" = went quiet. "any" = unclear.
9. 'notes': one sentence on anything unusual or important about this conversation (optional).

Return JSON matching the schema exactly. Do NOT invent messages that aren't in the source. If only one turn is visible, return one message.`;

async function extractOne(
  id: string,
  raw: string,
): Promise<Conversation> {
  const { object } = await generateObject({
    model: miniModel(),
    schema: ConversationShape,
    system: SYSTEM_PROMPT,
    prompt: `Conversation ${id} source:\n\n${raw}`,
    temperature: 0.1,
  });
  return { id, ...object };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];

  const md = await readFile(SRC, "utf-8");
  const blocks = splitBlocks(md);
  console.log(`Found ${blocks.length} conversation blocks.`);

  await mkdir(OUT_DIR, { recursive: true });

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const block of blocks) {
    if (only && !only.split(",").includes(block.id)) continue;
    const outPath = `${OUT_DIR}/${block.id}.json`;
    if (!force && existsSync(outPath)) {
      skipped++;
      continue;
    }
    try {
      const t0 = Date.now();
      const convo = await extractOne(block.id, block.raw);
      await writeFile(outPath, JSON.stringify(convo, null, 2) + "\n");
      const ms = Date.now() - t0;
      console.log(
        `  ${block.id}: ${convo.messages.length} msgs, outcome=${convo.outcome}, stages=[${convo.stages_covered.join(",")}] (${ms}ms)`,
      );
      ok++;
    } catch (e) {
      console.error(`  ${block.id} FAILED: ${(e as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} ok, ${skipped} skipped (already exist), ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
