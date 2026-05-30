import { describe, it, expect } from "vitest";
import { parse } from "../parse";
import type { PlaceResolver, ResolvedHub } from "../slots";

const REF = new Date("2026-05-30T09:00:00");
const HUBS: Record<string, ResolvedHub> = {
  derby: { id: "hub-der", name: "Derby", code: "DER" },
  wellingborough: { id: "hub-wle", name: "Wellingborough", code: "WLE" },
};
const resolver: PlaceResolver = {
  async resolveHub(n) {
    const h = HUBS[n.trim().toLowerCase()];
    return { match: h ?? null, candidates: h ? [h] : [] };
  },
  async resolveLocation() {
    return null;
  },
};

// Guards the parsed_payload structure against unintended shape changes (brief §18).
describe("parsed_payload shape", () => {
  it("matches the snapshot for the canonical multi-fact input", async () => {
    const p = await parse("Derby demo Wed 11 June, train from Wellingborough", {
      ref: REF,
      resolver,
    });
    expect(p).toMatchSnapshot();
  });
});
