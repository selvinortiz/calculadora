import { scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createCodeHash,
  generateMemorableCode,
  readPortalUsersFromEnv,
  writePortalUsersToEnv,
} from "./hash-portal-code.mjs";

describe("portal access code generator", () => {
  it("creates readable codes with four words", () => {
    const code = generateMemorableCode();

    expect(code).toMatch(/^[a-z]+(?:-[a-z]+){3}$/);
  });

  it("uses cryptographic randomness across generated codes", () => {
    const codes = new Set(
      Array.from({ length: 100 }, () => generateMemorableCode()),
    );

    expect(codes.size).toBe(100);
  });

  it("creates a verifiable scrypt hash", () => {
    const code = "ventana-rayo-violeta-perla";
    const encoded = createCodeHash(code);
    const [, encodedSalt, encodedHash] = encoded.split("$");
    const salt = Buffer.from(encodedSalt, "base64url");
    const expected = Buffer.from(encodedHash, "base64url");

    expect(scryptSync(code, salt, expected.length)).toEqual(expected);
  });

  it("writes dotenv-safe JSON and reads it without escaped dollar signs", () => {
    const users = [
      {
        name: "Ana López",
        company: "Créditos del Lago",
        email: "ana@empresa.gt",
        codeHash: "scrypt$salt$hash",
      },
    ];
    const source = "PORTAL_SESSION_SECRET=example\n";
    const updated = writePortalUsersToEnv(source, users);

    expect(updated).toContain('PORTAL_USERS=[{"name":');
    expect(updated).toContain("scrypt\\$salt\\$hash");
    expect(readPortalUsersFromEnv(updated)).toEqual(users);
  });

  it("replaces a multiline registry while preserving other variables", () => {
    const source = `PORTAL_USERS=[
  {
    "name": "Anterior",
    "company": "Empresa",
    "email": "anterior@empresa.gt",
    "codeHash": "scrypt\\$salt\\$hash"
  }
]
OTRA_VARIABLE=conservar
`;
    const users = [
      {
        name: "Nueva Persona",
        company: "Nueva Empresa",
        email: "nueva@empresa.gt",
        codeHash: "scrypt$new$safe",
      },
    ];
    const updated = writePortalUsersToEnv(source, users);

    expect(readPortalUsersFromEnv(updated)).toEqual(users);
    expect(updated).toContain("OTRA_VARIABLE=conservar");
    expect(updated).not.toContain("anterior@empresa.gt");
  });
});
