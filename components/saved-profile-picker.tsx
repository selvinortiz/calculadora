"use client";

import Link from "next/link";
import {
  type CustomerProfile,
  type FinancingProfile,
  type OrganizationProfile,
} from "@/lib/local-persistence";
import { useLocalPersistence } from "@/lib/use-local-persistence";
import styles from "./saved-profile-picker.module.css";

export type SavedFinancingSelection = {
  financing: FinancingProfile;
  customer: CustomerProfile;
  organization: OrganizationProfile | null;
};

export function SavedFinancingPicker({
  hint = "Completa los datos del préstamo y del documento.",
  onSelect,
  scope,
  value,
}: {
  hint?: string;
  onSelect: (selection: SavedFinancingSelection | null) => void;
  scope: string;
  value: string;
}) {
  const { data, isReady } = useLocalPersistence(scope);
  const financings = [...data.financings].sort((left, right) =>
    left.name.localeCompare(right.name, "es-GT"),
  );

  function handleSelection(financingId: string) {
    if (!financingId) {
      onSelect(null);
      return;
    }

    const financing = data.financings.find((item) => item.id === financingId);
    const customer = financing
      ? data.customers.find((item) => item.id === financing.customerId)
      : undefined;
    onSelect(
      financing && customer
        ? { financing, customer, organization: data.organization }
        : null,
    );
  }

  return (
    <div className={styles.picker}>
      <div className={styles.labelRow}>
        <label htmlFor="saved-financing">Financiamiento guardado</label>
        <Link href="/directorio">Administrar</Link>
      </div>
      <select
        id="saved-financing"
        value={value}
        disabled={!isReady || financings.length === 0}
        onChange={(event) => handleSelection(event.target.value)}
      >
        <option value="">
          {financings.length === 0 ? "No hay financiamientos guardados" : "Seleccionar perfil"}
        </option>
        {financings.map((financing) => (
          <option key={financing.id} value={financing.id}>
            {financing.name}
          </option>
        ))}
      </select>
      <small>{hint}</small>
    </div>
  );
}

export function SavedCustomerPicker({
  onSelect,
  scope,
  value,
}: {
  onSelect: (customer: CustomerProfile | null) => void;
  scope: string;
  value: string;
}) {
  const { data, isReady } = useLocalPersistence(scope);
  const customers = [...data.customers].sort((left, right) =>
    left.name.localeCompare(right.name, "es-GT"),
  );

  return (
    <div className={`${styles.picker} ${styles.compact}`}>
      <div className={styles.labelRow}>
        <label htmlFor="saved-customer">Cliente guardado</label>
        <Link href="/directorio">Administrar</Link>
      </div>
      <select
        id="saved-customer"
        value={value}
        disabled={!isReady || customers.length === 0}
        onChange={(event) => {
          const customer = data.customers.find(
            (item) => item.id === event.target.value,
          );
          onSelect(customer ?? null);
        }}
      >
        <option value="">
          {customers.length === 0 ? "No hay clientes guardados" : "Seleccionar cliente"}
        </option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </select>
    </div>
  );
}
