import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfiguration, hasSupabasePublicConfiguration } from "./config";
import type { Database } from "../database.types";

export async function createSupabaseServerClient() {
  if (!hasSupabasePublicConfiguration()) return null;

  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicConfiguration();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. The proxy performs refreshes.
        }
      },
    },
  });
}
