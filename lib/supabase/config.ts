export function hasSupabasePublicConfiguration(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

export function getSupabasePublicConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error("Supabase public configuration is unavailable.");
  }

  return { url, publishableKey };
}

export function hasSupabaseAdminConfiguration(): boolean {
  return Boolean(
    hasSupabasePublicConfiguration() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}
