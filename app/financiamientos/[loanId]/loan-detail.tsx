"use client";

import { useState, type FormEvent } from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import {
  PostedDocumentBundle,
  type PostedSnapshotDocument,
} from "../../../components/posted-document-bundle";
import type { OrganizationRole } from "@/lib/domain";
import { PAYMENT_METHODS } from "../../../lib/payment-methods";
import { printElement } from "../../../lib/print-preview";
import styles from "./page.module.css";

type Installment = { paymentNumber: number; dueDate: string; principal: number; interest: number; payment: number; remainingPrincipal: number };
type Transaction = { id: string; type: string; status: string; effectiveDate: string; documentNumber: string; createdAt: string; voidedAt: string | null; voidReason: string | null; replacesTransactionId: string | null; documents: PostedSnapshotDocument[] };
type Loan = { id: string; accountReference: string; price: number; downPayment: number; originalPrincipal: number; annualRate: number; termMonths: number; firstDueDate: string; status: string; version: number; customer: { name?: string; phone?: string; email?: string }; schedule: null | { versionNumber: number; reason: string; calculationVersion: string; principal: number; futureInterest: number; remainingMonths: number; regularPayment: number; finalPayment: number; firstPaymentNumber: number; firstDueDate: string }; installments: Installment[]; transactions: Transaction[] };
const CURRENT_PLAN_KEY = "current-plan";

