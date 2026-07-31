import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { centsToMoney } from "@/lib/domain";

export async function GET() {
  const session = await getCurrentPortalSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return jsonError("El servicio no está disponible.", 503);
  if (!session) return jsonError("Inicia sesión nuevamente.", 401);

  const [organizationResult, countersResult, customersResult, loansResult, schedulesResult] = await Promise.all([
    supabase.from("organizations").select("id,name,default_recipient").eq("id", session.organizationId).single(),
    supabase.from("document_counters").select("kind,prefix").eq("organization_id", session.organizationId),
    supabase.from("customers").select("id,name,phone,email,updated_at").eq("organization_id", session.organizationId).is("archived_at", null).order("name"),
    supabase.from("loans").select("id,customer_id,account_reference,price_cents,down_payment_cents,original_principal_cents,annual_rate,term_months,first_due_date,version,current_schedule_version_id,updated_at").eq("organization_id", session.organizationId).eq("status", "active").order("updated_at", { ascending: false }),
    supabase.from("schedule_versions").select("id,principal_cents,remaining_months,regular_payment_cents,final_payment_cents,first_payment_number,first_due_date").eq("organization_id", session.organizationId).eq("status", "active"),
  ]);
  const error = organizationResult.error || countersResult.error || customersResult.error || loansResult.error || schedulesResult.error;
  if (error || !organizationResult.data) return jsonError("No fue posible cargar el directorio.", 503);

  const customers = (customersResult.data || []).map((customer) => ({
    id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, updatedAt: customer.updated_at,
  }));
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const schedules = new Map((schedulesResult.data || []).map((schedule) => [schedule.id, schedule]));
  const prefixes = new Map((countersResult.data || []).map((counter) => [counter.kind, counter.prefix]));

  return NextResponse.json({
    organization: {
      id: organizationResult.data.id,
      name: organizationResult.data.name,
      defaultRecipient: organizationResult.data.default_recipient,
      financingPrefix: prefixes.get("financing") || "FIN",
      receiptPrefix: prefixes.get("receipt") || "REC",
      adjustmentPrefix: prefixes.get("adjustment") || "AJU",
    },
    role: session.role,
    customers,
    loans: (loansResult.data || []).map((loan) => {
      const schedule = schedules.get(loan.current_schedule_version_id || "");
      const customerName = customerNames.get(loan.customer_id) || "Cliente archivado";
      return {
        id: loan.id,
        customerId: loan.customer_id,
        customerName,
        accountReference: loan.account_reference,
        displayName: `${customerName} · ${loan.account_reference}`,
        price: centsToMoney(loan.price_cents),
        downPayment: centsToMoney(loan.down_payment_cents),
        principal: centsToMoney(loan.original_principal_cents),
        annualRate: Number(loan.annual_rate),
        termMonths: loan.term_months,
        firstDueDate: loan.first_due_date,
        version: loan.version,
        currentScheduleVersionId: loan.current_schedule_version_id || "",
        currentPrincipal: centsToMoney(schedule?.principal_cents ?? loan.original_principal_cents),
        remainingMonths: schedule?.remaining_months ?? loan.term_months,
        currentPayment: centsToMoney(schedule?.regular_payment_cents ?? 0),
        currentFinalPayment: centsToMoney(schedule?.final_payment_cents ?? 0),
        nextPaymentNumber: schedule?.first_payment_number ?? 1,
        nextDueDate: schedule?.first_due_date ?? loan.first_due_date,
        updatedAt: loan.updated_at,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Solicitud no permitida.", 403);
  const session = await getCurrentPortalSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return jsonError("El servicio no está disponible.", 503);
  if (!session) return jsonError("Inicia sesión nuevamente.", 401);
  if (session.role !== "owner") return jsonError("Solo el propietario puede cambiar la configuración.", 403);

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Datos inválidos.", 400); }
  if (!isRecord(body)) return jsonError("Datos inválidos.", 400);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const defaultRecipient = typeof body.defaultRecipient === "string" ? body.defaultRecipient.trim() : "";
  const prefixInput = isRecord(body.prefixes) ? body.prefixes : {};
  if (!name || name.length > 100 || defaultRecipient.length > 80) return jsonError("Revisa los datos de la organización.", 400);
  for (const kind of ["financing", "receipt", "adjustment"] as const) {
    const value = prefixInput[kind];
    if (typeof value !== "string" || !/^[A-Z0-9]{1,12}$/.test(value)) return jsonError("Los prefijos usan de 1 a 12 letras mayúsculas o números.", 400);
  }
  const prefixes = {
    financing: prefixInput.financing as string,
    receipt: prefixInput.receipt as string,
    adjustment: prefixInput.adjustment as string,
  };

  const { error: organizationError } = await supabase.from("organizations").update({ name, default_recipient: defaultRecipient, updated_at: new Date().toISOString() }).eq("id", session.organizationId);
  if (organizationError) return jsonError("No fue posible guardar la organización.", 503);
  for (const kind of ["financing", "receipt", "adjustment"] as const) {
    const { error } = await supabase.from("document_counters").update({ prefix: prefixes[kind], updated_at: new Date().toISOString() }).eq("organization_id", session.organizationId).eq("kind", kind);
    if (error) return jsonError("La organización se guardó, pero un prefijo no pudo actualizarse.", 409);
  }
  await supabase.rpc("record_audit_event", { target_organization_id: session.organizationId, target_action: "settings.updated", target_entity_type: "organization", target_entity_id: session.organizationId, target_details: { prefixes } });
  return NextResponse.json({ ok: true });
}

function jsonError(message: string, status: number) { return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } }); }
function isSameOrigin(request: NextRequest) { const origin = request.headers.get("origin"); return !origin || origin === request.nextUrl.origin; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
