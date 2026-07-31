"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import styles from "./page.module.css";

type Operator = {
  userId: string;
  email: string;
  displayName: string;
  role: "owner" | "operator";
  active: boolean;
  mustChangePassword: boolean;
};

export function AccessAdmin() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTarget, setEmailTarget] = useState<Operator | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/operators", { cache: "no-store" });
    const result = await response.json() as { operators?: Operator[]; message?: string };
    if (!response.ok) setNotice(result.message || "No fue posible cargar los accesos.");
    else setOperators(result.operators || []);
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function createOperator(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice(""); setTemporaryPassword("");
    try {
      const response = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email }),
      });
      const result = await response.json() as { message?: string; temporaryPassword?: string };
      if (!response.ok) setNotice(result.message || "No fue posible crear el acceso.");
      else {
        setTemporaryPassword(result.temporaryPassword || "");
        setNotice("Operador creado. Copia la contraseña temporal; se muestra una sola vez.");
        setDisplayName(""); setEmail(""); await load();
      }
    } finally { setBusy(false); }
  }

  async function changeOperator(userId: string, action: "deactivate" | "reactivate" | "reset_password") {
    setBusy(true); setNotice(""); setTemporaryPassword("");
    try {
      const response = await fetch(`/api/admin/operators/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json() as { message?: string; temporaryPassword?: string };
      if (!response.ok) setNotice(result.message || "No fue posible actualizar el acceso.");
      else {
        setTemporaryPassword(result.temporaryPassword || "");
        setNotice(action === "reset_password" ? "Contraseña restablecida. Cópiala; se muestra una sola vez." : "Acceso actualizado.");
        await load();
      }
    } finally { setBusy(false); }
  }

  function editEmail(operator: Operator) {
    setNotice("");
    setTemporaryPassword("");
    setEmailTarget(operator);
    setEmailDraft(operator.email);
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailTarget || busy) return;
    setBusy(true); setNotice(""); setTemporaryPassword("");
    try {
      const response = await fetch(`/api/admin/operators/${emailTarget.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_email", email: emailDraft }),
      });
      const result = await response.json() as { email?: string; message?: string };
      if (!response.ok) setNotice(result.message || "No fue posible cambiar el correo.");
      else {
        setNotice("Correo actualizado.");
        setEmailTarget(null);
        setEmailDraft("");
        await load();
      }
    } finally { setBusy(false); }
  }

  return (
    <>
      {(notice || temporaryPassword) && <section className={styles.feedback} aria-live="polite">
        {notice && <p>{notice}</p>}
        {temporaryPassword && <output className={styles.password} aria-label="Contraseña temporal">{temporaryPassword}</output>}
      </section>}
      <div className={styles.grid}>
      <section className={styles.card}>
        <h2>Crear operador</h2>
        <p>Se generará una contraseña temporal.</p>
        <form onSubmit={createOperator}>
          <label htmlFor="operator-name">Nombre</label>
          <input id="operator-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required />
          <label htmlFor="operator-email">Correo</label>
          <input id="operator-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
          <button type="submit" disabled={busy}>Crear acceso</button>
        </form>
      </section>
      <section className={styles.card}>
        <h2>Usuarios</h2>
        <ul className={styles.list}>
          {operators.map((operator) => (
            <li key={operator.userId}>
              <div><strong>{operator.displayName}</strong><span>{operator.email}</span><small>{operator.role === "owner" ? "Propietario" : operator.active ? "Activo" : "Desactivado"}{operator.mustChangePassword ? " · cambio de contraseña pendiente" : ""}</small></div>
              <div className={styles.actions}>
                <button type="button" disabled={busy} onClick={() => editEmail(operator)}>Editar correo</button>
                {operator.role === "operator" && <>
                  <button type="button" disabled={busy} onClick={() => changeOperator(operator.userId, operator.active ? "deactivate" : "reactivate")}>{operator.active ? "Desactivar" : "Reactivar"}</button>
                  <button type="button" disabled={busy || !operator.active} onClick={() => changeOperator(operator.userId, "reset_password")}>Restablecer clave</button>
                </>}
              </div>
            </li>
          ))}
        </ul>
      </section>
      </div>
      {emailTarget && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (!busy && event.currentTarget === event.target) setEmailTarget(null); }}>
        <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="edit-email-title">
          <p className={styles.dialogEyebrow}>Acceso</p>
          <h2 id="edit-email-title">Cambiar correo</h2>
          <p>{emailTarget.displayName}</p>
          <form onSubmit={updateEmail}>
            <label htmlFor="access-email">Correo electrónico</label>
            <input id="access-email" type="email" value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} maxLength={254} autoFocus required />
            <div className={styles.dialogActions}>
              <button type="button" disabled={busy} onClick={() => setEmailTarget(null)}>Cancelar</button>
              <button type="submit" disabled={busy || emailDraft.trim().toLowerCase() === emailTarget.email.trim().toLowerCase()}>{busy ? "Guardando…" : "Guardar correo"}</button>
            </div>
          </form>
        </section>
      </div>}
    </>
  );
}
