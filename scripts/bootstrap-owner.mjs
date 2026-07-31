import { createClient } from "@supabase/supabase-js";

const options = parseArguments(process.argv.slice(2));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) fail("Define NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
for (const key of ["email", "password", "name", "organization"]) {
  if (!options[key]) fail(`Missing --${key}.`);
}
if (options.password.length < 12 || !/[A-Za-z]/.test(options.password) || !/\d/.test(options.password)) {
  fail("The owner password must contain at least 12 characters, including letters and numbers.");
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existingOrganizations, error: organizationCheckError } = await supabase.from("organizations").select("id").limit(1);
if (organizationCheckError) fail(`Cannot read organizations: ${organizationCheckError.message}`);
if (existingOrganizations.length > 0) fail("An organization already exists. Bootstrap is intentionally one-time.");

const { data: userResult, error: userError } = await supabase.auth.admin.createUser({
  email: options.email.toLowerCase(),
  password: options.password,
  email_confirm: true,
  user_metadata: { display_name: options.name },
});
if (userError || !userResult.user) fail(`Cannot create owner: ${userError?.message || "unknown error"}`);

const userId = userResult.user.id;
const { data: organization, error: createOrganizationError } = await supabase
  .from("organizations")
  .insert({ name: options.organization, default_recipient: options.name })
  .select("id")
  .single();
if (createOrganizationError || !organization) await rollback(userId, `Cannot create organization: ${createOrganizationError?.message}`);

const { error: profileError } = await supabase.from("profiles").insert({ id: userId, display_name: options.name, must_change_password: false });
if (profileError) await rollback(userId, organization.id, `Cannot create owner profile: ${profileError.message}`);
const { error: memberError } = await supabase.from("organization_members").insert({ organization_id: organization.id, user_id: userId, role: "owner", active: true });
if (memberError) await rollback(userId, organization.id, `Cannot create owner membership: ${memberError.message}`);
const { error: countersError } = await supabase.from("document_counters").insert([
  { organization_id: organization.id, kind: "financing", prefix: "FIN", next_value: 1 },
  { organization_id: organization.id, kind: "receipt", prefix: "REC", next_value: 1 },
  { organization_id: organization.id, kind: "adjustment", prefix: "AJU", next_value: 1 },
]);
if (countersError) await rollback(userId, organization.id, `Cannot create document counters: ${countersError.message}`);

process.stdout.write(`Owner created for organization ${organization.id}.\n`);

async function rollback(userIdToDelete, organizationIdToDelete, message) {
  await supabase.from("document_counters").delete().eq("organization_id", organizationIdToDelete);
  await supabase.from("organization_members").delete().eq("organization_id", organizationIdToDelete);
  await supabase.from("profiles").delete().eq("id", userIdToDelete);
  await supabase.from("organizations").delete().eq("id", organizationIdToDelete);
  await supabase.auth.admin.deleteUser(userIdToDelete);
  fail(`${message}. Bootstrap rows were rolled back.`);
}
function parseArguments(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index]?.replace(/^--/, "");
    const value = values[index + 1];
    if (name && value) parsed[name] = value;
  }
  return parsed;
}
function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
