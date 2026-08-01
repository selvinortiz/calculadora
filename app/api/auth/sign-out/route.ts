import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/mutation-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, message: "Solicitud no permitida." }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/acceso", request.url), 303);
}
