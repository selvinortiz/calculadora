import { KeyIcon } from "@heroicons/react/24/outline";
import { PasswordForm } from "./password-form";
import styles from "./page.module.css";

export default function ChangePasswordPage() {
  return (
    <main className="appPage">
      <header className="pageHeader">
        <h1 className="pageTitle">Cambiar contraseña</h1>
        <p className="pageIntro">Elige una contraseña nueva para tu cuenta.</p>
      </header>
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <span aria-hidden="true"><KeyIcon /></span>
          <div>
            <h2>Nueva contraseña</h2>
            <p>Usa al menos 12 caracteres con letras y números.</p>
          </div>
        </header>
        <PasswordForm />
      </section>
    </main>
  );
}
