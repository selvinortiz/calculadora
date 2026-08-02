import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasSupabasePublicConfiguration, getSupabasePublicConfiguration } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-path", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  const nextResponse = () => {
    const result = NextResponse.next({ request: { headers: requestHeaders } });
    result.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return result;
  };
  const pathname = request.nextUrl.pathname;
  const isAccessPage = pathname === "/acceso";

  if (!hasSupabasePublicConfiguration()) {
    if (isAccessPage) return nextResponse();
    const accessUrl = new URL("/acceso", request.url);
    accessUrl.searchParams.set("no_disponible", "1");
    return NextResponse.redirect(accessUrl);
  }

  let response = nextResponse();
  const { url, publishableKey } = getSupabasePublicConfiguration();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = nextResponse();
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh expired tokens when needed. Authorization is handled once in the
  // server-rendered shell, where claims and membership are verified together.
  await supabase.auth.getSession();

  return response;
}

function buildContentSecurityPolicy(nonce: string) {
  const isDevelopment = process.env.NODE_ENV === "development";
  let supabaseOrigin = "";
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) supabaseOrigin = ` ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin}`;
  } catch {
    supabaseOrigin = "";
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${supabaseOrigin}${isDevelopment ? " ws: http: https:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|opengraph-image|.*\\..*).*)",
  ],
};
