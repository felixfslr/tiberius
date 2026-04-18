import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

type Result = {
  id: string;
  pass: boolean;
  violations: string[];
  quality: number;
  confidence: number;
  reply: string;
  intent: string;
  tool: string;
  latency_ms: number;
  gold_alignment?: number;
  intent_match?: number;
  stage_appropriateness?: number;
  tone_match?: number;
  synthetic?: boolean;
  has_gold?: boolean;
};
type Baseline = {
  run_at: string;
  n_cases: number;
  results: Result[];
  aggregates: Record<string, Record<string, number>>;
};

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function fmt(n: number): string {
  return isNaN(n) ? "—" : n.toFixed(2);
}

function rankLowest<T>(rows: T[], key: (r: T) => number, n: number): T[] {
  return [...rows].sort((a, b) => key(a) - key(b)).slice(0, n);
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: tsx scripts/eval-diag.ts <baseline.json> [--out <md>]");
    process.exit(1);
  }
  const outIdx = process.argv.indexOf("--out");
  const defaultOut = path.replace(/baseline-/, "failure-modes-").replace(/\.json$/, ".md");
  const out = outIdx > -1 ? process.argv[outIdx + 1] : defaultOut;

  return run(path, out);
}

async function run(path: string, out: string) {
  const baseline: Baseline = JSON.parse(await readFile(path, "utf-8"));

  const all = baseline.results;
  const golds = all.filter((r) => r.has_gold);
  const synths = all.filter((r) => r.synthetic);

  const dims: Array<{ name: string; picker: (r: Result) => number | undefined; group: Result[] }> = [
    { name: "quality", picker: (r) => r.quality, group: all },
    { name: "confidence", picker: (r) => r.confidence, group: all },
    { name: "gold_alignment", picker: (r) => r.gold_alignment, group: golds },
    { name: "intent_match", picker: (r) => r.intent_match, group: golds },
    { name: "stage_appropriateness", picker: (r) => r.stage_appropriateness, group: golds },
    { name: "tone_match", picker: (r) => r.tone_match, group: golds },
  ];

  const dimStats = dims.map((d) => {
    const vals = d.group.map(d.picker).filter((v): v is number => typeof v === "number");
    const mean = avg(vals);
    const lowCount = vals.filter((v) => v < 3).length;
    return { name: d.name, n: vals.length, mean, lowCount };
  });

  // Rank cases by lowest quality + worst gold_alignment
  const worstByQuality = rankLowest(all, (r) => r.quality, 3);
  const worstByGold = rankLowest(golds, (r) => r.gold_alignment ?? 5, 3);
  const failingCases = all.filter((r) => !r.pass);

  const lines: string[] = [];
  lines.push(`# Failure Modes — ${basename(path)}`);
  lines.push(``);
  lines.push(`Generated from \`${path}\` (run at ${baseline.run_at}, n=${baseline.n_cases}).`);
  lines.push(``);
  lines.push(`## Per-dimension aggregates`);
  lines.push(``);
  lines.push(`| Dimension | n | mean | cases < 3 |`);
  lines.push(`|---|---|---|---|`);
  for (const s of dimStats) {
    lines.push(`| ${s.name} | ${s.n} | ${fmt(s.mean)} | ${s.lowCount} |`);
  }
  lines.push(``);
  const systematicallyLow = dimStats
    .filter((s) => s.n > 0 && s.mean < 3.5)
    .sort((a, b) => a.mean - b.mean);
  if (systematicallyLow.length) {
    lines.push(`**Systematically low dimensions (mean < 3.5):** ${systematicallyLow
      .map((s) => `${s.name} (${fmt(s.mean)})`)
      .join(", ")}`);
  } else {
    lines.push(`**No dimension is systematically low (all means ≥ 3.5).**`);
  }
  lines.push(``);

  lines.push(`## Top failures`);
  lines.push(``);
  lines.push(`### Lowest quality (top 3)`);
  for (const r of worstByQuality) {
    lines.push(`- **${r.id}** — quality=${fmt(r.quality)}, conf=${fmt(r.confidence)}, gold=${r.gold_alignment !== undefined ? fmt(r.gold_alignment) : "—"}`);
    lines.push(`  reply: "${r.reply.slice(0, 120).replace(/\n/g, " ")}…"`);
    if (r.violations.length) lines.push(`  violations: ${r.violations.join(" | ")}`);
  }
  lines.push(``);

  if (worstByGold.length) {
    lines.push(`### Lowest gold_alignment (top 3, ivy_real only)`);
    for (const r of worstByGold) {
      lines.push(`- **${r.id}** — gold=${fmt(r.gold_alignment!)} intent=${fmt(r.intent_match!)} stage=${fmt(r.stage_appropriateness!)} tone=${fmt(r.tone_match!)}`);
      lines.push(`  reply: "${r.reply.slice(0, 120).replace(/\n/g, " ")}…"`);
    }
    lines.push(``);
  }

  if (failingCases.length) {
    lines.push(`### All failing assertions (${failingCases.length})`);
    for (const r of failingCases) {
      lines.push(`- **${r.id}**: ${r.violations.join(" | ")}`);
    }
    lines.push(``);
  }

  // Top-3 failure-mode hypotheses (human-readable)
  lines.push(`## Top-3 failure-mode hypotheses (derived from signals above)`);
  lines.push(``);
  const h: string[] = [];
  const low = systematicallyLow.map((s) => s.name);
  if (low.includes("tone_match")) h.push("**Tone drift** — replies sound less like Ferdi than the gold set (consider H-TONE: ingest Ferdi-style ToV examples).");
  if (low.includes("stage_appropriateness")) h.push("**Stage-mismatch** — replies are pitched at wrong funnel stage (consider H-STAGE: few-shot the state-tracker).");
  if (low.includes("gold_alignment") || low.includes("intent_match")) h.push("**Intent drift** — draft pursues a different conversational move than the human would (consider H-SOP: extract implicit rules from training convos).");
  if (low.includes("confidence") || (dimStats.find((s) => s.name === "quality")?.mean ?? 5) < 3.5) h.push("**Grounding** — quality or confidence low broadly (consider H-GROUNDEDNESS-TUNE or H-SLOT-BALANCE).");
  if (synths.length && golds.length && avg(synths.map((r) => r.quality)) - avg(golds.map((r) => r.quality)) > 0.7) h.push("**Synthetic-only regression** — model does better on contrived tests than real Ivy turns (→ ivy_real set exposes blind spots; retrieval may not be pulling the right past convos).");
  if (!h.length) h.push("_No obvious systemic failure — dig into individual cases._");
  for (const s of h.slice(0, 3)) lines.push(`- ${s}`);
  lines.push(``);

  await writeFile(out, lines.join("\n") + "\n");
  console.log(`Wrote ${out}`);
}

main();
