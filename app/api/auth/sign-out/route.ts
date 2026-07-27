import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PORTAL_SESSION_COOKIE } from "@/lib/portal-auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/acceso", request.url), 303);
  response.cookies.set({
    name: PORTAL_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
