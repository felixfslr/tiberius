import { describe, expect, it } from "vitest";
import { extractEntities } from "@/lib/retrieval/entity-extractor";

describe("extractEntities", () => {
  it("catches crypto terms and pay-in/out jargon", () => {
    const out = extractEntities("We process USDC pay-ins via SEPA for our exchange.");
    expect(out).toContain("usdc");
    expect(out).toContain("pay-in");
    expect(out).toContain("sepa");
  });

  it("catches competitor mentions", () => {
    const out = extractEntities("We already use BVNK but open to alternatives.");
    expect(out).toContain("bvnk");
  });

  it("catches scheduling signals", () => {
    const out = extractEntities("Does next Tuesday work for a call next week?");
    expect(out).toEqual(expect.arrayContaining(["next week", "tuesday", "call"]));
  });

  it("catches amounts", () => {
    const out = extractEntities("We move around $50m per month");
    expect(out.some((e) => e.includes("50m") || e.includes("$50m"))).toBe(true);
  });

  it("returns empty-ish for a greeting", () => {
    const out = extractEntities("Hi, nice to connect!");
    // May pick up capitalized words but should not include crypto jargon.
    expect(out).not.toContain("usdc");
    expect(out).not.toContain("sepa");
  });

  it("deduplicates across trigger and history", () => {
    const out = extractEntities("We need USDC payouts.", [
      { role: "user", content: "USDC volume is growing." },
      { role: "assistant", content: "Great, we support USDC." },
    ]);
    const countUsdc = out.filter((e) => e === "usdc").length;
    expect(countUsdc).toBe(1);
  });
});
