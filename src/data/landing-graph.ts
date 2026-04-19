import type { RichEdge, RichGraph, RichNode } from "@/lib/services/graph-rich";

// Seeded deterministic PRNG so the graph is identical across server & client
// renders (no hydration flicker).
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260419);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
const pickSome = <T>(arr: readonly T[], min: number, max: number): T[] => {
  const n = min + Math.floor(rng() * (max - min + 1));
  const copy = [...arr].sort(() => rng() - 0.5);
  return copy.slice(0, Math.min(n, copy.length));
};

const STAGES = [
  "cold",
  "qualifying",
  "scheduling",
  "scheduled",
  "stalled",
  "any",
] as const;

const INTENTS = [
  "product_fit",
  "pricing",
  "objection",
  "scheduling",
  "integration",
  "timeline",
  "small_talk",
  "compliance",
  "competitor",
  "contact_info",
  "other",
] as const;

const ENTITIES = [
  "Ivy",
  "USDC",
  "EUR",
  "BVNK",
  "Circle",
  "Calendly",
  "MiCA",
  "Stripe",
  "Hetzner",
  "Supabase",
  "OpenAI",
  "Shopify",
  "Telegram",
  "WhatsApp",
];

type TemplateSpec = {
  type: string;
  summaries: string[];
  snippets: string[];
  intents: readonly (typeof INTENTS)[number][];
  stages: readonly (typeof STAGES)[number][];
  weight: number;
  cluster: "pricing" | "objection" | "scheduling" | "product";
};

