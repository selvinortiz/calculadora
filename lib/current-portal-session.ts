import { createSupabaseServerClient } from "./supabase/server";
import type { OrganizationRole } from "./domain";
import { cache } from "react";

export type PortalSession = {
  userId: string;
  organizationId: string;
  name: string;
  email: string;
  company: string;
  defaultRecipient: string;
  role: OrganizationRole;
  mustChangePassword: boolean;
};

type MembershipSnapshot = Omit<PortalSession, "email" | "userId">;
const SESSION_CACHE_FRESH_MS = 15_000;
const SESSION_CACHE_STALE_MS = 60_000;
const portalSessionCache = new Map<string, { freshUntil: number; staleUntil: number; value: MembershipSnapshot }>();

export function clearPortalSessionCache(userId?: string) {
  if (userId) portalSessionCache.delete(userId);
  else portalSessionCache.clear();
}

export const getCurrentPortalSession = cache(async function getCurrentPortalSession(): Promise<PortalSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: claimsResult, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsResult?.claims?.sub === "string" ? claimsResult.claims.sub : "";
  const email = typeof claimsResult?.claims?.email === "string" ? claimsResult.claims.email : "";
  if (claimsError || !userId || !email) return null;
  const now = Date.now();
  const cached = portalSessionCache.get(userId);
  if (cached && cached.freshUntil > now) return { userId, email, ...cached.value };

  const loadMembership = () => supabase
    .from("organization_members")
    .select("organization_id,role,active,profile:profiles!organization_members_user_id_fkey(display_name,must_change_password),organization:organizations!organization_members_organization_id_fkey(name,default_recipient)")
    .eq("user_id", userId)
    .eq("active", true)
    .abortSignal(AbortSignal.timeout(5_000))
    .maybeSingle();
  let membershipResult = await loadMembership();
  if (membershipResult.error) membershipResult = await loadMembership();
  const { data: membership, error: membershipError } = membershipResult;
  if (membershipError) {
    if (cached && cached.staleUntil > now) return { userId, email, ...cached.value };
    throw new Error("portal_session_unavailable");
  }
  if (!membership || !membership.active || !membership.profile || !membership.organization) {
    portalSessionCache.delete(userId);
    return null;
  }

  const value: MembershipSnapshot = {
    organizationId: membership.organization_id,
    name: membership.profile.display_name,
    company: membership.organization.name,
    defaultRecipient: membership.organization.default_recipient,
    role: membership.role as OrganizationRole,
    mustChangePassword: membership.profile.must_change_password,
  };
  portalSessionCache.set(userId, {
    freshUntil: now + SESSION_CACHE_FRESH_MS,
    staleUntil: now + SESSION_CACHE_STALE_MS,
    value,
  });
  return { userId, email, ...value };
});

export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getCurrentPortalSession();
  if (!session) throw new Error("unauthorized");
  return session;
}
