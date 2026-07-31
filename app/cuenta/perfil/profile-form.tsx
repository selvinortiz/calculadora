"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { OrganizationRole } from "@/lib/domain";
import styles from "./page.module.css";

export function ProfileForm({
  company,
  displayName,
  email,
  role,
}: {
  company: string;
  displayName: string;
  email: string;
  role: OrganizationRole;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [organizationName, setOrganizationName] = useState(company);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          ...(role === "owner" ? { organizationName } : {}),
        }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) {
        setMessage({ text: result.message || "No fue posible guardar los cambios.", tone: "error" });
        return;
      }

      setMessage({ text: "Cambios guardados.", tone: "success" });
      router.refresh();
    } catch {
      setMessage({ text: "No fue posible conectar con el portal.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor="profile-name">Nombre</label>
        <input
          id="profile-name"
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="profile-email">Correo electrónico</label>
        <input id="profile-email" value={email} readOnly aria-readonly="true" />
      </div>
      <div className={styles.field}>
        <label htmlFor="profile-company">Organización</label>
        <input
          id="profile-company"
          maxLength={100}
          value={organizationName}
          onChange={(event) => setOrganizationName(event.target.value)}
          readOnly={role !== "owner"}
          aria-readonly={role !== "owner"}
          required
        />
      </div>
      {message && (
        <p className={message.tone === "success" ? styles.success : styles.error} role="status">
          {message.text}
        </p>
      )}
      <button className={styles.primaryButton} type="submit" disabled={submitting || !name.trim() || !organizationName.trim()}>
        {submitting ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