const TEMPLATES: TemplateSpec[] = [
  {
    type: "product_doc",
    cluster: "product",
    weight: 32,
    intents: ["product_fit", "integration", "compliance"],
    stages: ["any", "qualifying"],
    summaries: [
      "Ivy stablecoin on/off-ramp supports USDC and EUR with T+0 settlement for approved merchants.",
      "MiCA licensing: Ivy operates under a full EMI license in the EU — counts toward compliance sign-off for PSPs.",
      "SDK integration takes ~2 hours for a merchant already using Stripe or Adyen; docs include Shopify plugin.",
      "Volume tier A covers $0–5M/mo at 0.45% blended; tier B at $5–50M at 0.32%; tier C (custom) above $50M.",
      "Settlement windows: EU SEPA instant between 06:00–22:00 CET; fallback SEPA same-day outside window.",
      "Geographic coverage: EEA + UK + CH live. US is gated waitlist via separate entity.",
    ],
    snippets: [
      "Ivy is an EMI-licensed stablecoin pay-in/out stack. USDC → EUR T+0 settlement, 0.32% blended at $5M+.",
      "Integration path: Shopify plugin (30 min) or REST (~2h) — docs.ivypay.io/quickstart. SDK in JS, Py, Go.",
      "MiCA-ready: full EMI license, customer funds segregated, audited by KPMG every quarter.",
    ],
  },
  {
    type: "sop",
    cluster: "scheduling",
    weight: 18,
    intents: ["scheduling", "pricing", "objection"],
    stages: ["qualifying", "scheduling"],
    summaries: [
      "SOP: when prospect mentions pricing and volume > $5M/mo, send Calendly link to Felix (EU slots).",
      "SOP: if prospect asks about competitor pricing, do NOT disclose Ivy's tier B rate — request call first.",
      "SOP: after 2 unanswered messages in qualifying stage, mark as stalled and flag for review.",
      "SOP: compliance questions always get the MiCA one-pager + offer call with Ivy's compliance lead.",
      "SOP: never promise specific settlement windows in writing — always 'up to 15 minutes' hedge.",
      "SOP: technical deep-dive questions → loop in solutions engineer via Slack #sales-solutions.",
    ],
    snippets: [
      "IF intent=pricing AND entities CONTAINS ('$50M' OR '50M' OR 'volume') THEN suggested_tool=send_calendly_link",
      "IF stage=scheduling AND no_response_hours > 48 THEN mark stalled, flag_for_review.",
      "IF entities CONTAINS competitor AND intent=competitor THEN DO NOT quote pricing, request call.",
    ],
  },
  {
    type: "chat_history",
    cluster: "objection",
    weight: 22,
    intents: ["pricing", "objection", "competitor", "timeline"],
    stages: ["qualifying", "stalled"],
    summaries: [
      "Past deal: Helio switched from BVNK because BVNK couldn't settle EUR same-day at their volume.",
      "Past deal: Acme PSP objected to 0.32%, negotiated down to 0.28% with 12-month commit — closed in 11 days.",
      "Past deal: MerchantX pushed back on custody risk; resolved by sharing KPMG audit + MiCA docs.",
      "Past deal: Lost one to Circle because Circle had a US entity ready — note for US-gated prospects.",
      "Past deal: Starship went from first ping to signed contract in 9 days after demo + compliance sign-off.",
    ],
    snippets: [
      "prospect: 'BVNK quoted us 0.40% — why would we switch?'\nagent: 'Honestly: T+0 + SEPA instant. BVNK is T+1. For your volume that's $80k/mo in float.'",
      "prospect: 'Your competitor has US coverage.'\nagent: 'Fair. We're EU-only live; US is Q3. If you're EU-first we're the stronger fit today.'",
    ],
  },
  {
    type: "tov_example",
    cluster: "product",
    weight: 10,
    intents: ["product_fit", "small_talk", "objection"],
    stages: ["cold", "qualifying"],
    summaries: [
      "Tone: warm, direct, no emojis. Mirror the prospect's register. Never apologize for pricing.",
      "Tone: on objections, acknowledge first ('totally fair'), then reframe with evidence (volume/rate math).",
      "Tone: keep replies under 80 words unless asked for a technical deep-dive. No bullet points in first message.",
      "Tone: use prospect's company name once; avoid 'you guys' — use 'your team' or their company name.",
    ],
    snippets: [
      "GOOD: 'Totally fair — let me pull the exact numbers for your volume band and send them over today.'",
      "BAD: 'Sorry to hear that! We completely understand your concerns and would love to jump on a call 😊'",
    ],
  },
  {
    type: "glossary",
    cluster: "product",
    weight: 14,
    intents: ["compliance", "integration", "product_fit"],
    stages: ["any"],
    summaries: [
      "Glossary: USDC — Circle's fully reserved USD stablecoin, 1:1 redeemable, ERC-20/Solana.",
      "Glossary: MiCA — EU's Markets in Crypto-Assets regulation, in force since Dec 2024 for stablecoins.",
      "Glossary: T+0 settlement — funds cleared same calendar day as authorization, no overnight exposure.",
      "Glossary: EMI license — Electronic Money Institution, issued per EU member state, allows e-money issuance.",
      "Glossary: SEPA instant — EU payment rail, up to €100k, ~10 sec settlement, 24/7.",
      "Glossary: PSP — Payment Service Provider, aggregates merchant flows to acquirers/rails.",
      "Glossary: blended rate — average effective fee across all merchant transactions, inclusive of FX.",
      "Glossary: merchant of record — entity liable for chargebacks, taxes, regulatory compliance per txn.",
    ],
    snippets: [
      "USDC = Circle stablecoin, 1:1 USD. On Ethereum (ERC-20) and Solana. Redeemable at Circle directly.",
      "T+0 = same-day settlement. Our default. Competitors mostly T+1. Big deal at volume (float cost).",
      "MiCA = EU crypto regulation, live Dec 2024. Ivy has full EMI + MiCA stablecoin issuer status.",
    ],
  },
  {
    type: "convo_snippet",
    cluster: "scheduling",
    weight: 8,
    intents: ["scheduling", "contact_info", "small_talk"],
    stages: ["scheduling", "scheduled"],
    summaries: [
      "Closing line that worked 4x: 'Want me to grab 20 minutes with Felix this week? He'll walk the tier maths.'",
      "Opener that worked: 'Saw your USDC volume tripled last quarter — curious what your current rail costs?'",
      "Rescue-from-stalled: 'No rush at all — I'll park this. If the USDC question comes up again, you know where I am.'",
    ],
    snippets: [
      "'Grab 20 with Felix? He'll walk the tier maths.' → {{calendly_url}}",
      "'Saw your USDC volume tripled — what's your current rail cost?'",
    ],
  },
];

// --- build nodes ---

const nodes: RichNode[] = [];
let nodeId = 0;

