import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000001";
const ORGANIZATION_ID = "00000000-1000-4000-8000-000000000001";
const CUSTOMER_ID = "00000000-3000-4000-8000-000000000001";

export default async function globalSetup() {
  const status = spawnSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (status.status !== 0) throw new Error("Local Supabase is required for end-to-end tests.");

  const local = JSON.parse(status.stdout) as Record<string, string>;
  const supabase = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existing, error: lookupError } = await supabase
    .from("loans")
    .select("id")
    .eq("organization_id", ORGANIZATION_ID)
    .eq("account_reference", "LOCAL-E2E")
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return;

  const { error } = await supabase.rpc("server_post_loan", {
    actor_id: ACTOR_ID,
    command: {
      idempotencyKey: "00000000-4000-4000-8000-000000000001",
      organizationId: ORGANIZATION_ID,
      customerId: CUSTOMER_ID,
      accountReference: "LOCAL-E2E",
      priceCents: 250000,
      downPaymentCents: 0,
      principalCents: 250000,
      annualRate: "12.000000",
      termMonths: 3,
      firstDueDate: "2026-08-31",
      issueDate: "2026-08-01",
      schedule: [
        { paymentNumber: 1, dueDate: "2026-08-31", principalCents: 83333, interestCents: 2500, paymentCents: 85833, remainingPrincipalCents: 166667 },
        { paymentNumber: 2, dueDate: "2026-09-30", principalCents: 83333, interestCents: 2500, paymentCents: 85833, remainingPrincipalCents: 83334 },
        { paymentNumber: 3, dueDate: "2026-10-31", principalCents: 83334, interestCents: 2500, paymentCents: 85834, remainingPrincipalCents: 0 },
      ],
      snapshot: {
        version: 1,
        calculationVersion: "simple-interest-v2-cents",
        documentKind: "payment_schedule",
        issuedAt: "2026-08-01T00:00:00.000Z",
        organizationName: "Créditos Local",
        customerName: "Cliente de ejemplo",
        accountReference: "LOCAL-E2E",
        payload: {},
      },
    },
  });
  if (error) throw error;
}
