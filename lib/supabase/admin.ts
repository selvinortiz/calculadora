import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfiguration, hasSupabaseAdminConfiguration } from "./config";
import type { Database } from "../database.types";

export function createSupabaseAdminClient() {
  if (!hasSupabaseAdminConfiguration()) return null;
  const { url } = getSupabasePublicConfiguration();

  return createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
