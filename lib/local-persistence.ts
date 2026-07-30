export const LOCAL_PERSISTENCE_VERSION = 1;
export const LOCAL_PERSISTENCE_EVENT = "calculacuota:persistence-change";

const MAX_CUSTOMERS = 200;
const MAX_FINANCINGS = 200;

export type OrganizationProfile = {
  name: string;
  defaultRecipient: string;
};

export type CustomerProfile = {
  id: string;
  name: string;
  phone: string;
  email: string;
  updatedAt: string;
};

export type FinancingProfile = {
  id: string;
  name: string;
  customerId: string;
  accountReference: string;
  price: number;
  downPayment: number;
  annualRate: number;
  termMonths: number;
  firstDueDate: string;
  updatedAt: string;
};

export type LocalPersistenceData = {
  version: typeof LOCAL_PERSISTENCE_VERSION;
  organization: OrganizationProfile | null;
  customers: CustomerProfile[];
  financings: FinancingProfile[];
};

export function createEmptyPersistenceData(): LocalPersistenceData {
  return {
    version: LOCAL_PERSISTENCE_VERSION,
    organization: null,
    customers: [],
    financings: [],
  };
}

export function createLocalPersistenceKey(scope: string): string {
  const normalizedScope = scope.normalize("NFKC").trim().toLocaleLowerCase("en-US");
  return `calculacuota:persistence:v${LOCAL_PERSISTENCE_VERSION}:${encodeURIComponent(normalizedScope)}`;
}

export function parseLocalPersistenceData(rawValue: string | null): LocalPersistenceData {
  if (!rawValue) return createEmptyPersistenceData();

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!isRecord(parsed) || parsed.version !== LOCAL_PERSISTENCE_VERSION) {
      return createEmptyPersistenceData();
    }

    const customers = Array.isArray(parsed.customers)
      ? parsed.customers
          .map(parseCustomer)
          .filter((customer): customer is CustomerProfile => customer !== null)
          .slice(0, MAX_CUSTOMERS)
      : [];
    const customerIds = new Set(customers.map((customer) => customer.id));
    const financings = Array.isArray(parsed.financings)
      ? parsed.financings
          .map(parseFinancing)
          .filter(
            (financing): financing is FinancingProfile =>
              financing !== null && customerIds.has(financing.customerId),
          )
          .slice(0, MAX_FINANCINGS)
      : [];

    return {
      version: LOCAL_PERSISTENCE_VERSION,
      organization: parseOrganization(parsed.organization),
      customers: uniqueById(customers),
      financings: uniqueById(financings),
    };
  } catch {
    return createEmptyPersistenceData();
  }
}

export function serializeLocalPersistenceData(data: LocalPersistenceData): string {
  return JSON.stringify(data);
}

export function createPersistenceId(prefix: "customer" | "financing"): string {
  const randomId = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomId}`;
}

function parseOrganization(value: unknown): OrganizationProfile | null {
  if (!isRecord(value)) return null;

  const name = parseString(value.name, 100);
  if (!name) return null;

  return {
    name,
    defaultRecipient: parseString(value.defaultRecipient, 80),
  };
}

function parseCustomer(value: unknown): CustomerProfile | null {
  if (!isRecord(value)) return null;

  const id = parseString(value.id, 120);
  const name = parseString(value.name, 120);
  if (!id || !name) return null;

  return {
    id,
    name,
    phone: parseString(value.phone, 40),
    email: parseString(value.email, 254),
    updatedAt: parseIsoTimestamp(value.updatedAt),
  };
}

function parseFinancing(value: unknown): FinancingProfile | null {
  if (!isRecord(value)) return null;

  const id = parseString(value.id, 120);
  const name = parseString(value.name, 120);
  const customerId = parseString(value.customerId, 120);
  const accountReference = parseString(value.accountReference, 80);
  const price = parseNumber(value.price, 0, 1_000_000_000);
  const downPayment = parseNumber(value.downPayment, 0, price ?? 0);
  const annualRate = parseNumber(value.annualRate, 0, 100);
  const termMonths = parseInteger(value.termMonths, 2, 360);

  if (
    !id ||
    !name ||
    !customerId ||
    !accountReference ||
    price === null ||
    downPayment === null ||
    annualRate === null ||
    termMonths === null
  ) {
    return null;
  }

  return {
    id,
    name,
    customerId,
    accountReference,
    price,
    downPayment,
    annualRate,
    termMonths,
    firstDueDate: parseDate(value.firstDueDate),
    updatedAt: parseIsoTimestamp(value.updatedAt),
  };
}

function parseString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.normalize("NFKC").trim().slice(0, maxLength) : "";
}

function parseNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null;
}

function parseInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  const parsed = parseNumber(value, minimum, maximum);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function parseDate(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : "";
}

function parseIsoTimestamp(value: unknown): string {
  if (typeof value !== "string") return new Date(0).toISOString();
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : new Date(0).toISOString();
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
