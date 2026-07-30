import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getPortalSessionSecret,
  PORTAL_SESSION_COOKIE,
  verifyPortalSession,
} from "@/lib/portal-auth";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAccessPage = pathname === "/acceso";
  const token = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;

  let session = null;
  try {
    session = verifyPortalSession(token, getPortalSessionSecret());
  } catch {
    session = null;
  }

  if (isAccessPage && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isAccessPage && !session) {
    const accessUrl = new URL("/acceso", request.url);
    accessUrl.searchParams.set("siguiente", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(accessUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|opengraph-image|.*\\..*).*)",
  ],
};
