"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { notifyDurableDirectoryChanged } from "@/lib/use-durable-directory";
import styles from "./resource-pages.module.css";

type CustomerFields = { name: string; phone: string; email: string };

export function CustomerForm({ customerId, initial }: { customerId?: string; initial?: CustomerFields }) {
  const router = useRouter();
  const [fields, setFields] = useState<CustomerFields>(initial || { name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(customerId ? `/api/customers/${customerId}` : "/api/customers", {
      method: customerId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const result = await response.json() as { id?: string; message?: string };
    if (!response.ok) {
      setMessage(result.message || "No fue posible guardar el cliente.");
      setSaving(false);
      return;
    }
    notifyDurableDirectoryChanged();
    router.push(`/clientes/${customerId || result.id}`);
    router.refresh();
  }

  async function archive() {
    if (!customerId || saving) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) {
      setMessage(result.message || "No fue posible archivar el cliente.");
      setSaving(false);
      setConfirmingArchive(false);
      return;
    }
    notifyDurableDirectoryChanged();
    router.push("/clientes");
    router.refresh();
  }

  return <>
    <section className={styles.formCard}>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fullField}`}>
            <span>Nombre completo</span>
            <input autoFocus name="name" value={fields.name} maxLength={120} required onChange={(event) => setFields((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>Teléfono</span>
            <input name="phone" value={fields.phone} maxLength={40} inputMode="tel" onChange={(event) => setFields((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>Correo electrónico</span>
            <input name="email" value={fields.email} maxLength={254} type="email" onChange={(event) => setFields((current) => ({ ...current, email: event.target.value }))} />
          </label>
        </div>
        {message && <p className={styles.formNotice} role="alert">{message}</p>}
        <div className={styles.formActions}>
          <Link className={styles.secondaryAction} href={customerId ? `/clientes/${customerId}` : "/clientes"}>Cancelar</Link>
          <button type="submit" disabled={saving}>{saving ? "Guardando…" : customerId ? "Guardar cambios" : "Crear cliente"}</button>
        </div>
      </form>
      {customerId && <div className={styles.dangerZone}>
        <div><strong>Archivar cliente</strong><span>Dejará de aparecer en las listas de selección.</span></div>
        <button className={styles.dangerButton} type="button" disabled={saving} onClick={() => setConfirmingArchive(true)}>Archivar</button>
      </div>}
    </section>
    {confirmingArchive && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !saving) setConfirmingArchive(false); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="archive-customer-title">
        <p className={styles.sectionEyebrow}>Archivar cliente</p>
        <h2 id="archive-customer-title">{fields.name}</h2>
        <p>Sus financiamientos conservarán el historial registrado.</p>
        <div className={styles.formActions}>
          <button type="button" disabled={saving} onClick={() => setConfirmingArchive(false)}>Cancelar</button>
          <button className={styles.dangerButton} type="button" disabled={saving} onClick={archive}>{saving ? "Archivando…" : "Archivar cliente"}</button>
        </div>
      </section>
    </div>}
  </>;
}
