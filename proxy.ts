import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasSupabasePublicConfiguration, getSupabasePublicConfiguration } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  const nextResponse = () => {
    const result = NextResponse.next({ request: { headers: requestHeaders } });
    result.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return result;
  };
  const pathname = request.nextUrl.pathname;
  const isAccessPage = pathname === "/acceso";
  const isPasswordPage = pathname === "/cuenta/cambiar-clave";

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

  let authResult = await supabase.auth.getUser();
  if (isTransientAuthError(authResult.error)) authResult = await supabase.auth.getUser();
  const user = authResult.data.user;
  if (!user) {
    if (isAccessPage) return response;
    const accessUrl = new URL("/acceso", request.url);
    accessUrl.searchParams.set("siguiente", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(accessUrl);
  }

  if (isAccessPage && request.nextUrl.searchParams.get("no_disponible") === "1") return response;

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("active")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle(),
  ]);
  if (profileResult.error || membershipResult.error) {
    const unavailableUrl = new URL("/acceso", request.url);
    unavailableUrl.searchParams.set("no_disponible", "1");
    return NextResponse.redirect(unavailableUrl);
  }

  const profile = profileResult.data;
  const membership = membershipResult.data;
  if (!profile || !membership) {
    await supabase.auth.signOut();
    if (isAccessPage) return response;
    return redirectWithCookies(new URL("/acceso", request.url), response);
  }
  const mustChangePassword = profile?.must_change_password !== false;

  if (mustChangePassword && !isPasswordPage) {
    return NextResponse.redirect(new URL("/cuenta/cambiar-clave", request.url));
  }
  if (!mustChangePassword && isAccessPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

function isTransientAuthError(error: { status?: number } | null) {
  return Boolean(error && (error.status === 0 || (error.status !== undefined && error.status >= 500)));
}

function redirectWithCookies(url: URL, source: NextResponse) {
  const redirect = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
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
