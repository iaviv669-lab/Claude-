import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Every test fails on console errors or uncaught exceptions. */
export const test = base.extend<{ errors: string[] }>({
  errors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function axe(page: Page, name: string) {
  await page.waitForTimeout(350); // let colour transitions settle
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const v = r.violations.map((x) => `${name}: ${x.id} (${x.impact}) ${x.nodes.length}× e.g. ${x.nodes[0]?.target.join(' ')}`);
  expect(v, `axe on ${name}`).toEqual([]);
}

export async function onboard(page: Page, unit: 'Kilograms' | 'Pounds' = 'Kilograms') {
  await page.goto('/');
  await page.getByRole('radio', { name: unit }).click();
  await page.getByRole('button', { name: 'Start training' }).click();
  await expect(page.getByText('No saved workouts yet')).toBeVisible();
}

export async function quickStartWith(page: Page, names: string[]) {
  await page.getByRole('button', { name: 'Quick start' }).click();
  await page.getByRole('button', { name: 'Add exercises' }).click();
  for (const n of names) {
    await page.getByRole('textbox', { name: 'Search exercises' }).fill(n);
    await page.getByRole('button', { name: new RegExp(`^${n}`) }).first().click();
  }
  await page.getByRole('button', { name: /^Add \d exercise/ }).click();
}

export async function logSet(scope: Page | ReturnType<Page['locator']>, n: number, w: string, r: string) {
  await scope.getByLabel(`Set ${n} weight`, { exact: true }).fill(w);
  await scope.getByLabel(`Set ${n} reps`, { exact: true }).fill(r);
  await scope.getByRole('button', { name: `Complete set ${n}` }).click();
}

export async function finish(page: Page) {
  await page.getByRole('button', { name: 'Finish' }).click();
  const dlg = page.getByRole('alertdialog');
  if (await dlg.isVisible().catch(() => false)) await dlg.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Workout done')).toBeVisible();
}
