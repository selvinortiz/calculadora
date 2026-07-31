"use client";

import { useEffect, useState, type FormEvent } from "react";
import { notifyDurableDirectoryChanged, useDurableDirectory } from "@/lib/use-durable-directory";
import styles from "./organization-settings.module.css";

type Settings = { name: string; defaultRecipient: string; financingPrefix: string; receiptPrefix: string; adjustmentPrefix: string };

export function OrganizationSettings({ company, recipient }: { company: string; recipient: string }) {
  const { data, error, reload } = useDurableDirectory();
  const [settings, setSettings] = useState<Settings>({ name: company, defaultRecipient: recipient, financingPrefix: "FIN", receiptPrefix: "REC", adjustmentPrefix: "AJU" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!data.organization) return;
    const organization = data.organization;
    const timeout = window.setTimeout(() => setSettings({ name: organization.name, defaultRecipient: organization.defaultRecipient, financingPrefix: organization.financingPrefix, receiptPrefix: organization.receiptPrefix, adjustmentPrefix: organization.adjustmentPrefix }), 0);
    return () => window.clearTimeout(timeout);
  }, [data.organization]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    const response = await fetch("/api/directory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: settings.name, defaultRecipient: settings.defaultRecipient, prefixes: { financing: settings.financingPrefix.toUpperCase(), receipt: settings.receiptPrefix.toUpperCase(), adjustment: settings.adjustmentPrefix.toUpperCase() } }),
    });
    const result = await response.json() as { message?: string };
    setNotice(response.ok ? "Configuración guardada." : result.message || "No fue posible guardar los cambios.");
    if (response.ok) { notifyDurableDirectoryChanged(); await reload(); }
    setSaving(false);
  }

  return <div className={styles.grid}>
    <section className={styles.card}>
      <header><p>Organización</p><h2>Datos generales</h2></header>
      <form className={styles.form} onSubmit={submit}>
        <Field label="Nombre" value={settings.name} onChange={(name) => setSettings((current) => ({ ...current, name }))} required />
        <Field label="Recibido por" value={settings.defaultRecipient} onChange={(defaultRecipient) => setSettings((current) => ({ ...current, defaultRecipient }))} />
        <div className={styles.prefixGrid}>
          <Field label="Financiamientos" value={settings.financingPrefix} onChange={(financingPrefix) => setSettings((current) => ({ ...current, financingPrefix }))} required />
          <Field label="Recibos" value={settings.receiptPrefix} onChange={(receiptPrefix) => setSettings((current) => ({ ...current, receiptPrefix }))} required />
          <Field label="Ajustes" value={settings.adjustmentPrefix} onChange={(adjustmentPrefix) => setSettings((current) => ({ ...current, adjustmentPrefix }))} required />
        </div>
        {(notice || error) && <p className={styles.notice} role="status">{notice || error}</p>}
        <div className={styles.actions}><button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></div>
      </form>
    </section>
    <aside className={styles.preview}>
      <header><p>Numeración</p><h2>Próximos documentos</h2></header>
      <dl>
        <div><dt>Financiamiento</dt><dd>{settings.financingPrefix.toUpperCase()}-000001</dd></div>
        <div><dt>Recibo</dt><dd>{settings.receiptPrefix.toUpperCase()}-000001</dd></div>
        <div><dt>Ajuste</dt><dd>{settings.adjustmentPrefix.toUpperCase()}-000001</dd></div>
      </dl>
    </aside>
  </div>;
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className={styles.field}><span>{label}</span><input value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}
