"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  createPersistenceId,
  type CustomerProfile,
  type FinancingProfile,
  type OrganizationProfile,
} from "@/lib/local-persistence";
import { useLocalPersistence } from "@/lib/use-local-persistence";
import styles from "./persistence-directory.module.css";

type DirectoryView = "organization" | "customers" | "financings";

type CustomerForm = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

type FinancingForm = {
  id: string;
  name: string;
  customerId: string;
  accountReference: string;
  price: string;
  downPayment: string;
  annualRate: string;
  termMonths: string;
  firstDueDate: string;
};

const EMPTY_CUSTOMER: CustomerForm = {
  id: "",
  name: "",
  phone: "",
  email: "",
};

const EMPTY_FINANCING: FinancingForm = {
  id: "",
  name: "",
  customerId: "",
  accountReference: "",
  price: "65000",
  downPayment: "13000",
  annualRate: "7",
  termMonths: "60",
  firstDueDate: "",
};

export function PersistenceDirectory({
  operatorCompany,
  operatorName,
  storageScope,
}: {
  operatorCompany: string;
  operatorName: string;
  storageScope: string;
}) {
  const { data, error, updateData } = useLocalPersistence(storageScope);
  const [view, setView] = useState<DirectoryView>("organization");
  const [notice, setNotice] = useState("");
  const [organizationDraft, setOrganizationDraft] =
    useState<OrganizationProfile | null>(null);
  const [customerForm, setCustomerForm] =
    useState<CustomerForm>(EMPTY_CUSTOMER);
  const [financingForm, setFinancingForm] =
    useState<FinancingForm>(EMPTY_FINANCING);
  const organization = organizationDraft ?? data.organization ?? {
    name: operatorCompany,
    defaultRecipient: operatorName,
  };

  const customers = useMemo(
    () =>
      [...data.customers].sort((left, right) =>
        left.name.localeCompare(right.name, "es-GT"),
      ),
    [data.customers],
  );
  const financings = useMemo(
    () =>
      [...data.financings].sort((left, right) =>
        left.name.localeCompare(right.name, "es-GT"),
      ),
    [data.financings],
  );

  function saveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextOrganization = {
      ...organization,
      name: organization.name.trim(),
      defaultRecipient: organization.defaultRecipient.trim(),
    };
    if (!nextOrganization.name) {
      setNotice("Ingresa el nombre de la organización.");
      return;
    }

    if (
      updateData((current) => ({
        ...current,
        organization: nextOrganization,
      }))
    ) {
      setOrganizationDraft(null);
      setNotice("Datos de la organización guardados.");
    }
  }

  function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = customerForm.name.trim();
    const email = customerForm.email.trim();
    if (!name) {
      setNotice("Ingresa el nombre del cliente.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotice("Revisa el correo del cliente.");
      return;
    }

    const nextCustomer: CustomerProfile = {
      id: customerForm.id || createPersistenceId("customer"),
      name,
      phone: customerForm.phone.trim(),
      email,
      updatedAt: new Date().toISOString(),
    };
    const wasEditing = Boolean(customerForm.id);

    if (
      updateData((current) => ({
        ...current,
        customers: wasEditing
          ? current.customers.map((customer) =>
              customer.id === nextCustomer.id ? nextCustomer : customer,
            )
          : [...current.customers, nextCustomer],
      }))
    ) {
      setCustomerForm(EMPTY_CUSTOMER);
      setNotice(wasEditing ? "Cliente actualizado." : "Cliente guardado.");
    }
  }

  function editCustomer(customer: CustomerProfile) {
    setCustomerForm({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    });
    setNotice("");
  }

  function removeCustomer(customer: CustomerProfile) {
    const linkedFinancing = data.financings.some(
      (financing) => financing.customerId === customer.id,
    );
    if (linkedFinancing) {
      setNotice("Elimina primero los financiamientos guardados para este cliente.");
      return;
    }
    if (!window.confirm(`¿Eliminar a ${customer.name} del directorio?`)) return;

    if (
      updateData((current) => ({
        ...current,
        customers: current.customers.filter((item) => item.id !== customer.id),
      }))
    ) {
      if (customerForm.id === customer.id) setCustomerForm(EMPTY_CUSTOMER);
      setNotice("Cliente eliminado.");
    }
  }

  function saveFinancing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const customer = data.customers.find(
      (item) => item.id === financingForm.customerId,
    );
    const accountReference = financingForm.accountReference.trim();
    const price = Number(financingForm.price);
    const downPayment = Number(financingForm.downPayment);
    const annualRate = Number(financingForm.annualRate);
    const termMonths = Number(financingForm.termMonths);

    if (!customer) {
      setNotice("Selecciona un cliente.");
      return;
    }
    if (!accountReference) {
      setNotice("Ingresa el lote o número de cuenta.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000_000) {
      setNotice("Revisa el precio total.");
      return;
    }
    if (!Number.isFinite(downPayment) || downPayment < 0 || downPayment > price) {
      setNotice("Revisa el enganche.");
      return;
    }
    if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100) {
      setNotice("Revisa la tasa anual.");
      return;
    }
    if (!Number.isInteger(termMonths) || termMonths < 2 || termMonths > 360) {
      setNotice("El plazo debe estar entre 2 y 360 meses.");
      return;
    }

    const nextFinancing: FinancingProfile = {
      id: financingForm.id || createPersistenceId("financing"),
      name:
        financingForm.name.trim() ||
        `${customer.name} · ${formatAccountReference(accountReference)}`,
      customerId: customer.id,
      accountReference,
      price,
      downPayment,
      annualRate,
      termMonths,
      firstDueDate: financingForm.firstDueDate,
      updatedAt: new Date().toISOString(),
    };
    const wasEditing = Boolean(financingForm.id);

    if (
      updateData((current) => ({
        ...current,
        financings: wasEditing
          ? current.financings.map((financing) =>
              financing.id === nextFinancing.id ? nextFinancing : financing,
            )
          : [...current.financings, nextFinancing],
      }))
    ) {
      setFinancingForm(EMPTY_FINANCING);
      setNotice(
        wasEditing ? "Financiamiento actualizado." : "Financiamiento guardado.",
      );
    }
  }

  function editFinancing(financing: FinancingProfile) {
    setFinancingForm({
      id: financing.id,
      name: financing.name,
      customerId: financing.customerId,
      accountReference: financing.accountReference,
      price: String(financing.price),
      downPayment: String(financing.downPayment),
      annualRate: String(financing.annualRate),
      termMonths: String(financing.termMonths),
      firstDueDate: financing.firstDueDate,
    });
    setNotice("");
  }

  function removeFinancing(financing: FinancingProfile) {
    if (!window.confirm(`¿Eliminar el perfil ${financing.name}?`)) return;

    if (
      updateData((current) => ({
        ...current,
        financings: current.financings.filter((item) => item.id !== financing.id),
      }))
    ) {
      if (financingForm.id === financing.id) {
        setFinancingForm(EMPTY_FINANCING);
      }
      setNotice("Financiamiento eliminado.");
    }
  }

  return (
    <section className={styles.directory} aria-label="Directorio local">
      <div className={styles.storageNotice}>
        <span aria-hidden="true">●</span>
        <div>
          <strong>Guardado en este navegador</strong>
          <p>Disponible únicamente para este acceso y este dispositivo.</p>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Secciones del directorio">
        <TabButton
          active={view === "organization"}
          count={data.organization ? 1 : 0}
          label="Organización"
          onClick={() => changeView("organization")}
        />
        <TabButton
          active={view === "customers"}
          count={data.customers.length}
          label="Clientes"
          onClick={() => changeView("customers")}
        />
        <TabButton
          active={view === "financings"}
          count={data.financings.length}
          label="Financiamientos"
          onClick={() => changeView("financings")}
        />
      </div>

      {(notice || error) && (
        <p className={styles.notice} role="status">
          {error || notice}
        </p>
      )}

      {view === "organization" && (
        <div className={styles.twoColumn}>
          <section className={styles.card} aria-labelledby="organization-title">
            <CardHeading
              eyebrow="Documentos"
              id="organization-title"
              title="Datos de la organización"
              description="Se usarán como valores iniciales al preparar documentos."
            />
            <form className={styles.form} onSubmit={saveOrganization}>
              <DirectoryField
                id="organization-name"
                label="Organización"
                value={organization.name}
                onChange={(value) =>
                  setOrganizationDraft({ ...organization, name: value })
                }
                required
              />
              <DirectoryField
                id="default-recipient"
                label="Recibido por"
                value={organization.defaultRecipient}
                onChange={(value) =>
                  setOrganizationDraft({
                    ...organization,
                    defaultRecipient: value,
                  })
                }
                hint="Persona que aparecerá inicialmente en los recibos."
              />
              <FormActions
                primaryLabel="Guardar organización"
                secondaryLabel=""
                onSecondary={() => undefined}
              />
            </form>
          </section>

          <aside className={styles.previewCard}>
            <p>Valores iniciales</p>
            <dl>
              <div>
                <dt>Acreedor o vendedor</dt>
                <dd>{organization.name || "Sin nombre"}</dd>
              </div>
              <div>
                <dt>Recibido por</dt>
                <dd>{organization.defaultRecipient || "Se completará al preparar el recibo"}</dd>
              </div>
            </dl>
          </aside>
        </div>
      )}

      {view === "customers" && (
        <div className={styles.twoColumn}>
          <section className={styles.card} aria-labelledby="customer-form-title">
            <CardHeading
              eyebrow={customerForm.id ? "Editar" : "Nuevo"}
              id="customer-form-title"
              title={customerForm.id ? "Actualizar cliente" : "Agregar cliente"}
              description="Guarda los datos que utilizas al preparar documentos."
            />
            <form className={styles.form} onSubmit={saveCustomer}>
              <DirectoryField
                id="customer-name"
                label="Nombre completo"
                value={customerForm.name}
                onChange={(value) =>
                  setCustomerForm((current) => ({ ...current, name: value }))
                }
                required
              />
              <DirectoryField
                id="customer-phone"
                label="Teléfono"
                value={customerForm.phone}
                onChange={(value) =>
                  setCustomerForm((current) => ({ ...current, phone: value }))
                }
              />
              <DirectoryField
                id="customer-email"
                label="Correo"
                type="email"
                value={customerForm.email}
                onChange={(value) =>
                  setCustomerForm((current) => ({ ...current, email: value }))
                }
              />
              <FormActions
                primaryLabel={customerForm.id ? "Actualizar cliente" : "Guardar cliente"}
                secondaryLabel={customerForm.id ? "Cancelar" : ""}
                onSecondary={() => setCustomerForm(EMPTY_CUSTOMER)}
              />
            </form>
          </section>

          <ProfileList
            emptyText="Agrega tu primer cliente para utilizarlo en cálculos y documentos."
            title={`Clientes · ${customers.length}`}
          >
            {customers.map((customer) => (
              <article className={styles.profileRow} key={customer.id}>
                <div>
                  <strong>{customer.name}</strong>
                  <span>{[customer.phone, customer.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span>
                </div>
                <RowActions
                  editLabel={`Editar a ${customer.name}`}
                  removeLabel={`Eliminar a ${customer.name}`}
                  onEdit={() => editCustomer(customer)}
                  onRemove={() => removeCustomer(customer)}
                />
              </article>
            ))}
          </ProfileList>
        </div>
      )}

      {view === "financings" && (
        <div className={styles.twoColumn}>
          <section className={styles.card} aria-labelledby="financing-form-title">
            <CardHeading
              eyebrow={financingForm.id ? "Editar" : "Nuevo"}
              id="financing-form-title"
              title={financingForm.id ? "Actualizar financiamiento" : "Guardar financiamiento"}
              description="Crea un perfil reutilizable con el cliente y las condiciones originales."
            />
            {customers.length === 0 ? (
              <div className={styles.emptyForm}>
                <strong>Primero agrega un cliente</strong>
                <p>Los financiamientos deben estar asociados a una persona.</p>
                <button type="button" onClick={() => changeView("customers")}>
                  Agregar cliente
                </button>
              </div>
            ) : (
              <form className={`${styles.form} ${styles.financingForm}`} onSubmit={saveFinancing}>
                <DirectorySelect
                  id="financing-customer"
                  label="Cliente"
                  value={financingForm.customerId}
                  onChange={(value) =>
                    setFinancingForm((current) => ({ ...current, customerId: value }))
                  }
                  options={customers.map((customer) => ({
                    label: customer.name,
                    value: customer.id,
                  }))}
                  required
                />
                <DirectoryField
                  id="financing-reference"
                  label="Lote o cuenta"
                  value={financingForm.accountReference}
                  onChange={(value) =>
                    setFinancingForm((current) => ({
                      ...current,
                      accountReference: value,
                    }))
                  }
                  required
                />
                <DirectoryField
                  id="financing-name"
                  label="Nombre del perfil"
                  value={financingForm.name}
                  onChange={(value) =>
                    setFinancingForm((current) => ({ ...current, name: value }))
                  }
                  placeholder="María · Lote 39"
                  hint="Opcional"
                />
                <DirectoryField
                  id="financing-price"
                  label="Precio total"
                  type="number"
                  value={financingForm.price}
                  onChange={(value) =>
                    setFinancingForm((current) => ({ ...current, price: value }))
                  }
                  required
                />
                <DirectoryField
                  id="financing-down-payment"
                  label="Enganche"
                  type="number"
                  value={financingForm.downPayment}
                  onChange={(value) =>
                    setFinancingForm((current) => ({
                      ...current,
                      downPayment: value,
                    }))
                  }
                  required
                />
                <DirectoryField
                  id="financing-rate"
                  label="Interés anual (%)"
                  type="number"
                  value={financingForm.annualRate}
                  onChange={(value) =>
                    setFinancingForm((current) => ({
                      ...current,
                      annualRate: value,
                    }))
                  }
                  required
                />
                <DirectoryField
                  id="financing-term"
                  label="Plazo (meses)"
                  type="number"
                  value={financingForm.termMonths}
                  onChange={(value) =>
                    setFinancingForm((current) => ({
                      ...current,
                      termMonths: value,
                    }))
                  }
                  required
                />
                <DirectoryField
                  id="financing-first-payment"
                  label="Primera cuota"
                  type="date"
                  value={financingForm.firstDueDate}
                  onChange={(value) =>
                    setFinancingForm((current) => ({
                      ...current,
                      firstDueDate: value,
                    }))
                  }
                  hint="Opcional"
                />
                <FormActions
                  primaryLabel={financingForm.id ? "Actualizar perfil" : "Guardar perfil"}
                  secondaryLabel={financingForm.id ? "Cancelar" : ""}
                  onSecondary={() => setFinancingForm(EMPTY_FINANCING)}
                />
              </form>
            )}
          </section>

          <ProfileList
            emptyText="Guarda un financiamiento para completar el cotizador y los documentos con una sola selección."
            title={`Financiamientos · ${financings.length}`}
          >
            {financings.map((financing) => {
              const customer = data.customers.find(
                (item) => item.id === financing.customerId,
              );
              return (
                <article className={styles.profileRow} key={financing.id}>
                  <div>
                    <strong>{financing.name}</strong>
                    <span>
                      {customer?.name ?? "Cliente"} · {formatCurrency(financing.price)} · {financing.annualRate}% · {financing.termMonths} meses
                    </span>
                  </div>
                  <RowActions
                    editLabel={`Editar ${financing.name}`}
                    removeLabel={`Eliminar ${financing.name}`}
                    onEdit={() => editFinancing(financing)}
                    onRemove={() => removeFinancing(financing)}
                  />
                </article>
              );
            })}
          </ProfileList>
        </div>
      )}
    </section>
  );

  function changeView(nextView: DirectoryView) {
    setView(nextView);
    setNotice("");
  }
}

function TabButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
    >
      {label}
      <span>{count}</span>
    </button>
  );
}

