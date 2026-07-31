import type { Metadata } from "next";
import { BuildingOffice2Icon, KeyIcon, UserIcon } from "@heroicons/react/24/outline";
import { redirect } from "next/navigation";
import { PasswordForm } from "../cambiar-clave/password-form";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { ProfileForm } from "./profile-form";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Perfil",
};

export default async function ProfilePage() {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");

  return (
    <main className="appPage">
      <header className="pageHeader">
        <p className="pageEyebrow">Tu cuenta</p>
        <h1 className="pageTitle">Perfil</h1>
        <p className="pageIntro">Administra tus datos y seguridad.</p>
      </header>

      <div className={styles.grid}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <span aria-hidden="true"><UserIcon /></span>
            <div>
              <h2>Información personal</h2>
              <p>{session.role === "owner" ? "Actualiza tus datos y los de tu organización." : "Actualiza los datos de tu cuenta."}</p>
            </div>
          </header>
          <ProfileForm
            company={session.company}
            displayName={session.name}
            email={session.email}
            role={session.role}
          />
          <div className={styles.roleNote}>
            <BuildingOffice2Icon aria-hidden="true" />
            <span>{session.role === "owner" ? "Propietario" : "Operador"}</span>
          </div>
        </section>

        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <span aria-hidden="true"><KeyIcon /></span>
            <div>
              <h2>Contraseña</h2>
              <p>Usa al menos 12 caracteres con letras y números.</p>
            </div>
          </header>
          <PasswordForm autoFocus={false} redirectTo={null} />
        </section>
      </div>
    </main>
  );
}
