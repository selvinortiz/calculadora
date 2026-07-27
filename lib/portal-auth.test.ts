import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPortalCodeHash,
  createPortalSession,
  verifyPortalCredentials,
  verifyPortalSession,
} from "./portal-auth";

const SESSION_SECRET = "a-test-session-secret-that-is-longer-than-32-characters";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("portal sessions", () => {
  it("creates, verifies, and expires a signed session", () => {
    const issuedAt = Date.UTC(2026, 6, 27, 12);
    const operator = {
      name: "Ana López",
      email: "ana@prestamos.gt",
      company: "Créditos del Lago",
    };
    const token = createPortalSession(operator, SESSION_SECRET, issuedAt);

    expect(verifyPortalSession(token, SESSION_SECRET, issuedAt + 1_000)).toMatchObject({
      ...operator,
    });
    expect(
      verifyPortalSession(token, SESSION_SECRET, issuedAt + 12 * 60 * 60 * 1_000),
    ).toBeNull();
  });

  it("rejects a modified session", () => {
    const token = createPortalSession(
      {
        name: "Ana López",
        email: "ana@prestamos.gt",
        company: "Créditos del Lago",
      },
      SESSION_SECRET,
    );
    expect(verifyPortalSession(`${token}changed`, SESSION_SECRET)).toBeNull();
  });
});

describe("portal credentials", () => {
  it("matches one of several configured email and code combinations", async () => {
    const anaHash = await createPortalCodeHash("ana-4821", Buffer.alloc(16, 1));
    const juanHash = await createPortalCodeHash("juan-9053", Buffer.alloc(16, 2));
    vi.stubEnv(
      "PORTAL_USERS",
      JSON.stringify([
        {
          name: "Ana López",
          email: "ana@prestamos.gt",
          company: "Créditos del Lago",
          codeHash: anaHash,
        },
        {
          name: "Juan Pérez",
          email: "juan@terrenos.gt",
          company: "Terrenos del Sur",
          codeHash: juanHash,
        },
      ]),
    );

    await expect(
      verifyPortalCredentials(" ANA@PRESTAMOS.GT ", "ana-4821"),
    ).resolves.toEqual({
      name: "Ana López",
      email: "ana@prestamos.gt",
      company: "Créditos del Lago",
    });
    await expect(
      verifyPortalCredentials("juan@terrenos.gt", "incorrecto"),
    ).resolves.toBeNull();
    await expect(
      verifyPortalCredentials("desconocido@prestamos.gt", "ana-4821"),
    ).resolves.toBeNull();
  });

  it("fails closed when production operators are not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PORTAL_USERS", "");

    await expect(
      verifyPortalCredentials("demo@creditos.local", "1234"),
    ).rejects.toThrow(
      "PORTAL_USERS is required in production",
    );
  });
});
