import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasSupabasePublicConfiguration, getSupabasePublicConfiguration } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAccessPage = pathname === "/acceso";
  const isPasswordPage = pathname === "/cuenta/cambiar-clave";

  if (!hasSupabasePublicConfiguration()) {
    if (isAccessPage) return NextResponse.next();
    const accessUrl = new URL("/acceso", request.url);
    accessUrl.searchParams.set("no_disponible", "1");
    return NextResponse.redirect(accessUrl);
  }

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicConfiguration();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    if (isAccessPage) return response;
    const accessUrl = new URL("/acceso", request.url);
    accessUrl.searchParams.set("siguiente", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(accessUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", user.id)
    .maybeSingle();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!membership) {
    await supabase.auth.signOut();
    return isAccessPage ? response : NextResponse.redirect(new URL("/acceso", request.url));
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

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|opengraph-image|.*\\..*).*)",
  ],
};
