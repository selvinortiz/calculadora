"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { DirectoryCustomer } from "@/lib/domain";
import { notifyDurableDirectoryChanged, useDurableDirectory } from "@/lib/use-durable-directory";
import styles from "./persistence-directory.module.css";

type View = "organization" | "customers" | "financings";
const EMPTY_CUSTOMER = { id: "", name: "", phone: "", email: "" };

export function PersistenceDirectory({ operatorCompany, operatorName }: { operatorCompany: string; operatorName: string; storageScope?: string }) {
  const { data, error, reload } = useDurableDirectory();
  const [view, setView] = useState<View>("organization");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<DirectoryCustomer | null>(null);
  const [organization, setOrganization] = useState({ name: operatorCompany, defaultRecipient: operatorName, financingPrefix: "FIN", receiptPrefix: "REC", adjustmentPrefix: "AJU" });
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  useEffect(() => {
    const next = data.organization;
    if (!next) return;
    const timeout = window.setTimeout(() => setOrganization({ name: next.name, defaultRecipient: next.defaultRecipient, financingPrefix: next.financingPrefix, receiptPrefix: next.receiptPrefix, adjustmentPrefix: next.adjustmentPrefix }), 0);
    return () => window.clearTimeout(timeout);
  }, [data.organization]);
  const customers = useMemo(() => [...data.customers].sort((a, b) => a.name.localeCompare(b.name, "es-GT")), [data.customers]);

  async function saveOrganization(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    const response = await fetch("/api/directory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: organization.name, defaultRecipient: organization.defaultRecipient, prefixes: { financing: organization.financingPrefix.toUpperCase(), receipt: organization.receiptPrefix.toUpperCase(), adjustment: organization.adjustmentPrefix.toUpperCase() } }) });
    const result = await response.json() as { message?: string };
    setNotice(response.ok ? "Configuración guardada." : result.message || "No fue posible guardar.");
    if (response.ok) { notifyDurableDirectoryChanged(); await reload(); }
    setBusy(false);
  }
  async function saveCustomer(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    const url = customer.id ? `/api/customers/${customer.id}` : "/api/customers";
    const response = await fetch(url, { method: customer.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(customer) });
    const result = await response.json() as { message?: string };
    setNotice(response.ok ? (customer.id ? "Cliente actualizado." : "Cliente guardado.") : result.message || "No fue posible guardar.");
    if (response.ok) { setCustomer(EMPTY_CUSTOMER); notifyDurableDirectoryChanged(); await reload(); }
    setBusy(false);
  }
  async function archiveCustomer(item: DirectoryCustomer) {
    setBusy(true);
    const response = await fetch(`/api/customers/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archive: true }) });
    const result = await response.json() as { message?: string };
    setNotice(response.ok ? "Cliente archivado." : result.message || "No fue posible archivar.");
    if (response.ok) { notifyDurableDirectoryChanged(); await reload(); }
    setBusy(false);
    setArchiveTarget(null);
  }

  return (
    <section className={styles.directory} aria-label="Directorio">
      <div className={styles.tabs} role="tablist" aria-label="Secciones del directorio">
        <Tab active={view === "organization"} label="Organización" count={data.organization ? 1 : 0} onClick={() => setView("organization")} />
        <Tab active={view === "customers"} label="Clientes" count={data.customers.length} onClick={() => setView("customers")} />
        <Tab active={view === "financings"} label="Financiamientos" count={data.loans.length} onClick={() => setView("financings")} />
      </div>
      {(notice || error) && <p className={styles.notice} role="status">{notice || error}</p>}

      {view === "organization" && (
        <div className={styles.twoColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeading}>
              <p>Configuración</p>
              <h2>Datos y numeración</h2>
              <span>Los prefijos se aplican a documentos nuevos.</span>
            </div>
            <form className={styles.form} onSubmit={saveOrganization}>
              <Field id="organization-name" label="Organización" value={organization.name} onChange={(name) => setOrganization((current) => ({ ...current, name }))} />
              <Field id="default-recipient" label="Recibido por" value={organization.defaultRecipient} onChange={(defaultRecipient) => setOrganization((current) => ({ ...current, defaultRecipient }))} />
              <Field id="financing-prefix" label="Prefijo de financiamientos" value={organization.financingPrefix} onChange={(financingPrefix) => setOrganization((current) => ({ ...current, financingPrefix }))} />
              <Field id="receipt-prefix" label="Prefijo de recibos" value={organization.receiptPrefix} onChange={(receiptPrefix) => setOrganization((current) => ({ ...current, receiptPrefix }))} />
              <Field id="adjustment-prefix" label="Prefijo de ajustes" value={organization.adjustmentPrefix} onChange={(adjustmentPrefix) => setOrganization((current) => ({ ...current, adjustmentPrefix }))} />
              <div className={styles.formActions}>
                <button type="submit" disabled={busy || data.role !== "owner"}>Guardar configuración</button>
              </div>
            </form>
          </section>
          <aside className={styles.previewCard}>
            <p>Próximos números</p>
            <dl>
              <div><dt>Financiamiento</dt><dd>{organization.financingPrefix}-000001</dd></div>
              <div><dt>Recibo</dt><dd>{organization.receiptPrefix}-000001</dd></div>
              <div><dt>Ajuste</dt><dd>{organization.adjustmentPrefix}-000001</dd></div>
            </dl>
          </aside>
        </div>
      )}

      {view === "customers" && (
        <div className={styles.twoColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeading}>
              <p>Clientes</p>
              <h2>{customer.id ? "Actualizar cliente" : "Agregar cliente"}</h2>
            </div>
            <form className={styles.form} onSubmit={saveCustomer}>
              <Field id="customer-name" label="Nombre completo" value={customer.name} onChange={(name) => setCustomer((current) => ({ ...current, name }))} />
              <Field id="customer-phone" label="Teléfono" value={customer.phone} onChange={(phone) => setCustomer((current) => ({ ...current, phone }))} />
              <Field id="customer-email" type="email" label="Correo" value={customer.email} onChange={(email) => setCustomer((current) => ({ ...current, email }))} />
              <div className={styles.formActions}>
                {customer.id && <button type="button" onClick={() => setCustomer(EMPTY_CUSTOMER)}>Cancelar</button>}
                <button type="submit" disabled={busy}>Guardar cliente</button>
              </div>
            </form>
          </section>
          <section className={styles.listCard}>
            <h2>Clientes · {customers.length}</h2>
            {customers.length === 0 ? <p className={styles.emptyList}>No hay clientes.</p> : (
              <ul className={styles.profileList}>
                {customers.map((item) => (
                  <li className={styles.profileRow} key={item.id}>
                    <div><strong>{item.name}</strong><span>{item.phone || item.email || "Sin contacto"}</span></div>
                    <div className={styles.rowActions}>
                      <button type="button" disabled={busy} onClick={() => setCustomer({ id: item.id, name: item.name, phone: item.phone, email: item.email })}>Editar</button>
                      <button type="button" disabled={busy} onClick={() => setArchiveTarget(item)}>Archivar</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {view === "financings" && (
        <section className={styles.listCard}>
          <h2>Financiamientos · {data.loans.length}</h2>
          {data.loans.length === 0 ? <p className={styles.emptyList}>No hay financiamientos. <Link href="/financiamiento">Crear uno</Link>.</p> : (
            <ul className={styles.profileList}>
              {data.loans.map((loan) => (
                <li className={styles.profileRow} key={loan.id}>
                  <div><Link href={`/financiamientos/${loan.id}`}><strong>{loan.displayName}</strong></Link><span>{loan.remainingMonths} cuotas restantes</span></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {archiveTarget && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (!busy && event.currentTarget === event.target) setArchiveTarget(null); }}>
        <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="archive-dialog-title">
          <p className={styles.dialogEyebrow}>Archivar cliente</p>
          <h2 id="archive-dialog-title">{archiveTarget.name}</h2>
          <p>Ya no aparecerá en la lista de clientes disponibles.</p>
          <div className={styles.dialogActions}>
            <button type="button" disabled={busy} onClick={() => setArchiveTarget(null)}>Cancelar</button>
            <button className={styles.archiveButton} type="button" disabled={busy} onClick={() => archiveCustomer(archiveTarget)}>{busy ? "Archivando…" : "Archivar cliente"}</button>
          </div>
        </section>
      </div>}
    </section>
  );
}

function Tab({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) { return <button type="button" role="tab" aria-selected={active} onClick={onClick}><span>{label}</span><small>{count}</small></button>; }
function Field({ id, label, onChange, type = "text", value }: { id: string; label: string; onChange: (value: string) => void; type?: string; value: string }) { return <div className={styles.field}><label htmlFor={id}>{label}</label><input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={id.endsWith("name")} /></div>; }
