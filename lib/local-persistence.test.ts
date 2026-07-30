import { describe, expect, it } from "vitest";
import {
  createEmptyPersistenceData,
  createLocalPersistenceKey,
  parseLocalPersistenceData,
  serializeLocalPersistenceData,
  type LocalPersistenceData,
} from "./local-persistence";

const validData: LocalPersistenceData = {
  version: 1,
  organization: {
    name: "El Jardín",
    defaultRecipient: "Oscar Herrera",
  },
  customers: [
    {
      id: "customer-maria",
      name: "María de los Ángeles Ortiz",
      phone: "",
      email: "",
      updatedAt: "2026-07-30T12:00:00.000Z",
    },
  ],
  financings: [
    {
      id: "financing-39",
      name: "María · Lote 39",
      customerId: "customer-maria",
      accountReference: "39",
      price: 65000,
      downPayment: 13000,
      annualRate: 7,
      termMonths: 60,
      firstDueDate: "2026-01-30",
      updatedAt: "2026-07-30T12:00:00.000Z",
    },
  ],
};

describe("local persistence", () => {
  it("round-trips valid profiles", () => {
    expect(parseLocalPersistenceData(serializeLocalPersistenceData(validData))).toEqual(
      validData,
    );
  });

  it("returns an empty store for malformed or unknown data", () => {
    expect(parseLocalPersistenceData("not-json")).toEqual(
      createEmptyPersistenceData(),
    );
    expect(parseLocalPersistenceData('{"version":99}')).toEqual(
      createEmptyPersistenceData(),
    );
  });

  it("drops financing profiles whose customer is missing", () => {
    const withoutCustomer = {
      ...validData,
      customers: [],
    };

    expect(
      parseLocalPersistenceData(JSON.stringify(withoutCustomer)).financings,
    ).toEqual([]);
  });

  it("scopes storage by normalized portal identity", () => {
    expect(createLocalPersistenceKey(" USER@Example.com ")).toBe(
      createLocalPersistenceKey("user@example.com"),
    );
    expect(createLocalPersistenceKey("other@example.com")).not.toBe(
      createLocalPersistenceKey("user@example.com"),
    );
  });
});
