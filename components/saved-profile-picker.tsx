"use client";

import Link from "next/link";
import { useId } from "react";
import type { DirectoryCustomer, DirectoryLoan, DirectoryOrganization } from "@/lib/domain";
import { useDurableDirectory } from "@/lib/use-durable-directory";
import styles from "./saved-profile-picker.module.css";

export type SavedFinancingSelection = {
  financing: DirectoryLoan;
  customer: DirectoryCustomer;
  organization: DirectoryOrganization | null;
};

export function SavedFinancingPicker({ hint, onSelect, value }: { hint?: string; onSelect: (selection: SavedFinancingSelection | null) => void; scope?: string; value: string }) {
  const { data, error, isReady, reload } = useDurableDirectory();
  const selectId = useId();
  const financings = [...data.loans].sort((left, right) => left.displayName.localeCompare(right.displayName, "es-GT"));
  function handleSelection(id: string) {
    const financing = data.loans.find((item) => item.id === id);
    const customer = financing ? data.customers.find((item) => item.id === financing.customerId) : undefined;
    onSelect(financing && customer ? { financing, customer, organization: data.organization } : null);
  }
  const emptyLabel = !isReady ? "Cargando financiamientos…" : error ? "No se pudieron cargar" : financings.length === 0 ? "No hay financiamientos" : "Seleccionar";
  return <div className={styles.picker}><div className={styles.labelRow}><label htmlFor={selectId}>Financiamiento</label><Link href="/financiamientos">Ver todos</Link></div><select id={selectId} value={value} disabled={!isReady || Boolean(error) || financings.length === 0} onChange={(event) => handleSelection(event.target.value)}><option value="">{emptyLabel}</option>{financings.map((financing) => <option key={financing.id} value={financing.id}>{financing.displayName}</option>)}</select>{error ? <small role="alert">{error} <button type="button" onClick={() => void reload()}>Reintentar</button></small> : hint && <small>{hint}</small>}</div>;
}

export function SavedCustomerPicker({ onSelect, value }: { onSelect: (customer: DirectoryCustomer | null) => void; scope?: string; value: string }) {
  const { data, error, isReady, reload } = useDurableDirectory();
  const selectId = useId();
  const customers = [...data.customers].sort((left, right) => left.name.localeCompare(right.name, "es-GT"));
  const emptyLabel = !isReady ? "Cargando clientes…" : error ? "No se pudieron cargar" : customers.length === 0 ? "No hay clientes" : "Seleccionar";
  return <div className={`${styles.picker} ${styles.compact}`}><div className={styles.labelRow}><label htmlFor={selectId}>Cliente</label><Link href="/clientes">Ver todos</Link></div><select id={selectId} value={value} disabled={!isReady || Boolean(error) || customers.length === 0} onChange={(event) => onSelect(customers.find((item) => item.id === event.target.value) ?? null)}><option value="">{emptyLabel}</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>{error && <small role="alert">{error} <button type="button" onClick={() => void reload()}>Reintentar</button></small>}</div>;
}
