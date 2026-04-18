import type { Message } from "@/lib/schemas/common";

const CRYPTO_TERMS = [
  "btc",
  "eth",
  "usdc",
  "usdt",
  "stablecoin",
  "on-ramp",
  "off-ramp",
  "fiat",
  "sepa",
  "swift",
  "ach",
  "wire",
  "iban",
  "pay-in",
  "pay-out",
  "payin",
  "payout",
  "settlement",
  "custody",
  "kyc",
  "kyb",
  "aml",
  "travel rule",
  "mica",
  "emoney",
  "e-money",
];

const COMPETITORS = [
  "bvnk",
  "circle",
  "mesh",
  "moonpay",
  "banxa",
  "ramp",
  "stripe crypto",
  "openpayd",
];

const SCHEDULING_SIGNALS = [
  "calendly",
  "next week",
  "this week",
  "tomorrow",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "available",
  "availability",
  "call",
  "meeting",
  "demo",
  "zoom",
  "google meet",
];

const OBJECTION_SIGNALS = [
  "expensive",
  "too high",
  "pricing",
  "budget",
  "not sure",
  "think about it",
  "competitor",
  "already have",
  "not interested",
  "compliance",
  "license",
];

const ALL_LOOKUPS = [
  ...CRYPTO_TERMS,
  ...COMPETITORS,
  ...SCHEDULING_SIGNALS,
  ...OBJECTION_SIGNALS,
];

// Pre-compile a single regex: each term allows an optional trailing "s" to catch
// common plurals ("pay-ins", "competitors", "calls"). Use a non-greedy pattern.
const LOOKUP_REGEX = new RegExp(
  `\\b(${ALL_LOOKUPS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})s?\\b`,
  "gi",
);

// Simple amount matcher: "$10m", "€500k", "10 million", "50k"
const AMOUNT_REGEX =
  /(?:\$|€|£)?\s?\d+(?:[.,]\d+)?\s?(?:m|million|bn|billion|k|thousand|%)?\b/gi;

export function extractEntities(
  trigger_message: string,
  recentHistory: Message[] = [],
): string[] {
  const hay = [
    trigger_message,
    ...recentHistory.slice(-3).map((m) => m.content),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  const hits = new Set<string>();

  const matches = hay.matchAll(LOOKUP_REGEX);
  for (const m of matches) {
    // m[1] is the canonical term (without the optional "s").
    hits.add(m[1].toLowerCase());
  }

  // Also capture likely product/geography names from trigger: capitalized words (preserve casing from source).
  const cap = trigger_message.matchAll(/\b([A-Z][A-Za-z0-9]{2,})\b/g);
  const stopWords = new Set([
    "the",
    "and",
    "but",
    "you",
    "your",
    "our",
    "their",
    "hello",
    "hi",
    "hey",
    "thanks",
    "thank",
    "regards",
    "best",
    "i",
  ]);
  for (const m of cap) {
    const w = m[1].toLowerCase();
    if (w.length >= 3 && !stopWords.has(w)) hits.add(w);
  }

  // Amounts (keep normalized).
  const amounts = trigger_message.match(AMOUNT_REGEX) ?? [];
  for (const a of amounts) {
    const norm = a.trim().toLowerCase();
    if (/\d/.test(norm) && norm.length <= 20) hits.add(norm);
  }

  return Array.from(hits).slice(0, 20);
}
