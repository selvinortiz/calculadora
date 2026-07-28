"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./app-header.module.css";

const NAVIGATION = [
  { href: "/", label: "Inicio", icon: "▦" },
  { href: "/financiamiento", label: "Nuevo préstamo", icon: "+" },
  { href: "/abono-capital", label: "Abono a capital", icon: "↓" },
] as const;

export function AppHeader({
  operatorCompany,
  operatorName,
}: {
  operatorCompany: string;
  operatorName: string;
}) {
  const pathname = usePathname();
  const initials = operatorName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("es-GT");

  return (
    <aside className={styles.sidebar} data-print-hidden>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="Calculadora de Créditos, portal">
          <span className={styles.brandMark} aria-hidden="true">
            Q
          </span>
          <span>
            <strong>Calculadora de Créditos</strong>
            <small>Interés simple · GTQ</small>
          </span>
        </Link>
        <div className={styles.navigationArea}>
          <p className={styles.navLabel}>Operaciones</p>
          <nav className={styles.nav} aria-label="Navegación principal">
            {NAVIGATION.map((item) => {
              const isCurrent =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  className={styles.navLink}
                  href={item.href}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className={styles.methodCard}>
          <span className={styles.operatorAvatar} aria-hidden="true">{initials}</span>
          <div>
            <small>Operador</small>
            <strong>{operatorName}</strong>
            <span>{operatorCompany}</span>
          </div>
          <form action="/api/auth/sign-out" method="post">
            <button type="submit" aria-label={`Cerrar la sesión de ${operatorName}`}>
              Salir
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
