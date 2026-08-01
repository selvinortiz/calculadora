import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./mutation-response";

function request(headers: HeadersInit, url = "http://localhost:3000/api/test") {
  return new Request(url, { method: "POST", headers });
}

describe("isSameOrigin", () => {
  it("accepts the public host when the framework uses an internal URL", () => {
    expect(isSameOrigin(request({
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "sec-fetch-site": "same-origin",
    }))).toBe(true);
  });

  it("accepts a trusted forwarded host and protocol", () => {
    expect(isSameOrigin(request({
      host: "internal:3000",
      origin: "https://calculacuota.com",
      "sec-fetch-site": "same-origin",
      "x-forwarded-host": "calculacuota.com",
      "x-forwarded-proto": "https",
    }))).toBe(true);
  });

  it("rejects cross-site Fetch Metadata even when the origin matches", () => {
    expect(isSameOrigin(request({
      host: "calculacuota.com",
      origin: "http://calculacuota.com",
      "sec-fetch-site": "cross-site",
    }))).toBe(false);
  });

  it("rejects a mismatched origin", () => {
    expect(isSameOrigin(request({
      host: "calculacuota.com",
      origin: "https://attacker.example",
      "sec-fetch-site": "same-origin",
      "x-forwarded-proto": "https",
    }))).toBe(false);
  });

  it("fails closed when both origin and Fetch Metadata are absent", () => {
    expect(isSameOrigin(request({ host: "calculacuota.com" }))).toBe(false);
  });
});
