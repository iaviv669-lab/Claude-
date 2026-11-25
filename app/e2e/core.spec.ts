import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const SHOTS = process.env.SHOTS;
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

async function onboard(page: Page, unit: 'Kilograms' | 'Pounds' = 'Kilograms') {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start training' })).toBeVisible();
  await shot(page, '01-onboarding');
  await page.getByRole('radio', { name: unit }).click();
  await page.getByRole('button', { name: 'Start training' }).click();
  await expect(page.getByText('No saved workouts yet')).toBeVisible();
  await shot(page, '02-home-empty');
}

async function addExercise(page: Page, name: string) {
  await page.getByRole('button', { name: /Add (exercise|exercises|your first)/ }).first().click();
  await page.getByRole('textbox', { name: 'Search exercises' }).fill(name);
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  await page.getByRole('button', { name: /^Add 1 exercise/ }).click();
}

test('F02 quick workout: log, rest, finish, summary, history', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Quick start' }).click();
  await expect(page.getByText('Add your first exercise')).toBeVisible();
  await addExercise(page, 'Back Squat');
  await expect(page.getByRole('heading', { name: 'Back Squat' })).toBeVisible();
  await page.getByLabel('Set 1 weight', { exact: true }).fill('100');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Complete set 1' }).click();
  await expect(page.getByRole('button', { name: /Rest .* left/ })).toBeVisible(); // rest started
  await page.getByLabel('Set 2 weight', { exact: true }).fill('100');
  await page.getByLabel('Set 2 reps', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Complete set 2' }).click();
  await expect(page.getByRole('button', { name: 'Untick set 2' })).toBeVisible();
  await shot(page, '03-logger');

  // survives reload mid-workout
  await page.reload();
  await expect(page.getByRole('button', { name: 'Untick set 2' })).toBeVisible();

  // rest sheet
  await page.getByRole('button', { name: /Rest .* left/ }).click();
  await expect(page.getByRole('dialog', { name: 'Rest timer' })).toBeVisible();
  await shot(page, '04-rest');
  await page.getByRole('button', { name: 'Skip' }).click();

  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('1 unticked set');
  await page.getByRole('button', { name: 'Finish', exact: true }).last().click();
  await expect(page.getByText('Workout done')).toBeVisible();
  await expect(page.getByText('100 kg × 5').first()).toBeVisible();
  await shot(page, '05-summary');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('Quick workout')).toBeVisible();
  await expect(page.getByText(/2 sets/)).toBeVisible();
  await shot(page, '06-history');
});

test('F03 + F01 build a workout, start it, prefill from last time, plates, PR', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'New workout' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Upper A');
  await page.getByRole('button', { name: 'Add exercises' }).click();
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('bench');
  await page.getByRole('button', { name: /^Barbell Bench Press/ }).click();
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('row');
  await page.getByRole('button', { name: /^Barbell Row/ }).click();
  await page.getByRole('button', { name: 'Add 2 exercises' }).click();
  await page.getByRole('button', { name: 'Options for Barbell Bench Press' }).click();
  await page.getByText('Superset with the one below').click();
  await shot(page, '07-builder');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
  await shot(page, '08-preview');

  // session 1
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByText('Superset: alternate')).toBeVisible();
  const bench = page.locator('section', { has: page.getByRole('heading', { name: 'Barbell Bench Press' }) });
  await bench.getByLabel('Set 1 weight', { exact: true }).fill('60');
  await bench.getByLabel('Set 1 reps', { exact: true }).fill('8');
  await bench.getByRole('button', { name: 'Complete set 1' }).click();
  // mid-superset: no rest yet
  await expect(page.getByRole('button', { name: 'Rest timer' })).toBeVisible();
  const row = page.locator('section', { has: page.getByRole('heading', { name: 'Barbell Row' }) });
  await row.getByLabel('Set 1 weight', { exact: true }).fill('50');
  await row.getByLabel('Set 1 reps', { exact: true }).fill('10');
  await row.getByRole('button', { name: 'Complete set 1' }).click();
  await expect(page.getByRole('button', { name: /Rest .* left/ })).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).last().click();
  await page.getByRole('button', { name: 'Done' }).click();

  // session 2: prefilled, plate calc, heavier = PR
  await page.getByRole('button', { name: /Upper A/ }).first().click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  const bench2 = page.locator('section', { has: page.getByRole('heading', { name: 'Barbell Bench Press' }) });
  await expect(bench2.getByLabel('Set 1 weight', { exact: true })).toHaveValue('60');
  await bench2.getByRole('button', { name: 'Plate calculator' }).first().click();
  await page.getByLabel(/Total on the bar/).fill('62.5');
  await expect(page.getByText('20 + 1.25 kg per side')).toBeVisible();
  await shot(page, '09-plates');
  await page.getByRole('button', { name: 'Use 62.5 kg' }).click();
  await expect(bench2.getByLabel('Set 1 weight', { exact: true })).toHaveValue('62.5');
  await bench2.getByRole('button', { name: 'Complete set 1' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).last().click();
  await expect(page.getByText('New records')).toBeVisible();
  await shot(page, '10-summary-pr');
});

test('progress and exercise charts render after a workout', async ({ page }) => {
  await onboard(page, 'Pounds');
  await page.getByRole('button', { name: 'Quick start' }).click();
  await addExercise(page, 'Deadlift');
  await page.getByLabel('Set 1 weight', { exact: true }).fill('225');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Complete set 1' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).last().click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByText('Sets per muscle this week')).toBeVisible();
  await expect(page.getByText('Glutes')).toBeVisible();
  await shot(page, '11-progress');
  await page.getByRole('button', { name: /Deadlift/ }).click();
  await expect(page.getByText('Best est. 1RM')).toBeVisible();
  await expect(page.getByText('225 lb').first()).toBeVisible();
  await shot(page, '12-exercise');
});

test('custom exercise and dark theme', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText('New exercise').click();
  await page.getByLabel('Name', { exact: true }).fill('Landmine Press');
  await page.getByRole('button', { name: 'Front delts' }).click();
  await page.getByRole('button', { name: 'Chest', exact: true }).click();
  await page.getByRole('button', { name: 'Main · Chest' }).click(); // second tap → secondary
  await page.getByRole('button', { name: 'Barbell', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Landmine Press' })).toBeVisible();
  await expect(page.getByText('Also: Chest')).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await shot(page, '13-settings-dark');
});
