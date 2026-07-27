import {
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

export const PORTAL_SESSION_COOKIE = "credit_portal_session";
export const PORTAL_SESSION_SECONDS = 12 * 60 * 60;

const DEVELOPMENT_OPERATOR = {
  name: "Operador Demo",
  email: "demo@creditos.local",
  company: "Empresa Demo",
  code: "1234",
} as const;
const scryptAsync = promisify(scrypt);

export type PortalOperator = {
  name: string;
  email: string;
  company: string;
};

export type PortalSession = PortalOperator & {
  issuedAt: number;
  expiresAt: number;
};

type StoredSession = PortalOperator & {
  iat: number;
  exp: number;
};

type PortalUserConfig = PortalOperator & {
  codeHash: string;
};

export class PortalConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalConfigurationError";
  }
}

export function createPortalSession(
  operator: PortalOperator,
  secret = getPortalSessionSecret(),
  now = Date.now(),
): string {
  const issuedAt = Math.floor(now / 1000);
  const payload: StoredSession = {
    name: operator.name.trim(),
    email: normalizeEmail(operator.email),
    company: operator.company.trim(),
    iat: issuedAt,
    exp: issuedAt + PORTAL_SESSION_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifyPortalSession(
  token: string | undefined,
  secret = getPortalSessionSecret(),
  now = Date.now(),
): PortalSession | null {
  if (!token) return null;

  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) return null;

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<StoredSession>;
    const currentTime = Math.floor(now / 1000);

    if (
      typeof payload.name !== "string" ||
      !payload.name.trim() ||
      payload.name.length > 80 ||
      typeof payload.email !== "string" ||
      !isEmail(payload.email) ||
      typeof payload.company !== "string" ||
      !payload.company.trim() ||
      payload.company.length > 100 ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp) ||
      (payload.iat as number) > currentTime + 300 ||
      (payload.exp as number) <= currentTime
    ) {
      return null;
    }

    return {
      name: payload.name.trim(),
      email: normalizeEmail(payload.email),
      company: payload.company.trim(),
      issuedAt: payload.iat as number,
      expiresAt: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export async function verifyPortalCredentials(
  submittedEmail: string,
  submittedCode: string,
): Promise<PortalOperator | null> {
  const users = getConfiguredPortalUsers();
  const normalizedEmail = normalizeEmail(submittedEmail);

  if (users === null) {
    const emailMatches = safeEqual(
      normalizedEmail,
      normalizeEmail(DEVELOPMENT_OPERATOR.email),
    );
    const codeMatches = safeEqual(submittedCode, DEVELOPMENT_OPERATOR.code);
    return emailMatches && codeMatches
      ? {
          name: DEVELOPMENT_OPERATOR.name,
          email: DEVELOPMENT_OPERATOR.email,
          company: DEVELOPMENT_OPERATOR.company,
        }
      : null;
  }

  const user = users.find(
    (candidate) => normalizeEmail(candidate.email) === normalizedEmail,
  );
  const hashToCheck = user?.codeHash ?? createDummyCodeHash();
  const codeMatches = await verifyPortalCode(submittedCode, hashToCheck);

  return user && codeMatches
    ? { name: user.name, email: user.email, company: user.company }
    : null;
}

export async function createPortalCodeHash(
  code: string,
  salt = randomBytes(16),
): Promise<string> {
  if (code.length < 4 || code.length > 128) {
    throw new RangeError("Access codes must contain between 4 and 128 characters.");
  }

  const derivedKey = (await scryptAsync(code, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export function getPortalSessionSecret(): string {
  const configuredSecret = process.env.PORTAL_SESSION_SECRET?.trim();
  if (configuredSecret && configuredSecret.length >= 32) return configuredSecret;

  if (process.env.NODE_ENV !== "production") {
    return "local-development-session-secret-change-before-deploy";
  }

  throw new PortalConfigurationError(
    "PORTAL_SESSION_SECRET must contain at least 32 characters in production.",
  );
}

function getConfiguredPortalUsers(): PortalUserConfig[] | null {
  const rawUsers = process.env.PORTAL_USERS?.trim();
  if (!rawUsers) {
    if (process.env.NODE_ENV !== "production") return null;
    throw new PortalConfigurationError("PORTAL_USERS is required in production.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawUsers);
  } catch {
    throw new PortalConfigurationError("PORTAL_USERS must be valid JSON.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 100) {
    throw new PortalConfigurationError(
      "PORTAL_USERS must contain between 1 and 100 operators.",
    );
  }

  const users = parsed.map((entry): PortalUserConfig => {
    if (!isRecord(entry)) {
      throw new PortalConfigurationError("Each portal operator must be an object.");
    }

    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const email = typeof entry.email === "string" ? normalizeEmail(entry.email) : "";
    const company = typeof entry.company === "string" ? entry.company.trim() : "";
    const codeHash = typeof entry.codeHash === "string" ? entry.codeHash.trim() : "";
    if (
      !name ||
      name.length > 80 ||
      !isEmail(email) ||
      !company ||
      company.length > 100 ||
      !isPortalCodeHash(codeHash)
    ) {
      throw new PortalConfigurationError(
        "Each portal operator requires a name, email, company, and valid scrypt codeHash.",
      );
    }

    return { name, email, company, codeHash };
  });

  const normalizedEmails = users.map((user) => normalizeEmail(user.email));
  if (new Set(normalizedEmails).size !== normalizedEmails.length) {
    throw new PortalConfigurationError("Portal operator emails must be unique.");
  }

  return users;
}

async function verifyPortalCode(code: string, storedHash: string): Promise<boolean> {
  const [, encodedSalt, encodedHash] = storedHash.split("$");

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedHash = Buffer.from(encodedHash, "base64url");
    const actualHash = (await scryptAsync(code, salt, expectedHash.length)) as Buffer;
    return expectedHash.length > 0 && timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

function createDummyCodeHash(): string {
  return "scrypt$ZHVtbXktc2FsdC1mb3ItdGltaW5n$5pPjLZ9i4MvB6s6WfCGLuNn8W0HeQJwRr2ddrT2Y27OWQPx4gBK3zD9eDc7q10uBrIDYHjtZpQIC3xg0j3j-EA";
}

function isPortalCodeHash(value: string): boolean {
  const [method, salt, hash, extra] = value.split("$");
  if (method !== "scrypt" || !salt || !hash || extra) return false;

  try {
    return (
      Buffer.from(salt, "base64url").length >= 16 &&
      Buffer.from(hash, "base64url").length === 64
    );
  } catch {
    return false;
  }
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeEmail(email: string): string {
  return email.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function isEmail(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