for (const tpl of TEMPLATES) {
  for (let i = 0; i < tpl.weight; i++) {
    const summary = pick(tpl.summaries);
    const content = pick(tpl.snippets);
    const intents = pickSome(tpl.intents, 1, Math.min(2, tpl.intents.length));
    const stages = pickSome(tpl.stages, 1, Math.min(2, tpl.stages.length));
    const entities = pickSome(ENTITIES, 0, 3);
    const id = `c_${String(nodeId).padStart(3, "0")}`;
    nodes.push({
      id,
      content,
      content_preview: content.slice(0, 80),
      content_type: tpl.type,
      position: nodeId,
      retrieval_count: Math.floor(rng() * 18),
      edited_by_user: rng() < 0.12,
      deprecated: false,
      stage: stages,
      intent: intents,
      entities,
      summary,
      file_id: `f_${tpl.type}_${Math.floor(i / 4)}`,
      filename: `${tpl.type}_${Math.floor(i / 4)}.md`,
      folder_id: null,
      folder_name: null,
    });
    nodeId++;
  }
}

// Tag nodes with their cluster so we can bias edges inside clusters.
const nodeCluster = new Map<string, TemplateSpec["cluster"]>();
{
  let idx = 0;
  for (const tpl of TEMPLATES) {
    for (let i = 0; i < tpl.weight; i++) {
      nodeCluster.set(nodes[idx]!.id, tpl.cluster);
      idx++;
    }
  }
}

// --- build edges ---

const edges: RichEdge[] = [];
const edgeSeen = new Set<string>();

function addEdge(
  source: string,
  target: string,
  weight: number,
  edge_type: RichEdge["edge_type"],
) {
  if (source === target) return;
  const key = source < target ? `${source}|${target}` : `${target}|${source}`;
  if (edgeSeen.has(key)) return;
  edgeSeen.add(key);
  edges.push({ source, target, weight, edge_type });
}

// Dense intra-cluster similarity edges.
for (const a of nodes) {
  const clusterA = nodeCluster.get(a.id);
  // Each node gets ~3 similarity neighbors biased toward same cluster.
  const candidates = nodes
    .filter(
      (b) =>
        b.id !== a.id &&
        (nodeCluster.get(b.id) === clusterA ? rng() < 0.12 : rng() < 0.025),
    )
    .slice(0, 8);
  for (const b of candidates) {
    const weight = 0.4 + rng() * 0.55;
    addEdge(a.id, b.id, weight, "similarity");
  }
}

// Co-retrieval edges: tie together nodes that share an intent, pricing/scheduling cross-cluster.
for (let i = 0; i < 80; i++) {
  const a = pick(nodes);
  const shareIntent = nodes.filter(
    (b) => b.id !== a.id && b.intent.some((x) => a.intent.includes(x)),
  );
  if (shareIntent.length === 0) continue;
  const b = pick(shareIntent);
  const weight = 0.55 + rng() * 0.4;
  // Promote to "mixed" if a similarity edge already exists.
  const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
  if (edgeSeen.has(key)) {
    // Find the existing edge and upgrade.
    const existing = edges.find((e) =>
      e.source === a.id
        ? e.target === b.id
        : e.source === b.id && e.target === a.id,
    );
    if (existing && existing.edge_type === "similarity") {
      existing.edge_type = "mixed";
      existing.weight = Math.max(existing.weight, weight);
    }
  } else {
    addEdge(a.id, b.id, weight, "co_retrieval");
  }
}

// --- stats ---

const content_type_counts: Record<string, number> = {};
for (const n of nodes) {
  content_type_counts[n.content_type] =
    (content_type_counts[n.content_type] ?? 0) + 1;
}

const unique_stages = Array.from(new Set(nodes.flatMap((n) => n.stage))).sort();
const unique_intents = Array.from(
  new Set(nodes.flatMap((n) => n.intent)),
).sort();

const entityCounts = new Map<string, number>();
for (const n of nodes)
  for (const e of n.entities)
    entityCounts.set(e, (entityCounts.get(e) ?? 0) + 1);
const top_entities = [...entityCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 14)
  .map(([entity, count]) => ({ entity, count }));

const similarity_edges = edges.filter(
  (e) => e.edge_type === "similarity",
).length;
const co_retrieval_edges = edges.filter(
  (e) => e.edge_type === "co_retrieval",
).length;

export const landingGraph: RichGraph = {
  agent_id: "demo-asktiberius",
  nodes,
  edges,
  computed_at: "2026-04-19T00:00:00.000Z",
  stats: {
    chunk_count: nodes.length,
    edge_count: edges.length,
    similarity_edges,
    co_retrieval_edges,
    unique_stages,
    unique_intents,
    top_entities,
    content_type_counts,
  },
};
