"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfiguration } from "./config";
import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const { url, publishableKey } = getSupabasePublicConfiguration();
  browserClient = createBrowserClient<Database>(url, publishableKey);
  return browserClient;
}
