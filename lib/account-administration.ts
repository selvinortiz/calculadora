import "server-only";

import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "./supabase/admin";
import { createSupabaseServerClient } from "./supabase/server";

const WORDS = [
  "Alba", "Bosque", "Cacao", "Dalia", "Faro", "Jade", "Lago", "Maiz",
  "Nube", "Olivo", "Pino", "Quetzal", "Rio", "Sol", "Tierra", "Valle",
] as const;

export function generateTemporaryPassphrase(): string {
  const bytes = randomBytes(2);
  const first = WORDS[bytes[0] % WORDS.length];
  const second = WORDS[bytes[1] % WORDS.length];
  const secret = randomBytes(12).toString("base64url");
  return `${first}-${second}-${secret}`;
}

export async function requireOwnerContext() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return { error: "unavailable" as const };

  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  if (error || !userId) return { error: "unauthorized" as const };
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id,role,active")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (!membership || membership.role !== "owner") return { error: "forbidden" as const };

  return { supabase, admin, user: { id: userId }, organizationId: membership.organization_id };
}
