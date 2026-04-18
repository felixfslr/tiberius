import { readFile } from "node:fs/promises";

type Result = {
  id: string;
  pass: boolean;
  violations: string[];
  quality: number;
  confidence: number;
  reply: string;
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

function fmt(n: number): string {
  return isNaN(n) ? "—" : n.toFixed(2);
}

function sign(delta: number): string {
  if (isNaN(delta)) return "—";
  if (delta > 0) return `+${delta.toFixed(2)}`;
  return delta.toFixed(2);
}

async function main() {
  const [a, b] = [process.argv[2], process.argv[3]];
  if (!a || !b) {
    console.error("usage: tsx scripts/eval-diff.ts <before.json> <after.json>");
    process.exit(1);
  }
  const before: Baseline = JSON.parse(await readFile(a, "utf-8"));
  const after: Baseline = JSON.parse(await readFile(b, "utf-8"));

  const beforeMap = new Map(before.results.map((r) => [r.id, r]));
  const afterMap = new Map(after.results.map((r) => [r.id, r]));
  const allIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const lines: string[] = [];
  lines.push(`# Eval Delta — ${a} → ${b}`);
  lines.push(``);
  lines.push(`- Before: ${before.run_at} (n=${before.n_cases})`);
  lines.push(`- After:  ${after.run_at} (n=${after.n_cases})`);
  lines.push(``);

  // Aggregate delta
  lines.push(`## Aggregate deltas`);
  lines.push(``);
  lines.push(`| Group | Metric | Before | After | Δ |`);
  lines.push(`|---|---|---|---|---|`);
  for (const group of ["overall", "synthetic", "ivy_real"] as const) {
    const bAgg = before.aggregates[group] ?? {};
    const aAgg = after.aggregates[group] ?? {};
    const metrics = new Set([...Object.keys(bAgg), ...Object.keys(aAgg)]);
    for (const m of metrics) {
      const bv = bAgg[m];
      const av = aAgg[m];
      if (typeof bv !== "number" && typeof av !== "number") continue;
      const d = (typeof av === "number" ? av : NaN) - (typeof bv === "number" ? bv : NaN);
      lines.push(`| ${group} | ${m} | ${typeof bv === "number" ? fmt(bv) : "—"} | ${typeof av === "number" ? fmt(av) : "—"} | ${sign(d)} |`);
    }
  }
  lines.push(``);

  // Per-case diffs
  type Row = {
    id: string;
    qBefore?: number;
    qAfter?: number;
    qDelta: number;
    goldBefore?: number;
    goldAfter?: number;
    goldDelta: number;
    confBefore?: number;
    confAfter?: number;
  };
  const rows: Row[] = [];
  for (const id of allIds) {
    const b = beforeMap.get(id);
    const a = afterMap.get(id);
    rows.push({
      id,
      qBefore: b?.quality,
      qAfter: a?.quality,
      qDelta: (a?.quality ?? NaN) - (b?.quality ?? NaN),
      goldBefore: b?.gold_alignment,
      goldAfter: a?.gold_alignment,
      goldDelta: (a?.gold_alignment ?? NaN) - (b?.gold_alignment ?? NaN),
      confBefore: b?.confidence,
      confAfter: a?.confidence,
    });
  }

  // Movers: gold_alignment or quality moved ≥1 point
  const movers = rows.filter(
    (r) =>
      (!isNaN(r.goldDelta) && Math.abs(r.goldDelta) >= 1) ||
      (!isNaN(r.qDelta) && Math.abs(r.qDelta) >= 1),
  );
  if (movers.length) {
    lines.push(`## Notable movers (|Δquality|≥1 or |Δgold|≥1)`);
    lines.push(``);
    for (const r of movers.sort((a, b) => (b.goldDelta || b.qDelta) - (a.goldDelta || a.qDelta))) {
      const qStr =
        r.qBefore !== undefined || r.qAfter !== undefined
          ? `quality ${fmt(r.qBefore ?? NaN)} → ${fmt(r.qAfter ?? NaN)} (${sign(r.qDelta)})`
          : "";
      const gStr =
        r.goldBefore !== undefined || r.goldAfter !== undefined
          ? `gold ${fmt(r.goldBefore ?? NaN)} → ${fmt(r.goldAfter ?? NaN)} (${sign(r.goldDelta)})`
          : "";
      lines.push(`- **${r.id}**: ${[qStr, gStr].filter(Boolean).join(", ")}`);
    }
    lines.push(``);
  } else {
    lines.push(`_No notable per-case movers (|Δquality|≥1 or |Δgold|≥1)._`);
    lines.push(``);
  }

  // Full per-case table
  lines.push(`## Per-case detail`);
  lines.push(``);
  lines.push(`| id | quality | Δ | gold | Δ | conf | Δ |`);
  lines.push(`|---|---|---|---|---|---|---|`);
  for (const r of rows.sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(
      `| ${r.id} | ${fmt(r.qBefore ?? NaN)}→${fmt(r.qAfter ?? NaN)} | ${sign(r.qDelta)} | ${fmt(r.goldBefore ?? NaN)}→${fmt(r.goldAfter ?? NaN)} | ${sign(r.goldDelta)} | ${fmt(r.confBefore ?? NaN)}→${fmt(r.confAfter ?? NaN)} | ${sign((r.confAfter ?? NaN) - (r.confBefore ?? NaN))} |`,
    );
  }
  lines.push(``);

  console.log(lines.join("\n"));
}

main();
