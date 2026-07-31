import { createSupabaseServerClient } from "./supabase/server";
import type { OrganizationRole } from "./domain";

export type PortalSession = {
  userId: string;
  organizationId: string;
  name: string;
  email: string;
  company: string;
  role: OrganizationRole;
  mustChangePassword: boolean;
};

export async function getCurrentPortalSession(): Promise<PortalSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  const user = userResult.user;
  if (userError || !user?.email) return null;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,must_change_password")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id,role,active")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (!profile || !membership || !membership.active) return null;
  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", membership.organization_id)
    .maybeSingle();
  if (!organization) return null;

  return {
    userId: user.id,
    organizationId: membership.organization_id,
    name: profile.display_name,
    email: user.email,
    company: organization.name,
    role: membership.role as OrganizationRole,
    mustChangePassword: profile.must_change_password,
  };
}

export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getCurrentPortalSession();
  if (!session) throw new Error("unauthorized");
  return session;
}
