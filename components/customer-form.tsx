"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { notifyDurableDirectoryChanged } from "@/lib/use-durable-directory";
import { ModalDialog } from "./modal-dialog";
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
    try {
      const response = await fetch(customerId ? `/api/customers/${customerId}` : "/api/customers", {
        method: customerId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const result = await response.json() as { id?: string; message?: string };
      if (!response.ok) {
        setMessage(result.message || "No fue posible guardar el cliente.");
        return;
      }
      notifyDurableDirectoryChanged();
      router.push(`/clientes/${customerId || result.id}`);
      router.refresh();
    } catch {
      setMessage("No fue posible guardar el cliente. Revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!customerId || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: true }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) {
        setMessage(result.message || "No fue posible archivar el cliente.");
        setConfirmingArchive(false);
        return;
      }
      notifyDurableDirectoryChanged();
      router.push("/clientes");
      router.refresh();
    } catch {
      setMessage("No fue posible archivar el cliente. Revisa tu conexión.");
      setConfirmingArchive(false);
    } finally {
      setSaving(false);
    }
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
    {confirmingArchive && <ModalDialog backdropClassName={styles.dialogBackdrop} dialogClassName={styles.dialog} labelledBy="archive-customer-title" busy={saving} onClose={() => setConfirmingArchive(false)}>
        <p className={styles.sectionEyebrow}>Archivar cliente</p>
        <h2 id="archive-customer-title">{fields.name}</h2>
        <p>Solo se puede archivar cuando no tiene financiamientos activos. El historial registrado se conservará.</p>
        <div className={styles.formActions}>
          <button type="button" disabled={saving} onClick={() => setConfirmingArchive(false)}>Cancelar</button>
          <button className={styles.dangerButton} type="button" disabled={saving} onClick={archive}>{saving ? "Archivando…" : "Archivar cliente"}</button>
        </div>
    </ModalDialog>}
  </>;
}
