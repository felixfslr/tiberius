import { describe, expect, it } from "vitest";
import { rrfMerge } from "@/lib/retrieval/hybrid-search";
import type { RetrievedChunk } from "@/lib/retrieval/types";

function chunk(id: string, source: RetrievedChunk["source"] = "hybrid"): RetrievedChunk {
  return {
    id,
    file_id: null,
    content: `content-${id}`,
    content_type: "product_doc",
    metadata: { stage: [], intent: [], entities: [] },
    source,
    score: 0,
  };
}

describe("rrfMerge", () => {
  it("merges two streams, weighting higher ranks more", () => {
    const a = [chunk("x"), chunk("y"), chunk("z")]; // rank 1,2,3
    const b = [chunk("y"), chunk("w"), chunk("x")]; // rank 1,2,3

    const merged = rrfMerge([a, b]);
    const ids = merged.map((c) => c.id);
    // y appears in both and at top-ish positions → should be #1
    expect(ids[0]).toBe("y");
    // x is in both but lower overall → before w and z
    expect(ids.indexOf("x")).toBeLessThan(ids.indexOf("w"));
  });

  it("preserves single-stream order when only one stream", () => {
    const a = [chunk("a"), chunk("b"), chunk("c")];
    const merged = rrfMerge([a]);
    expect(merged.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("respects topN", () => {
    const a = [chunk("a"), chunk("b"), chunk("c"), chunk("d")];
    const merged = rrfMerge([a], { topN: 2 });
    expect(merged.length).toBe(2);
    expect(merged.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("deduplicates across streams by id", () => {
    const a = [chunk("a"), chunk("b")];
    const b = [chunk("a"), chunk("b")];
    const merged = rrfMerge([a, b]);
    expect(merged.length).toBe(2);
  });
});