export function LoanDetail({ loan, role }: { loan: Loan; role: OrganizationRole }) {
  const hasExtendedHistory = loan.transactions.length > 1;
  const historySectionKeys = loan.transactions.filter((transaction) => transaction.documents.length > 0).map((transaction) => transaction.id);
  const currentAdjustment = latestAdjustmentStatus(loan.transactions);
  const [printing, setPrinting] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pendingVoid, setPendingVoid] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => hasExtendedHistory ? new Set() : new Set([CURRENT_PLAN_KEY, ...historySectionKeys]));
  const allHistoryExpanded = historySectionKeys.length > 0 && historySectionKeys.every((key) => expandedSections.has(key));
  function sectionIsOpen(key: string) { return expandedSections.has(key); }
  function toggleSection(key: string) {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function toggleAllSections() {
    setExpandedSections((current) => {
      const next = new Set(current);
      historySectionKeys.forEach((key) => { if (allHistoryExpanded) next.delete(key); else next.add(key); });
      return next;
    });
  }
  function printDocument(transactionId: string) {
    setExpandedSections((current) => new Set(current).add(transactionId));
    setPrinting(transactionId);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-posted-document="${transactionId}"]`);
      if (target) void printElement(target, "Documento del financiamiento");
      else setMessage("No fue posible preparar el documento.");
    }));
  }
  function requestVoid(transaction: Transaction) {
    setMessage("");
    setVoidReason("");
    setPendingVoid(transaction);
  }
  function closeVoidDialog() {
    if (voiding) return;
    setPendingVoid(null);
    setVoidReason("");
  }
  async function voidTransaction() {
    if (!pendingVoid || !voidReason.trim()) return;
    setVoiding(true);
    const response = await fetch(`/api/transactions/${pendingVoid.id}/void`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: voidReason.trim() }) });
    const result = await response.json() as { message?: string };
    if (!response.ok) {
      setMessage(result.message || "No fue posible anular el registro.");
      setVoiding(false);
      return;
    }
    window.location.reload();
  }
  function requestEdit(transaction: Transaction) {
    setMessage("");
    setEditError("");
    setEditingTransaction(transaction);
  }
  function closeEditDialog() {
    if (savingEdit) return;
    setEditingTransaction(null);
    setEditError("");
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTransaction) return;
    setSavingEdit(true);
    setEditError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(`/api/transactions/${editingTransaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, type: editingTransaction.type, expectedLoanVersion: loan.version }),
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) {
      setEditError(result.message || "No fue posible guardar los cambios.");
      setSavingEdit(false);
      return;
    }
    window.location.reload();
  }
  return <>
    <header className="pageHeader">
      <p className="pageEyebrow">Financiamiento</p>
      <h1 className="pageTitle">{loan.customer.name} · {loan.accountReference}</h1>
      <p className="pageIntro">{loan.status === "active" ? "Activo" : "Anulado"}</p>
    </header>
    {message && <p className={styles.alert} role="alert">{message}</p>}
    <div className={styles.overviewGrid}>
      <section className={styles.summary}>
        <div className={styles.cardTitle}><h2>Condiciones originales</h2><span>Origen</span></div>
        <dl><Item label="Precio" value={money(loan.price)} /><Item label="Enganche" value={money(loan.downPayment)} /><Item label="Capital original" value={money(loan.originalPrincipal)} /><Item label="Tasa anual" value={rate(loan.annualRate)} /><Item label="Plazo" value={`${loan.termMonths} meses`} /><Item label="Primera cuota" value={date(loan.firstDueDate)} /></dl>
      </section>
      {loan.schedule && <section className={styles.summary}>
        <div className={styles.cardTitle}><h2>Plan vigente</h2><span>Estado actual</span></div>
        <div className={styles.currentMetrics}>
          <CurrentMetric label="Capital del plan" value={money(loan.schedule.principal)} />
          <CurrentMetric label="Interés programado" value={money(loan.schedule.futureInterest)} />
          <CurrentMetric label={currentAdjustment ? "Próxima cuota" : "Cuotas restantes"} value={currentAdjustment ? currentAdjustment.nextPaymentNumber : String(loan.schedule.remainingMonths)} />
          <CurrentMetric label="Cuota regular" value={money(loan.schedule.regularPayment)} />
          <div className={styles.scheduleAction}>
            <button className={styles.disclosureButton} type="button" aria-expanded={sectionIsOpen(CURRENT_PLAN_KEY)} aria-controls="current-plan-detail" onClick={() => toggleSection(CURRENT_PLAN_KEY)}>
              <span>{sectionIsOpen(CURRENT_PLAN_KEY) ? "Ocultar cuotas" : "Ver cuotas"}</span><ChevronDownIcon className={styles.chevronIcon} aria-hidden="true" />
            </button>
          </div>
        </div>
        {currentAdjustment && <div className={styles.adjustmentStatus}>
          <AdjustmentsHorizontalIcon aria-hidden="true" />
          <div><span>Último ajuste</span><strong>Cuota {currentAdjustment.paymentNumber} registrada</strong><p>Cuota {currentAdjustment.nextPaymentNumber}: recibir {currentAdjustment.adjustedNextPayment} · Crédito {currentAdjustment.creditBalance}</p></div>
        </div>}
      </section>}
    </div>
    {loan.schedule && sectionIsOpen(CURRENT_PLAN_KEY) && <section className={styles.expandedPlan} id="current-plan-detail">
      <div className={styles.expandedPlanHeading}><div><p>Plan vigente</p><h2>Calendario de cuotas</h2></div><span>{loan.schedule.remainingMonths} cuotas</span></div>
      <Schedule rows={loan.installments} />
    </section>}
    <section className={styles.timeline}>
      <div className={styles.timelineHeading}>
        <div className={styles.sectionHeading}>
          <p>Recorrido</p>
          <h2>Historia del financiamiento</h2>
          <span>Origen y cambios registrados, en orden.</span>
        </div>
        {historySectionKeys.length > 0 && <button className={styles.expandAllButton} type="button" onClick={toggleAllSections}>{allHistoryExpanded ? <ArrowsPointingInIcon aria-hidden="true" /> : <ArrowsPointingOutIcon aria-hidden="true" />}<span>{allHistoryExpanded ? "Contraer todo" : "Mostrar todo"}</span></button>}
      </div>
      <div className={styles.timelineList}>
      {loan.transactions.map((transaction, index) => <article className={styles.transaction} data-print-transaction={printing === transaction.id ? "true" : undefined} key={transaction.id}>
        <header className={styles.transactionHeader}>
          <div className={styles.transactionMain}>
            <span className={styles.timelineStep} aria-hidden="true">{index + 1}</span>
            <div className={styles.transactionIdentity}>
              <div><strong>{label(transaction.type)}</strong><span>{transaction.documentNumber}</span></div>
              <p>{transactionOverview(transaction)}</p>
              <span>{date(transaction.effectiveDate)} · {transaction.status === "posted" ? "Registrado" : "Anulado"}</span>
            </div>
          </div>
          <div className={styles.transactionActions}>
            {transaction.documents.length > 0 && <button className={styles.disclosureButton} type="button" aria-expanded={sectionIsOpen(transaction.id)} aria-controls={`transaction-${transaction.id}`} onClick={() => toggleSection(transaction.id)}><span>{sectionIsOpen(transaction.id) ? "Ocultar detalle" : "Ver detalle"}</span><ChevronDownIcon className={styles.chevronIcon} aria-hidden="true" /></button>}
            {role === "owner" && transaction.status === "posted" && <button className={styles.secondaryButton} type="button" onClick={() => requestEdit(transaction)}><PencilSquareIcon aria-hidden="true" /><span>Editar</span></button>}
            {transaction.documents.length > 0 && <button className={styles.secondaryButton} type="button" onClick={() => printDocument(transaction.id)}><PrinterIcon aria-hidden="true" /><span>Reimprimir</span></button>}
            {role === "owner" && transaction.status === "posted" && <button className={styles.dangerButton} type="button" onClick={() => requestVoid(transaction)}><NoSymbolIcon aria-hidden="true" /><span>Anular</span></button>}
            {role === "owner" && transaction.status === "voided" && !loan.transactions.some((candidate) => candidate.replacesTransactionId === transaction.id) && <a className={styles.replacementLink} href={`${replacementPath(transaction.type)}?reemplaza=${transaction.id}`}><ArrowPathIcon aria-hidden="true" /><span>Reemplazar</span></a>}
          </div>
        </header>
        {transaction.voidReason && <p className={styles.voidReason}>Motivo: {transaction.voidReason}</p>}
        {sectionIsOpen(transaction.id) && <div className={styles.transactionDetail} id={`transaction-${transaction.id}`}>{transaction.documents.map((document) => <PostedDocumentBundle key={document.kind} document={document} active={printing === transaction.id} documentNumber={transaction.documentNumber} loan={loan} printKey={transaction.id} />)}</div>}
      </article>)}
      </div>
    </section>
    {pendingVoid && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeVoidDialog(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="void-dialog-title">
        <p className={styles.dialogEyebrow}>Anular movimiento</p>
        <h2 id="void-dialog-title">{pendingVoid.documentNumber}</h2>
        <p>Indica por qué se anula este movimiento.</p>
        <label htmlFor="void-reason">Motivo</label>
        <textarea id="void-reason" rows={4} maxLength={500} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} autoFocus />
        <div className={styles.dialogActions}>
          <button type="button" onClick={closeVoidDialog} disabled={voiding}>Cancelar</button>
          <button className={styles.confirmDangerButton} type="button" onClick={voidTransaction} disabled={voiding || !voidReason.trim()}>{voiding ? "Anulando…" : "Anular movimiento"}</button>
        </div>
      </section>
    </div>}
    {editingTransaction && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeEditDialog(); }}>
      <EditDialog transaction={editingTransaction} loan={loan} error={editError} saving={savingEdit} onCancel={closeEditDialog} onSubmit={saveEdit} />
    </div>}
  </>;
}

