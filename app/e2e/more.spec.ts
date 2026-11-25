import { axe, expect, finish, logSet, onboard, quickStartWith, test } from './fixtures';

test('F05 swap mid-workout keeps ticked sets on the old exercise', async ({ page }) => {
  await onboard(page);
  await quickStartWith(page, ['Barbell Bench Press']);
  await logSet(page, 1, '60', '8');
  await page.getByRole('button', { name: 'Options for Barbell Bench Press' }).click();
  await page.getByText('Swap exercise').click();
  await expect(page.getByRole('dialog', { name: 'Swap for…' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Dumbbell Bench Press/ }).first()).toBeVisible(); // a core lift is suggested
  await page.getByRole('button', { name: 'Search all exercises' }).click();
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Dumbbell Bench Press');
  await page.getByRole('button', { name: /^Dumbbell Bench Press/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Dumbbell Bench Press' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Barbell Bench Press' })).toBeVisible();
});

test('F08 warm-ups and set types (drop set)', async ({ page }) => {
  await onboard(page);
  await quickStartWith(page, ['Back Squat']);
  await page.getByLabel('Set 1 weight', { exact: true }).fill('100');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Warm-ups' }).click();
  await expect(page.getByText('Added 3 warm-up sets')).toBeVisible();
  await expect(page.getByLabel('Set W weight')).toHaveCount(3);
  // turn set 2 into a drop set with two drops
  await page.getByRole('button', { name: /^Set 2, Normal set/ }).click();
  await page.getByRole('button', { name: /^D\s*Drop set/ }).click();
  await page.getByRole('button', { name: '+ Drop' }).click();
  await expect(page.getByRole('button', { name: 'Remove this drop' })).toHaveCount(1);
  await axe(page, 'logger');
});

test('F04 program: rotation shows the next day', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText('New program').click();
  await page.getByLabel('Name', { exact: true }).fill('PPL');
  await page.getByLabel('Name', { exact: true }).blur();
  await page.getByText('Rest day · tap to add a workout').first().click();
  await page.getByText('Build a new workout').click();
  await page.getByLabel('Name', { exact: true }).fill('Push');
  await page.getByRole('button', { name: 'Add exercises' }).click();
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Overhead Press');
  await page.getByRole('button', { name: /^Overhead Press/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Push' })).toBeVisible();
  await page.getByRole('button', { name: 'Make active' }).click();
  await page.getByRole('link', { name: 'Workouts' }).click();
  await expect(page.getByText('Next')).toBeVisible();
  await axe(page, 'workouts tab');
});

test('backup export → wipe → restore', async ({ page }) => {
  await onboard(page);
  await quickStartWith(page, ['Deadlift']);
  await logSet(page, 1, '140', '3');
  await finish(page);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export backup/ }).click();
  const file = await (await dl).path();
  await page.getByRole('button', { name: 'Delete all data' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByRole('button', { name: 'Start training' })).toBeVisible();
  await page.getByRole('button', { name: 'Start training' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Restore from backup' }).click();
  await (await chooser).setFiles(file!);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('Restored 1 workouts')).toBeVisible();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('Quick workout')).toBeVisible();
});

test('edge: double tap on ✓ does not double-log, empty reps blocked', async ({ page }) => {
  await onboard(page);
  await quickStartWith(page, ['Barbell Curl']);
  await page.getByRole('button', { name: 'Complete set 1' }).click();
  await expect(page.getByText('Enter reps first')).toBeVisible();
  await page.getByLabel('Set 1 weight', { exact: true }).fill('30');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Complete set 1' }).dblclick();
  // a double tap toggles back off; state is consistent, never two rows
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Set 4 weight', { exact: true })).toHaveCount(0);
});

test('edge: two tabs on the same workout stay in sync', async ({ page, context }) => {
  await onboard(page);
  await quickStartWith(page, ['Barbell Row']);
  const other = await context.newPage();
  await other.goto('/#/session');
  await logSet(page, 1, '70', '8');
  await expect(other.getByRole('button', { name: 'Untick set 1' })).toBeVisible();
  await expect(other.getByLabel('Set 1 weight', { exact: true })).toHaveValue('70');
});

