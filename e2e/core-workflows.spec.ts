import { expect, test } from "@playwright/test";

test("serves a nonce-based content security policy", async ({ page }) => {
  const response = await page.goto("/");
  if (!response) throw new Error("The portal did not return a document response.");
  const policy = response.headers()["content-security-policy"] || "";
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).toContain("style-src 'self' 'nonce-");
  expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
});

test("uses persisted installment values in the adjustment workflow", async ({ page }) => {
  await page.goto("/ajustes");
  const financing = page.getByLabel("Financiamiento");
  await financing.selectOption({ index: 1 });
  const scheduledPayment = page.getByLabel("Cuota programada");
  await expect(scheduledPayment).toHaveAttribute("readonly", "");
  await expect(scheduledPayment).not.toHaveValue("");
});

test("allows editing only the latest posted operation and restores dialog focus", async ({ page }) => {
  await page.goto("/financiamientos");
  await page.getByRole("link", { name: /ver financiamiento/i }).first().click();
  const editButtons = page.getByRole("button", { name: "Editar" });
  await expect(editButtons).toHaveCount(1);
  await editButtons.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(editButtons).toBeFocused();
});

test("keeps primary navigation and customer cards usable on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/clientes");
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
  await expect(page.getByRole("link", { name: /nuevo cliente/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal móvil" })).toBeVisible();

  const menu = page.getByRole("button", { name: "Menú" });
  const menuBox = await menu.boundingBox();
  expect(menuBox?.height).toBeGreaterThanOrEqual(44);
  const primaryLinks = page.getByRole("navigation", { name: "Navegación principal móvil" }).getByRole("link");
  await expect(primaryLinks).toHaveCount(3);
  for (const link of await primaryLinks.all()) {
    const box = await link.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  const search = page.getByLabel("Buscar clientes");
  expect(await search.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Administración móvil" })).toBeVisible();
  await expect(page.getByRole("button", { name: /cerrar sesión/i })).toBeVisible();
});

test("avoids the intermediate-width sidebar squeeze", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.setViewportSize({ width: 840, height: 900 });
  await page.goto("/financiamientos/nuevo");
  await expect(page.getByRole("navigation", { name: "Navegación principal móvil" })).toBeVisible();

  const price = page.getByLabel("Precio total");
  const downPayment = page.getByLabel("Enganche");
  const [priceBox, downPaymentBox] = await Promise.all([price.boundingBox(), downPayment.boundingBox()]);
  expect(priceBox?.width).toBeGreaterThan(160);
  expect(downPaymentBox?.width).toBeGreaterThan(160);
  expect(await price.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("presents audit activity without raw implementation data", async ({ page }) => {
  await page.goto("/configuracion/auditoria");
  await expect(page.getByRole("heading", { name: "Auditoría" })).toBeVisible();
  await expect(page.getByRole("search")).toBeVisible();
  await expect(page.getByText("loan.posted")).toHaveCount(0);
  await expect(page.locator("code")).toHaveCount(0);
});

test("keeps access management searchable and keyboard accessible", async ({ page }) => {
  await page.goto("/configuracion/accesos");
  await expect(page.getByRole("heading", { name: "Accesos" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Lista de accesos" })).toBeVisible();

  const newAccess = page.getByRole("button", { name: "Nuevo acceso" });
  await newAccess.click();
  await expect(page.getByRole("dialog", { name: "Crear operador" })).toBeVisible();
  await expect(page.getByLabel("Nombre")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(newAccess).toBeFocused();

  await page.getByLabel("Buscar accesos").fill("sin coincidencia");
  await expect(page.getByRole("heading", { name: "No encontramos accesos" })).toBeVisible();
  await expect(page.getByText("0 de 1 usuarios")).toBeVisible();
  await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
  await expect(page.getByRole("region", { name: "Lista de accesos" })).toBeVisible();
});