function CardHeading({
  description,
  eyebrow,
  id,
  title,
}: {
  description: string;
  eyebrow: string;
  id: string;
  title: string;
}) {
  return (
    <header className={styles.cardHeading}>
      <p>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <span>{description}</span>
    </header>
  );
}

function DirectoryField({
  hint,
  id,
  label,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value,
}: {
  hint?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "date" | "email" | "number" | "text";
  value: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <small>{hint}</small>}
    </div>
  );
}

function DirectorySelect({
  id,
  label,
  onChange,
  options,
  required,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  required?: boolean;
  value: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      <select
        id={id}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Seleccionar</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function FormActions({
  onSecondary,
  primaryLabel,
  secondaryLabel,
}: {
  onSecondary: () => void;
  primaryLabel: string;
  secondaryLabel: string;
}) {
  return (
    <div className={styles.formActions}>
      {secondaryLabel && (
        <button type="button" onClick={onSecondary}>{secondaryLabel}</button>
      )}
      <button type="submit">{primaryLabel}</button>
    </div>
  );
}

function ProfileList({
  children,
  emptyText,
  title,
}: {
  children: React.ReactNode;
  emptyText: string;
  title: string;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className={styles.listCard} aria-label={title}>
      <h2>{title}</h2>
      <div className={styles.profileList}>
        {hasChildren ? children : <p className={styles.emptyList}>{emptyText}</p>}
      </div>
    </section>
  );
}

function RowActions({
  editLabel,
  onEdit,
  onRemove,
  removeLabel,
}: {
  editLabel: string;
  onEdit: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className={styles.rowActions}>
      <button type="button" aria-label={editLabel} onClick={onEdit}>Editar</button>
      <button type="button" aria-label={removeLabel} onClick={onRemove}>Eliminar</button>
    </div>
  );
}

function formatAccountReference(value: string): string {
  return /^lote\b/i.test(value) ? value : `Lote ${value}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(value);
}
