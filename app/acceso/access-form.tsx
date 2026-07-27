"use client";

import { useState, type FormEvent } from "react";
import styles from "./page.module.css";

export function AccessForm({
  nextPath,
}: {
  nextPath: string;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(result.message || "No pudimos iniciar tu sesión. Intenta de nuevo.");
        return;
      }

      window.location.assign(nextPath);
    } catch {
      setError("No fue posible conectar con el portal. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.accessForm} onSubmit={submitAccess} noValidate>
      <div className={styles.field}>
        <label htmlFor="operator-email">Correo electrónico</label>
        <input
          id="operator-email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          required
          autoFocus
        />
        <small>El correo asociado a tu acceso.</small>
      </div>

      <div className={styles.field}>
        <label htmlFor="access-code">Código de acceso</label>
        <input
          id="access-code"
          name="code"
          type="password"
          autoComplete="current-password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          minLength={4}
          maxLength={128}
          required
        />
        <small>Tu código personal de acceso.</small>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <button type="submit" disabled={isSubmitting || !email.trim() || code.length < 4}>
        {isSubmitting ? "Verificando…" : "Entrar al portal"}
      </button>
    </form>
  );
}
