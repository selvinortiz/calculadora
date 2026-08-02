import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clearPortalSessionCache, getCurrentPortalSession } from "@/lib/current-portal-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { centsToMoney } from "@/lib/domain";
import { isSameOrigin } from "@/lib/mutation-response";

export async function GET() {
  const session = await getCurrentPortalSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return jsonError("El servicio no está disponible.", 503);
  if (!session) return jsonError("Inicia sesión nuevamente.", 401);

  const [organizationResult, countersResult, customersResult, loansResult, schedulesResult] = await Promise.all([
    supabase.from("organizations").select("id,name,default_recipient").eq("id", session.organizationId).single(),
    supabase.from("document_counters").select("kind,prefix,next_value").eq("organization_id", session.organizationId),
    supabase.from("customers").select("id,name,phone,email,archived_at,updated_at").eq("organization_id", session.organizationId).order("name"),
    supabase.from("loans").select("id,customer_id,account_reference,price_cents,down_payment_cents,original_principal_cents,annual_rate,term_months,first_due_date,version,current_schedule_version_id,updated_at").eq("organization_id", session.organizationId).eq("status", "active").order("updated_at", { ascending: false }),
    supabase.from("schedule_versions").select("id,principal_cents,remaining_months,regular_payment_cents,final_payment_cents,first_payment_number,first_due_date").eq("organization_id", session.organizationId).eq("status", "active"),
  ]);
  const error = organizationResult.error || countersResult.error || customersResult.error || loansResult.error || schedulesResult.error;
  if (error || !organizationResult.data) return jsonError("No fue posible cargar el directorio.", 503);

  const scheduleIds = (schedulesResult.data || []).map((schedule) => schedule.id);
  type InstallmentRow = { schedule_version_id: string; payment_number: number; due_date: string; payment_cents: number; remaining_principal_cents: number };
  let installmentRows: InstallmentRow[] = [];
  if (scheduleIds.length > 0) {
    const installmentsResult = await supabase.from("installments").select("schedule_version_id,payment_number,due_date,payment_cents,remaining_principal_cents").in("schedule_version_id", scheduleIds).order("payment_number");
    if (installmentsResult.error) return jsonError("No fue posible cargar los planes de pago.", 503);
    installmentRows = installmentsResult.data || [];
  }

  const activeLoanCustomerIds = new Set((loansResult.data || []).map((loan) => loan.customer_id));
  const customers = (customersResult.data || []).filter((customer) => !customer.archived_at || activeLoanCustomerIds.has(customer.id)).map((customer) => ({
    id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, updatedAt: customer.updated_at,
  }));
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const schedules = new Map((schedulesResult.data || []).map((schedule) => [schedule.id, schedule]));
  const installmentsBySchedule = new Map<string, InstallmentRow[]>();
  for (const installment of installmentRows) {
    const current = installmentsBySchedule.get(installment.schedule_version_id) || [];
    current.push(installment);
    installmentsBySchedule.set(installment.schedule_version_id, current);
  }
  const prefixes = new Map((countersResult.data || []).map((counter) => [counter.kind, counter.prefix]));

  return NextResponse.json({
    organization: {
      id: organizationResult.data.id,
      name: organizationResult.data.name,
      defaultRecipient: organizationResult.data.default_recipient,
      financingPrefix: prefixes.get("financing") || "FIN",
      receiptPrefix: prefixes.get("receipt") || "REC",
      adjustmentPrefix: prefixes.get("adjustment") || "AJU",
      nextFinancingNumber: countersResult.data?.find((counter) => counter.kind === "financing")?.next_value ?? 1,
      nextReceiptNumber: countersResult.data?.find((counter) => counter.kind === "receipt")?.next_value ?? 1,
      nextAdjustmentNumber: countersResult.data?.find((counter) => counter.kind === "adjustment")?.next_value ?? 1,
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
        installments: (installmentsBySchedule.get(loan.current_schedule_version_id || "") || []).map((installment) => ({
          paymentNumber: installment.payment_number,
          dueDate: installment.due_date,
          payment: centsToMoney(installment.payment_cents),
          remainingPrincipal: centsToMoney(installment.remaining_principal_cents),
        })),
        updatedAt: loan.updated_at,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Solicitud no permitida.", 403);
  const session = await getCurrentPortalSession();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return jsonError("El servicio no está disponible.", 503);
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
  if (new Set(Object.values(prefixes)).size !== 3) return jsonError("Cada tipo de documento necesita un prefijo distinto.", 400);

  const { error } = await admin.rpc("server_update_organization_settings", {
    actor_id: session.userId,
    target_organization_id: session.organizationId,
    target_name: name,
    target_default_recipient: defaultRecipient,
    target_prefixes: prefixes,
  });
  if (error?.code === "23505") return jsonError("Cada tipo de documento necesita un prefijo distinto.", 409);
  if (error) return jsonError("No fue posible guardar la configuración.", 503);
  clearPortalSessionCache();
  return NextResponse.json({ ok: true });
}

function jsonError(message: string, status: number) { return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } }); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
