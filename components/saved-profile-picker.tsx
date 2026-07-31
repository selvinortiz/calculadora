"use client";

import Link from "next/link";
import type { DirectoryCustomer, DirectoryLoan, DirectoryOrganization } from "@/lib/domain";
import { useDurableDirectory } from "@/lib/use-durable-directory";
import styles from "./saved-profile-picker.module.css";

export type SavedFinancingSelection = {
  financing: DirectoryLoan;
  customer: DirectoryCustomer;
  organization: DirectoryOrganization | null;
};

export function SavedFinancingPicker({ hint, onSelect, value }: { hint?: string; onSelect: (selection: SavedFinancingSelection | null) => void; scope?: string; value: string }) {
  const { data, isReady } = useDurableDirectory();
  const financings = [...data.loans].sort((left, right) => left.displayName.localeCompare(right.displayName, "es-GT"));
  function handleSelection(id: string) {
    const financing = data.loans.find((item) => item.id === id);
    const customer = financing ? data.customers.find((item) => item.id === financing.customerId) : undefined;
    onSelect(financing && customer ? { financing, customer, organization: data.organization } : null);
  }
  return <div className={styles.picker}><div className={styles.labelRow}><label htmlFor="saved-financing">Financiamiento</label><Link href="/directorio">Directorio</Link></div><select id="saved-financing" value={value} disabled={!isReady || financings.length === 0} onChange={(event) => handleSelection(event.target.value)}><option value="">{financings.length === 0 ? "No hay financiamientos" : "Seleccionar"}</option>{financings.map((financing) => <option key={financing.id} value={financing.id}>{financing.displayName}</option>)}</select>{hint && <small>{hint}</small>}</div>;
}

export function SavedCustomerPicker({ onSelect, value }: { onSelect: (customer: DirectoryCustomer | null) => void; scope?: string; value: string }) {
  const { data, isReady } = useDurableDirectory();
  const customers = [...data.customers].sort((left, right) => left.name.localeCompare(right.name, "es-GT"));
  return <div className={`${styles.picker} ${styles.compact}`}><div className={styles.labelRow}><label htmlFor="saved-customer">Cliente</label><Link href="/directorio">Directorio</Link></div><select id="saved-customer" value={value} disabled={!isReady || customers.length === 0} onChange={(event) => onSelect(customers.find((item) => item.id === event.target.value) ?? null)}><option value="">{customers.length === 0 ? "No hay clientes" : "Seleccionar"}</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></div>;
}
