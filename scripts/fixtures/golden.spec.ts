import { expect, test } from "@playwright/test";

test("records a tiny deterministic browser flow", async ({ page }) => {
  await page.setContent(`
    <!doctype html>
    <title>Covallaby golden fixture</title>
    <style>body{font:16px system-ui;padding:32px}button{padding:8px 12px}</style>
    <h1>Browser evidence</h1>
    <button type="button">Run check</button>
    <output aria-live="polite">Ready</output>
    <script>document.querySelector('button').onclick=()=>document.querySelector('output').textContent='Covered';</script>
  `);
  await page.getByRole("button", { name: "Run check" }).click();
  await expect(page.getByText("Covered")).toBeVisible();
});
