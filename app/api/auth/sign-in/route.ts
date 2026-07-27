import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createPortalSession,
  getPortalSessionSecret,
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_SECONDS,
  PortalConfigurationError,
  verifyPortalCredentials,
} from "@/lib/portal-auth";

type AttemptRecord = {
  count: number;
  resetAt: number;
};

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1_000;
const attempts = new Map<string, AttemptRecord>();

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return jsonError("Solicitud no permitida.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Ingresa tu correo y código de acceso.", 400);
  }

  if (!isRecord(body)) {
    return jsonError("Ingresa tu correo y código de acceso.", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!email || email.length > 254 || code.length < 4 || code.length > 128) {
    return jsonError("Ingresa tu correo y código de acceso.", 400);
  }

  const attemptKey = getAttemptKey(request, email);
  const retryAfter = getRetryAfter(attemptKey);
  if (retryAfter !== null) {
    const response = jsonError(
      "Demasiados intentos. Espera unos minutos antes de volver a intentar.",
      429,
    );
    response.headers.set("Retry-After", String(retryAfter));
    return response;
  }

  try {
    const operator = await verifyPortalCredentials(email, code);
    if (!operator) {
      recordFailedAttempt(attemptKey);
      return jsonError("Correo o código incorrecto.", 401);
    }

    attempts.delete(attemptKey);
    const response = NextResponse.json(
      { ok: true, name: operator.name, company: operator.company },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set({
      name: PORTAL_SESSION_COOKIE,
      value: createPortalSession(operator, getPortalSessionSecret()),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: PORTAL_SESSION_SECONDS,
      path: "/",
      priority: "high",
    });
    return response;
  } catch (error) {
    if (error instanceof PortalConfigurationError) {
      console.error(error.message);
      return jsonError(
        "El portal no está disponible. Solicita ayuda para ingresar.",
        503,
      );
    }
    throw error;
  }
}

function getAttemptKey(request: NextRequest, email: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const client = forwardedFor || request.headers.get("x-real-ip") || "local";
  return `${client}:${email.normalize("NFKC").toLocaleLowerCase("en-US")}`;
}

function getRetryAfter(key: string): number | null {
  cleanupAttempts();
  const attempt = attempts.get(key);
  if (!attempt || attempt.count < MAX_ATTEMPTS) return null;
  return Math.max(1, Math.ceil((attempt.resetAt - Date.now()) / 1_000));
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return;
  }
  current.count += 1;
}

function cleanupAttempts() {
  const now = Date.now();
  for (const [key, attempt] of attempts) {
    if (attempt.resetAt <= now) attempts.delete(key);
  }
  if (attempts.size > 1_000) attempts.clear();
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { ok: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
