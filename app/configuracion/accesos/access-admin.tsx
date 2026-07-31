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

  return (
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
        {notice && <p role="status">{notice}</p>}
        {temporaryPassword && (
          <output className={styles.password} aria-label="Contraseña temporal">{temporaryPassword}</output>
        )}
      </section>
      <section className={styles.card}>
        <h2>Usuarios</h2>
        <ul className={styles.list}>
          {operators.map((operator) => (
            <li key={operator.userId}>
              <div><strong>{operator.displayName}</strong><span>{operator.email}</span><small>{operator.role === "owner" ? "Propietario" : operator.active ? "Activo" : "Desactivado"}{operator.mustChangePassword ? " · cambio de contraseña pendiente" : ""}</small></div>
              {operator.role === "operator" && (
                <div className={styles.actions}>
                  <button type="button" disabled={busy} onClick={() => changeOperator(operator.userId, operator.active ? "deactivate" : "reactivate")}>{operator.active ? "Desactivar" : "Reactivar"}</button>
                  <button type="button" disabled={busy || !operator.active} onClick={() => changeOperator(operator.userId, "reset_password")}>Restablecer clave</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
