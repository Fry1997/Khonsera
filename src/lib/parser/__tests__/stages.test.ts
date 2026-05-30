import { describe, it, expect } from "vitest";
import { tokenise } from "../tokenise";
import { recogniseDates } from "../recognisers/dates";
import { recogniseTimes } from "../recognisers/times";
import { recogniseMoney } from "../recognisers/money";
import { recogniseDurations } from "../recognisers/duration";
import { recogniseParty } from "../recognisers/party";
import { recognisePeople } from "../recognisers/people";
import { lookup } from "../lookup";
import { getDictionary } from "../../dictionary/dictionary";
import { disambiguateOperator, classifyFollowing } from "../operators";

const REF = new Date("2026-05-30T09:00:00");
const dict = getDictionary();

describe("tokeniser", () => {
  it("preserves offsets and splits punctuation", () => {
    const toks = tokenise("Train to Derby, 8pm.");
    expect(toks[0].text).toBe("Train");
    expect(toks[0].start).toBe(0);
    expect(toks.some((t) => t.kind === "punct" && t.text === ",")).toBe(true);
    // every token's slice matches the original substring
    const input = "Train to Derby, 8pm.";
    for (const t of toks) expect(input.slice(t.start, t.end)).toBe(t.text);
  });
});

describe("recognisers", () => {
  it("dates: relative is confident, bare ordinal is low-confidence", () => {
    expect(recogniseDates("tomorrow", REF)[0].normalised_value).toBe("2026-05-31");
    const ord = recogniseDates("the 22nd", REF)[0];
    expect(ord.confidence).toBe("low");
    expect(ord.normalised_value).toBe("2026-06-22");
  });

  it("times: clock times exact, day-periods are fuzzy ranges", () => {
    expect(recogniseTimes("8pm", REF)[0].normalised_value).toBe("20:00");
    const morning = recogniseTimes("tomorrow morning", REF).find((m) => m.granularity === "period");
    expect(morning?.fuzzy).toBe(true);
    expect(morning?.range).toBe(true);
  });

  it("money: amounts, bounds and qualitative preferences", () => {
    expect(recogniseMoney("£38.50")[0].normalised_value).toMatchObject({ amount: 38.5, constraint: "equals" });
    expect(recogniseMoney("no more than £200")[0].normalised_value).toMatchObject({ constraint: "maximum" });
    expect(recogniseMoney("around £100")[0].normalised_value).toMatchObject({ constraint: "approximate" });
    expect(recogniseMoney("cheap")[0].normalised_value).toMatchObject({ constraint: "preference" });
  });

  it("durations: normalises to minutes; vague is fuzzy", () => {
    expect(recogniseDurations("90 minutes")[0].normalised_value).toBe(90);
    expect(recogniseDurations("half an hour")[0].normalised_value).toBe(30);
    expect(recogniseDurations("a few hours")[0].fuzzy).toBe(true);
  });

  it("party: solo → 1; explicit and family sizes", () => {
    expect(recogniseParty("just me")[0].normalised_value).toBe(1);
    expect(recogniseParty("table for four")[0].normalised_value).toBe(4);
    expect(recogniseParty("family of four")[0].normalised_value).toBe(4);
  });

  it("people: recognises shape, flags runtime resolution", () => {
    const fam = recognisePeople("dinner with my wife")[0];
    expect(fam.meta?.kind).toBe("family_reference");
    expect(fam.meta?.requires_runtime_resolution).toBe(true);
    expect(recognisePeople("meeting with Sarah")[0].source_text).toBe("Sarah");
  });
});

describe("lookup — longest match + carry all categories", () => {
  it("matches multi-word concept phrases over single words", () => {
    const toks = tokenise("by train to Derby");
    const res = lookup(toks, dict);
    expect(res.concepts.some((c) => c.phrase === "by train")).toBe(true);
  });

  it("carries every operator category for a multi-category word", () => {
    const toks = tokenise("by");
    const res = lookup(toks, dict);
    expect(res.operators[0].categories).toEqual(
      expect.arrayContaining(["positioner", "narrower", "method_marker"]),
    );
  });
});

describe("operator disambiguation (§10)", () => {
  const by = dict.operatorIndex.get("by")!;
  it("'by 8pm' → positioner (deadline)", () => {
    expect(disambiguateOperator(by, "time")).toBe("positioner");
  });
  it("'by the station' → narrower", () => {
    expect(disambiguateOperator(by, "place")).toBe("narrower");
  });
  it("'by train' → method_marker", () => {
    expect(disambiguateOperator(by, "mode")).toBe("method_marker");
  });
  it("classifyFollowing recognises a mode noun via the dictionary", () => {
    expect(classifyFollowing("train", dict)).toBe("mode");
    expect(classifyFollowing("8pm", dict, { isTime: true })).toBe("time");
  });
});
