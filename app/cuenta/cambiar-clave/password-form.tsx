"use client";

import { useState, type FormEvent } from "react";
import styles from "./page.module.css";

type PasswordFormProps = {
  autoFocus?: boolean;
  redirectTo?: string | null;
};

export function PasswordForm({ autoFocus = true, redirectTo = "/" }: PasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage({ text: "Las contraseñas no coinciden.", tone: "error" });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) {
        setMessage({ text: result.message || "No fue posible cambiar la contraseña.", tone: "error" });
      } else if (redirectTo) {
        window.location.assign(redirectTo);
      } else {
        setPassword("");
        setConfirmation("");
        setMessage({ text: "Contraseña actualizada.", tone: "success" });
      }
    } catch {
      setMessage({ text: "No fue posible conectar con el portal.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor="new-password">Contraseña nueva</label>
        <input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus={autoFocus} />
      </div>
      <div className={styles.field}>
        <label htmlFor="confirm-password">Confirmar contraseña</label>
        <input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
      </div>
      {message && (
        <p className={message.tone === "success" ? styles.messageSuccess : styles.message} role="status">
          {message.text}
        </p>
      )}
      <button type="submit" disabled={submitting || password.length < 12 || confirmation.length < 12}>
        {submitting ? "Guardando…" : "Actualizar contraseña"}
      </button>
    </form>
  );
}