test('edge: long names, emoji and accents', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'New workout' }).click();
  const name = 'Día de pierna 🦵 — super long workout name that keeps going and going for testing';
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Add exercises' }).click();
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('leg press');
  await page.getByRole('button', { name: /^Leg Press/ }).first().click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  const box = await page.locator('main').boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.width).toBeLessThanOrEqual(vw);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
});

test('offline: app loads with no network after first visit', async ({ page, context }) => {
  await onboard(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 10000 });
  await page.reload(); // controlled by SW now
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: 'History' })).toBeVisible();
  await context.setOffline(false);
});

test('a11y scans on main screens', async ({ page }) => {
  await page.goto('/');
  await axe(page, 'onboarding');
  await page.getByRole('button', { name: 'Start training' }).click();
  await quickStartWith(page, ['Back Squat']);
  await logSet(page, 1, '100', '5');
  await finish(page);
  await axe(page, 'summary');
  await page.getByRole('button', { name: 'Done' }).click();
  for (const [link, name] of [['Progress', 'progress'], ['History', 'history'], ['Settings', 'settings']] as const) {
    await page.getByRole('link', { name: link }).click();
    await page.waitForTimeout(200);
    await axe(page, name);
  }
  await page.goto('/#/settings/gyms'); await axe(page, 'gyms');
  await page.goto('/#/exercise/x-back-squat'); await axe(page, 'exercise detail');
  await page.goto('/#/design'); await axe(page, 'design');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await axe(page, 'design (dark)');
});

test('import history from a CSV file', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import history from CSV' }).click();
  await (await chooser).setFiles({ name: 'log.csv', mimeType: 'text/csv', buffer: Buffer.from('date,workout,exercise,weight_kg,reps\n2026-11-20,Push,Barbell Bench Press,80,5\n2026-11-20,Push,Barbell Bench Press,80,5\n') });
  await expect(page.getByText('Imported 1 workouts, 2 sets')).toBeVisible();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('Push')).toBeVisible();
});

test('B06 typing in a panel keeps focus (keyboard stays up)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Quick start' }).click();
  await page.getByRole('button', { name: 'Add exercises' }).click();
  const search = page.getByRole('textbox', { name: 'Search exercises' });
  await search.click();
  await page.keyboard.type('bench', { delay: 30 });
  await expect(search).toHaveValue('bench');
  await expect(search).toBeFocused();
  // and in the logger itself
  await page.getByRole('button', { name: /^Barbell Bench Press/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();
  const w = page.getByLabel('Set 1 weight', { exact: true });
  await w.click();
  await page.keyboard.type('102.5', { delay: 30 });
  await expect(w).toHaveValue('102.5');
  await expect(w).toBeFocused();
  // workout note sheet
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByText('Add workout note').click();
  const note = page.getByRole('textbox', { name: 'Workout note' });
  await note.click();
  await page.keyboard.type('felt strong', { delay: 20 });
  await expect(note).toHaveValue('felt strong');
  await expect(note).toBeFocused();
});

test('B07 creating an exercise mid-build keeps the workout being built', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'New workout' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Push day');
  await page.getByRole('button', { name: 'Add exercises' }).click();
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Pendlay');
  await page.getByRole('button', { name: /^Pendlay Row/ }).click();
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Zebra Press');
  await page.getByRole('button', { name: 'Create “Zebra Press”' }).click();
  const dlg = page.getByRole('dialog', { name: 'New exercise' });
  await expect(dlg.getByLabel('Name', { exact: true })).toHaveValue('Zebra Press');
  await dlg.getByRole('button', { name: 'Chest', exact: true }).click();
  await dlg.getByRole('button', { name: 'Create exercise' }).click();
  await page.getByRole('button', { name: 'Add 2 exercises' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Push day');
  await expect(page.getByText('Pendlay Row')).toBeVisible();
  await expect(page.getByText('Zebra Press')).toBeVisible();
  // leaving and coming back restores the unsaved draft
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await page.goto('/#/workout/new');
  await expect(page.getByText('Unsaved changes restored.')).toBeVisible();
  await expect(page.getByText('Zebra Press')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
});

test('library exercise shows how-to steps', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/settings/exercises');
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('zottman');
  await page.getByRole('button', { name: /Zottman Curl/ }).click();
  await expect(page.getByText('How to do it')).toBeVisible();
});

