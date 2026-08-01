"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  HomeIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import styles from "./app-header.module.css";
import type { OrganizationRole } from "@/lib/domain";

const NAVIGATION = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/clientes", label: "Clientes", icon: UsersIcon },
  { href: "/financiamientos", label: "Financiamientos", icon: DocumentTextIcon },
] as const;

const ADMINISTRATION = [
  { href: "/configuracion", label: "Configuración", icon: Cog6ToothIcon },
  { href: "/configuracion/accesos", label: "Accesos", icon: UserGroupIcon },
  { href: "/configuracion/auditoria", label: "Auditoría", icon: ClipboardDocumentListIcon },
] as const;

const LEGACY_DEFAULT_WIDTH = 220;
const DEFAULT_WIDTH = 248;
const DEFAULT_WIDTH_RATIO = 0.16;
const MIN_WIDTH = 208;
const MAX_WIDTH = 360;
const COLLAPSED_WIDTH = 68;
const WIDTH_STORAGE_KEY = "creditos-sidebar-width-v2";
const LEGACY_WIDTH_STORAGE_KEY = "creditos-sidebar-width";
const COLLAPSED_STORAGE_KEY = "creditos-sidebar-collapsed";

export function AppHeader({
  operatorCompany,
  operatorName,
  role,
}: {
  operatorCompany: string;
  operatorName: string;
  role: OrganizationRole;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const initials = operatorName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("es-GT");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const smartDefault = getDefaultWidth(window.innerWidth);
      try {
        const savedValue = window.localStorage.getItem(WIDTH_STORAGE_KEY);
        const savedWidth = savedValue === null ? Number.NaN : Number(savedValue);
        const legacyValue = window.localStorage.getItem(LEGACY_WIDTH_STORAGE_KEY);
        const legacyWidth = legacyValue === null ? Number.NaN : Number(legacyValue);
        if (Number.isFinite(savedWidth)) {
          setSidebarWidth(clampWidth(savedWidth));
        } else if (Number.isFinite(legacyWidth) && legacyWidth !== LEGACY_DEFAULT_WIDTH) {
          setSidebarWidth(clampWidth(legacyWidth));
        } else {
          setSidebarWidth(smartDefault);
        }
        setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");
      } catch {
        // Browser preferences are optional; the default shell remains usable.
        setSidebarWidth(smartDefault);
      } finally {
        setPreferencesLoaded(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    const root = document.documentElement;
    root.style.setProperty("--app-sidebar-width", `${collapsed ? COLLAPSED_WIDTH : sidebarWidth}px`);
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(sidebarWidth));
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      // Browser preferences are optional; the current session still updates.
    }
  }, [collapsed, preferencesLoaded, sidebarWidth]);

  useEffect(() => () => {
    document.documentElement.style.removeProperty("--app-sidebar-width");
    delete document.documentElement.dataset.sidebarResizing;
  }, []);

  function beginResize(event: PointerEvent<HTMLDivElement>) {
    if (collapsed || event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    document.documentElement.dataset.sidebarResizing = "true";

    function move(pointerEvent: globalThis.PointerEvent) {
      setSidebarWidth(clampWidth(startWidth + pointerEvent.clientX - startX));
    }

    function finish() {
      delete document.documentElement.dataset.sidebarResizing;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setSidebarWidth((current) => clampWidth(current + (event.key === "ArrowRight" ? 8 : -8)));
  }

  return (
    <aside className={styles.sidebar} data-collapsed={collapsed} data-print-hidden>
      <div className={styles.inner}>
        <div className={styles.brandRow}>
          <Link className={styles.brand} href="/" aria-label="Calculadora de Créditos, portal">
            <span className={styles.brandMark} aria-hidden="true">Q</span>
            <span className={styles.brandCopy}>
              <strong>Calculadora de Créditos</strong>
              <small>Interés simple · GTQ</small>
            </span>
          </Link>
          <button
            className={styles.collapseButton}
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
            aria-expanded={!collapsed}
            title={collapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
          >
            {collapsed ? <ChevronDoubleRightIcon /> : <ChevronDoubleLeftIcon />}
          </button>
        </div>
        <div className={styles.navigationArea}>
          <p className={styles.navLabel}>Principal</p>
          <nav className={styles.nav} aria-label="Navegación principal">
            {NAVIGATION.map((item) => {
              const Icon = item.icon;
              const isCurrent = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  className={styles.navLink}
                  href={item.href}
                  aria-current={isCurrent ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={styles.navIcon} aria-hidden="true"><Icon /></span>
                  <span className={styles.navText}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        {role === "owner" && <div className={styles.adminArea}>
          <p className={styles.navLabel}>Administración</p>
          <nav className={styles.nav} aria-label="Administración">
            {ADMINISTRATION.map((item) => {
              const Icon = item.icon;
              const isCurrent = item.href === "/configuracion" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return <Link key={item.href} className={styles.navLink} href={item.href} aria-current={isCurrent ? "page" : undefined} title={collapsed ? item.label : undefined}>
                <span className={styles.navIcon} aria-hidden="true"><Icon /></span>
                <span className={styles.navText}>{item.label}</span>
              </Link>;
            })}
          </nav>
        </div>}
        <div className={styles.accountArea}>
          <Link
            className={styles.profileLink}
            href="/cuenta/perfil"
            aria-current={pathname === "/cuenta/perfil" ? "page" : undefined}
            title={collapsed ? "Editar perfil" : undefined}
          >
            <span className={styles.operatorAvatar} aria-hidden="true">{initials}</span>
            <span className={styles.profileCopy}>
              <small>{role === "owner" ? "Propietario" : "Operador"}</small>
              <strong>{operatorName}</strong>
              <span>{operatorCompany}</span>
            </span>
            <ChevronRightIcon className={styles.profileChevron} aria-hidden="true" />
          </Link>
          <form className={styles.signOutForm} action="/api/auth/sign-out" method="post">
            <button className={styles.signOutButton} type="submit" aria-label={`Cerrar la sesión de ${operatorName}`} title={collapsed ? "Cerrar sesión" : undefined}>
              <ArrowRightStartOnRectangleIcon aria-hidden="true" />
              <span>Cerrar sesión</span>
            </button>
          </form>
        </div>
      </div>
      {!collapsed && (
        <div
          className={styles.resizeHandle}
          role="separator"
          aria-label="Cambiar ancho de la barra lateral"
          aria-orientation="vertical"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={beginResize}
          onKeyDown={resizeWithKeyboard}
        />
      )}
    </aside>
  );
}

function clampWidth(width: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

function getDefaultWidth(viewportWidth: number) {
  return clampWidth(Math.max(DEFAULT_WIDTH, viewportWidth * DEFAULT_WIDTH_RATIO));
}