function EditDialog({ transaction, loan, error, saving, onCancel, onSubmit }: { transaction: Transaction; loan: Loan; error: string; saving: boolean; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const snapshot = asRecord(transaction.documents[0]?.snapshot);
  const payload = asRecord(snapshot.payload);
  const details = asRecord(payload.details);
  const adjustment = asRecord(payload.adjustment);
  return <section className={`${styles.dialog} ${styles.editDialog}`} role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title">
    <p className={styles.editEyebrow}>Editar registro</p>
    <h2 id="edit-dialog-title">{transaction.documentNumber}</h2>
    <p>Corrige el registro y su documento sin cambiar el número.</p>
    <form className={styles.editForm} onSubmit={onSubmit}>
      <div className={styles.editGrid}>
        {transaction.type === "loan_origination" && <>
          <EditField label="Referencia" name="accountReference" defaultValue={loan.accountReference} required autoFocus />
          <EditField label="Fecha del financiamiento" name="issueDate" type="date" defaultValue={transaction.effectiveDate} required />
          <EditField label="Precio" name="price" type="number" step="0.01" min="0.01" defaultValue={loan.price} required />
          <EditField label="Enganche" name="downPayment" type="number" step="0.01" min="0" defaultValue={loan.downPayment} required />
          <EditField label="Tasa anual" name="annualRate" type="number" step="0.000001" min="0" max="100" defaultValue={loan.annualRate} required />
          <EditField label="Plazo en meses" name="termMonths" type="number" step="1" min="2" max="360" defaultValue={loan.termMonths} required />
          <EditField label="Primera cuota" name="firstDueDate" type="date" defaultValue={loan.firstDueDate} required />
        </>}
        {transaction.type === "capital_payment" && <>
          <EditSelect label="Modalidad" name="transactionMode" defaultValue={stringValue(details.transactionMode) || "standalone"} options={[{ value: "standalone", label: "Solo abono" }, { value: "combined", label: "Cuota y abono" }]} />
          <EditField label="Cuota aplicada" name="paymentNumber" type="number" step="1" min="1" defaultValue={numberValue(details.paymentNumber)} required autoFocus />
          <EditField label="Fecha del abono" name="transactionDate" type="date" defaultValue={dateValue(details.transactionDate) || transaction.effectiveDate} required />
          <EditField label="Último pago" name="lastPaymentDate" type="date" defaultValue={dateValue(details.lastPaymentDate)} />
          <EditField label="Próxima cuota" name="nextPaymentDate" type="date" defaultValue={dateValue(details.nextPaymentDate)} required />
          <EditField label="Abono a capital" name="capitalPayment" type="number" step="0.01" min="0.01" defaultValue={numberValue(details.capitalPayment)} required />
          <EditSelect label="Origen del saldo" name="balanceSource" defaultValue={stringValue(details.balanceSource) || "calculated"} options={[{ value: "calculated", label: "Calculado" }, { value: "statement", label: "Estado de cuenta" }]} />
          <EditField label="Capital pendiente" name="statementCapital" type="number" step="0.01" min="0" defaultValue={numberValue(details.currentCapital)} required />
          <EditSelect label="Medio de pago" name="paymentMethod" defaultValue={stringValue(details.paymentMethod)} options={paymentMethodOptions(stringValue(details.paymentMethod))} />
          <EditField label="Referencia del pago" name="paymentReference" defaultValue={stringValue(details.paymentReference)} />
          <EditField label="Recibido por" name="receivedBy" defaultValue={stringValue(details.receivedBy)} />
          <EditTextArea label="Notas" name="notes" defaultValue={stringValue(details.notes)} />
        </>}
        {transaction.type === "payment_adjustment" && <>
          <EditField label="Cuota ajustada" name="paymentNumber" type="number" step="1" min="1" defaultValue={numberValue(adjustment.paymentNumber)} required autoFocus />
          <EditField label="Fecha del pago" name="paymentDate" type="date" defaultValue={dateValue(payload.paymentDate) || transaction.effectiveDate} required />
          <EditField label="Próxima cuota" name="nextPaymentDate" type="date" defaultValue={dateValue(payload.nextPaymentDate)} required />
          <EditField label="Pago recibido" name="receivedPayment" type="number" step="0.01" min="0.01" defaultValue={numberValue(adjustment.receivedPayment)} required />
          <EditField label="Referencia del pago" name="paymentReference" defaultValue={stringValue(payload.paymentReference)} />
          <EditField label="Ajustado por" name="adjustedBy" defaultValue={stringValue(payload.adjustedBy)} />
          <EditTextArea label="Notas" name="notes" defaultValue={stringValue(payload.notes)} />
        </>}
      </div>
      {error && <p className={styles.editError} role="alert">{error}</p>}
      <div className={styles.dialogActions}>
        <button type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button className={styles.saveButton} type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </form>
  </section>;
}

function EditField({ label, name, defaultValue, ...props }: { label: string; name: string; defaultValue: string | number; type?: string; step?: string; min?: string; max?: string; required?: boolean; autoFocus?: boolean }) {
  return <label className={styles.editField}><span>{label}</span><input name={name} defaultValue={defaultValue} {...props} /></label>;
}

function EditSelect({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: Array<{ value: string; label: string }> }) {
  return <label className={styles.editField}><span>{label}</span><select name={name} defaultValue={defaultValue}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function EditTextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return <label className={`${styles.editField} ${styles.fullEditField}`}><span>{label}</span><textarea name={name} rows={3} maxLength={1000} defaultValue={defaultValue} /></label>;
}

function Schedule({ rows }: { rows: Installment[] }) { return <div className={styles.table}><table><thead><tr><th>Cuota</th><th>Vence</th><th>Capital</th><th>Interés</th><th>Total</th><th>Capital pendiente</th></tr></thead><tbody>{rows.map((row) => <tr key={row.paymentNumber}><td>{row.paymentNumber}</td><td>{date(row.dueDate)}</td><td>{money(row.principal)}</td><td>{money(row.interest)}</td><td>{money(row.payment)}</td><td>{money(row.remainingPrincipal)}</td></tr>)}</tbody></table></div>; }
function Item({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function CurrentMetric({ label, value }: { label: string; value: string }) { return <div className={styles.currentMetric}><span>{label}</span><strong>{value}</strong></div>; }
function money(value: number) { return new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(value); }
function rate(value: unknown) { const number = Number(value); return Number.isFinite(number) ? `${new Intl.NumberFormat("es-GT", { maximumFractionDigits: 6 }).format(number)}%` : "—"; }
function date(value: string) { if (!value) return "—"; return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)); }
function label(type: string) { return ({ loan_origination: "Financiamiento", capital_payment: "Abono a capital", payment_adjustment: "Ajuste" } as Record<string, string>)[type] || type; }
function transactionOverview(transaction: Transaction) {
  const snapshot = asRecord(transaction.documents[0]?.snapshot);
  const payload = asRecord(snapshot.payload);
  if (transaction.type === "loan_origination") return `Capital ${moneyValue(payload.principal)} · ${String(payload.termMonths || "—")} cuotas`;
  if (transaction.type === "capital_payment") {
    const details = asRecord(payload.details);
    const revisedSchedule = Array.isArray(payload.revisedSchedule) ? payload.revisedSchedule : [];
    const installmentCount = revisedSchedule.length;
    return `Abono ${moneyValue(details.capitalPayment)} · Nuevo plan de ${installmentCount || "—"} ${installmentCount === 1 ? "cuota" : "cuotas"} · Capital ${moneyValue(details.newCapital)}`;
  }
  if (transaction.type === "payment_adjustment") {
    const adjustment = asRecord(payload.adjustment);
    return `Cuota ${String(adjustment.paymentNumber || "—")} · Saldo a favor ${moneyValue(adjustment.creditBalance)} · Próxima cuota ${moneyValue(adjustment.adjustedNextPayment)}`;
  }
  return transaction.documentNumber;
}
function latestAdjustmentStatus(transactions: Transaction[]) {
  const transaction = [...transactions].reverse().find((candidate) => candidate.type === "payment_adjustment" && candidate.status === "posted");
  if (!transaction) return null;
  const snapshot = asRecord(transaction.documents[0]?.snapshot);
  const payload = asRecord(snapshot.payload);
  const adjustment = asRecord(payload.adjustment);
  const paymentNumber = Number(adjustment.paymentNumber);
  return {
    paymentNumber: Number.isFinite(paymentNumber) ? String(paymentNumber) : "—",
    nextPaymentNumber: Number.isFinite(paymentNumber) ? String(paymentNumber + 1) : "—",
    adjustedNextPayment: moneyValue(adjustment.adjustedNextPayment),
    creditBalance: moneyValue(adjustment.creditBalance),
  };
}
function replacementPath(type: string) { return ({ loan_origination: "/financiamiento", capital_payment: "/abono-capital", payment_adjustment: "/ajustes" } as Record<string, string>)[type] || "/"; }
function asRecord(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function moneyValue(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? money(value) : "—"; }
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function numberValue(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function dateValue(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ""; }
function paymentMethodOptions(current: string) {
  const options: string[] = ["", ...PAYMENT_METHODS];
  if (current && !options.includes(current)) options.splice(1, 0, current);
  return options.map((value) => ({ value, label: value || "Seleccionar" }));
}
