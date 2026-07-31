import { describe, expect, it } from "vitest";
import { normalizeEmailAddress } from "./email-address";

describe("normalizeEmailAddress", () => {
  it("trims and normalizes a valid address", () => {
    expect(normalizeEmailAddress("  Owner@Example.COM ")).toBe("owner@example.com");
  });

  it("rejects invalid addresses", () => {
    expect(normalizeEmailAddress("owner")).toBeNull();
    expect(normalizeEmailAddress("owner @example.com")).toBeNull();
    expect(normalizeEmailAddress("owner@example")).toBeNull();
    expect(normalizeEmailAddress(null)).toBeNull();
  });

  it("rejects addresses longer than the authentication limit", () => {
    expect(normalizeEmailAddress(`${"a".repeat(245)}@example.com`)).toBeNull();
  });
});
