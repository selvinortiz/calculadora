import { describe, expect, it } from "vitest";
import { matchesSearch } from "./resource-data";

describe("matchesSearch", () => {
  it("matches names without requiring accents or exact casing", () => {
    expect(matchesSearch("maria ortiz", "María Ortíz")).toBe(true);
    expect(matchesSearch("MARÍA", "María Ortíz")).toBe(true);
  });

  it("searches across account references and document numbers", () => {
    expect(matchesSearch("lote 40", "María Ortíz", "Lote 40", "REC-000001")).toBe(true);
    expect(matchesSearch("rec-000001", "María Ortíz", "Lote 40", "REC-000001")).toBe(true);
    expect(matchesSearch("aju-999999", "María Ortíz", "Lote 40", "REC-000001")).toBe(false);
  });

  it("shows every resource when the search is empty", () => {
    expect(matchesSearch("   ", "María Ortíz")).toBe(true);
  });
});
