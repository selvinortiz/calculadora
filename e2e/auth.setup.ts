import { mkdir } from "node:fs/promises";
import { expect, test as setup } from "@playwright/test";

const authFile = "playwright/.auth/owner.json";

setup("authenticate local owner", async ({ page }) => {
  await page.goto("/acceso");
  await page.getByLabel(/correo/i).fill("owner@local.test");
  await page.getByLabel(/contraseña/i).fill("Local-demo-12345");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await mkdir("playwright/.auth", { recursive: true });
  await page.context().storageState({ path: authFile });
});
