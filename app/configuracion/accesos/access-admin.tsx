"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowPathIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ModalDialog } from "@/components/modal-dialog";
import resourceStyles from "@/components/resource-pages.module.css";
import styles from "./page.module.css";

type Operator = {
  userId: string;
  email: string;
  displayName: string;
  role: "owner" | "operator";
  active: boolean;
  mustChangePassword: boolean;
};

type Notice = { message: string; tone: "success" | "error" };

export function AccessAdmin() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [search, setSearch] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState<Operator | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/operators", { cache: "no-store" });
      const result = await response.json() as { operators?: Operator[]; message?: string };
      if (!response.ok) setLoadError(result.message || "No fue posible cargar los accesos.");
      else setOperators(result.operators || []);
    } catch {
      setLoadError("No fue posible cargar los accesos. Revisa tu conexión.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const filteredOperators = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return operators;
    return operators.filter((operator) => normalizeSearch([
      operator.displayName,
      operator.email,
      operator.role === "owner" ? "propietario" : "operador",
      operator.active ? "activo" : "desactivado",
    ].join(" ")).includes(query));
  }, [operators, search]);

  function clearSensitiveFeedback() {
    setNotice(null);
    setTemporaryPassword("");
    setCopyState("idle");
  }

  function openCreateDialog() {
    clearSensitiveFeedback();
    setCreateOpen(true);
  }

  async function createOperator(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    clearSensitiveFeedback();
    try {
      const response = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email }),
      });
      const result = await response.json() as { message?: string; temporaryPassword?: string };
      if (!response.ok) setNotice({ message: result.message || "No fue posible crear el acceso.", tone: "error" });
      else {
        setTemporaryPassword(result.temporaryPassword || "");
        setNotice({ message: "Operador creado. Esta contraseña temporal se muestra una sola vez.", tone: "success" });
        setDisplayName("");
        setEmail("");
        setCreateOpen(false);
        await load(false);
      }
    } catch {
      setNotice({ message: "No fue posible crear el acceso. Revisa tu conexión.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function changeOperator(userId: string, action: "deactivate" | "reactivate" | "reset_password") {
    setBusy(true);
    clearSensitiveFeedback();
    try {
      const response = await fetch(`/api/admin/operators/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json() as { message?: string; temporaryPassword?: string };
      if (!response.ok) setNotice({ message: result.message || "No fue posible actualizar el acceso.", tone: "error" });
      else {
        setTemporaryPassword(result.temporaryPassword || "");
        setNotice({
          message: action === "reset_password"
            ? "Contraseña restablecida. Esta contraseña temporal se muestra una sola vez."
            : action === "deactivate" ? "Acceso desactivado." : "Acceso reactivado.",
          tone: "success",
        });
        await load(false);
      }
    } catch {
      setNotice({ message: "No fue posible actualizar el acceso. Revisa tu conexión.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  function editEmail(operator: Operator) {
    clearSensitiveFeedback();
    setEmailTarget(operator);
    setEmailDraft(operator.email);
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailTarget || busy) return;
    setBusy(true);
    clearSensitiveFeedback();
    try {
      const response = await fetch(`/api/admin/operators/${emailTarget.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_email", email: emailDraft }),
      });
      const result = await response.json() as { email?: string; message?: string };
      if (!response.ok) setNotice({ message: result.message || "No fue posible cambiar el correo.", tone: "error" });
      else {
        setNotice({ message: "Correo actualizado.", tone: "success" });
        setEmailTarget(null);
        setEmailDraft("");
        await load(false);
      }
    } catch {
      setNotice({ message: "No fue posible cambiar el correo. Revisa tu conexión.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function copyTemporaryPassword() {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  const resultLabel = search.trim()
    ? `${filteredOperators.length} de ${operators.length} usuarios`
    : `${operators.length} ${operators.length === 1 ? "usuario" : "usuarios"}`;

  return <>
    <header className={resourceStyles.pageHeader}>
      <div className={resourceStyles.headingCopy}>
        <p className={resourceStyles.eyebrow}>Configuración</p>
        <h1 className={resourceStyles.title}>Accesos</h1>
        <p className={resourceStyles.intro}>Administra quién puede ingresar y operar en nombre de la organización.</p>
      </div>
      <button className={resourceStyles.primaryAction} type="button" onClick={openCreateDialog}>
        <UserPlusIcon aria-hidden="true" />Nuevo acceso
      </button>
    </header>

    {(notice || temporaryPassword) && <section
      className={`${styles.feedback} ${notice?.tone === "error" ? styles.feedbackError : ""}`}
      aria-live={notice?.tone === "error" ? "assertive" : "polite"}
    >
      <div className={styles.feedbackHeading}>
        <div>
          <strong>{notice?.tone === "error" ? "No se completó la acción" : "Acceso actualizado"}</strong>
          {notice && <p>{notice.message}</p>}
        </div>
        <button className={styles.dismissButton} type="button" onClick={clearSensitiveFeedback} aria-label="Cerrar aviso">
          <XMarkIcon aria-hidden="true" />
        </button>
      </div>
      {temporaryPassword && <div className={styles.passwordPanel}>
        <div>
          <span>Contraseña temporal</span>
          <output className={styles.password} aria-label="Contraseña temporal">{temporaryPassword}</output>
        </div>
        <button className={styles.copyButton} type="button" onClick={() => void copyTemporaryPassword()}>
          {copyState === "copied" ? <CheckIcon aria-hidden="true" /> : <ClipboardDocumentIcon aria-hidden="true" />}
          {copyState === "copied" ? "Copiada" : "Copiar"}
        </button>
        {copyState === "error" && <small>No se pudo copiar automáticamente. Selecciona la contraseña para copiarla.</small>}
      </div>}
    </section>}

    <div className={resourceStyles.toolbar}>
      <div className={resourceStyles.searchForm} role="search">
        <MagnifyingGlassIcon aria-hidden="true" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre, correo, rol o estado…"
          aria-label="Buscar accesos"
        />
      </div>
      <span className={resourceStyles.resultCount} aria-live="polite">{resultLabel}</span>
    </div>

    {loading ? <section className={styles.loadingState} aria-busy="true" aria-label="Cargando accesos">
      <ArrowPathIcon aria-hidden="true" />
      <p>Cargando accesos…</p>
    </section> : loadError ? <section className={resourceStyles.emptyState}>
      <span className={resourceStyles.emptyIcon} aria-hidden="true"><NoSymbolIcon /></span>
      <h2>No pudimos cargar los accesos</h2>
      <p>{loadError}</p>
      <button className={resourceStyles.secondaryAction} type="button" onClick={() => void load()}>
        <ArrowPathIcon aria-hidden="true" />Intentar de nuevo
      </button>
    </section> : filteredOperators.length > 0 ? <section className={resourceStyles.tableCard} aria-label="Lista de accesos">
      <table className={resourceStyles.table}>
        <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Contraseña</th><th><span className="srOnly">Acciones</span></th></tr></thead>
        <tbody>{filteredOperators.map((operator) => <tr key={operator.userId}>
          <td data-label="Usuario"><div className={resourceStyles.primaryCell}>
            <strong>{operator.displayName}</strong>
            <span>{operator.email}</span>
          </div></td>
          <td data-label="Rol"><span className={`${styles.badge} ${operator.role === "owner" ? styles.ownerBadge : styles.operatorBadge}`}>
            {operator.role === "owner" && <ShieldCheckIcon aria-hidden="true" />}
            {operator.role === "owner" ? "Propietario" : "Operador"}
          </span></td>
          <td data-label="Estado"><span className={`${styles.badge} ${operator.active ? styles.activeBadge : styles.inactiveBadge}`}>
            {operator.active ? "Activo" : "Desactivado"}
          </span></td>
          <td data-label="Contraseña"><span className={`${styles.badge} ${operator.mustChangePassword ? styles.pendingBadge : styles.readyBadge}`}>
            {operator.mustChangePassword ? "Cambio pendiente" : "Actualizada"}
          </span></td>
          <td data-label="Acciones"><div className={resourceStyles.actions}>
            <button className={`${resourceStyles.contextAction} ${styles.actionButton}`} type="button" disabled={busy} onClick={() => editEmail(operator)} title="Editar correo" aria-label={`Editar correo de ${operator.displayName}`}>
              <PencilSquareIcon aria-hidden="true" /><span>Correo</span>
            </button>
            {operator.role === "operator" && <>
              <button className={`${resourceStyles.contextAction} ${styles.actionButton} ${operator.active ? styles.deactivateButton : ""}`} type="button" disabled={busy} onClick={() => void changeOperator(operator.userId, operator.active ? "deactivate" : "reactivate")} title={operator.active ? "Desactivar acceso" : "Reactivar acceso"} aria-label={`${operator.active ? "Desactivar" : "Reactivar"} acceso de ${operator.displayName}`}>
                {operator.active ? <NoSymbolIcon aria-hidden="true" /> : <ArrowPathIcon aria-hidden="true" />}<span>{operator.active ? "Desactivar" : "Reactivar"}</span>
              </button>
              <button className={`${resourceStyles.contextAction} ${styles.actionButton}`} type="button" disabled={busy || !operator.active} onClick={() => void changeOperator(operator.userId, "reset_password")} title={operator.active ? "Restablecer contraseña" : "Reactiva el acceso para restablecer la contraseña"} aria-label={`Restablecer contraseña de ${operator.displayName}`}>
                <KeyIcon aria-hidden="true" /><span>Clave</span>
              </button>
            </>}
          </div></td>
        </tr>)}</tbody>
      </table>
    </section> : <section className={resourceStyles.emptyState}>
      <span className={resourceStyles.emptyIcon} aria-hidden="true"><UserGroupIcon /></span>
      <h2>{search ? "No encontramos accesos" : "Agrega tu primer operador"}</h2>
      <p>{search ? "Prueba con otro nombre, correo, rol o estado." : "Los operadores podrán ingresar y trabajar con los recursos de la organización."}</p>
      {search ? <button className={resourceStyles.secondaryAction} type="button" onClick={() => setSearch("")}>Limpiar búsqueda</button> : <button className={resourceStyles.primaryAction} type="button" onClick={openCreateDialog}>Nuevo acceso</button>}
    </section>}

    {createOpen && <ModalDialog backdropClassName={styles.dialogBackdrop} dialogClassName={styles.dialog} labelledBy="create-access-title" busy={busy} onClose={() => setCreateOpen(false)}>
      <p className={styles.dialogEyebrow}>Nuevo acceso</p>
      <h2 id="create-access-title">Crear operador</h2>
      <p>Se generará una contraseña temporal que deberás compartir de forma segura.</p>
      <form onSubmit={createOperator}>
        <label htmlFor="operator-name">Nombre</label>
        <input id="operator-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} autoComplete="name" autoFocus required />
        <label htmlFor="operator-email">Correo electrónico</label>
        <input id="operator-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" required />
        {notice?.tone === "error" && <p className={styles.dialogError} role="alert">{notice.message}</p>}
        <div className={styles.dialogActions}>
          <button type="button" disabled={busy} onClick={() => setCreateOpen(false)}>Cancelar</button>
          <button type="submit" disabled={busy}>{busy ? "Creando…" : "Crear acceso"}</button>
        </div>
      </form>
    </ModalDialog>}

    {emailTarget && <ModalDialog backdropClassName={styles.dialogBackdrop} dialogClassName={styles.dialog} labelledBy="edit-email-title" busy={busy} onClose={() => setEmailTarget(null)}>
      <p className={styles.dialogEyebrow}>Acceso</p>
      <h2 id="edit-email-title">Cambiar correo</h2>
      <p>{emailTarget.displayName}</p>
      <form onSubmit={updateEmail}>
        <label htmlFor="access-email">Correo electrónico</label>
        <input id="access-email" type="email" value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} maxLength={254} autoComplete="email" autoFocus required />
        {notice?.tone === "error" && <p className={styles.dialogError} role="alert">{notice.message}</p>}
        <div className={styles.dialogActions}>
          <button type="button" disabled={busy} onClick={() => setEmailTarget(null)}>Cancelar</button>
          <button type="submit" disabled={busy || emailDraft.trim().toLowerCase() === emailTarget.email.trim().toLowerCase()}>{busy ? "Guardando…" : "Guardar correo"}</button>
        </div>
      </form>
    </ModalDialog>}
  </>;
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
}
