import { expect, test } from '@playwright/test';

// The title screen: a first visit sets out with the starter party in one press, and a return
// visit continues, with a second press asked before a new journey replaces the save.
test('starts with the starter party, then continues', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Wastes Crawler', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Continue journey/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^New journey with the starter party/ }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
  await expect(page).toHaveURL(/#\/world$/);

  await page.goto('/');
  await page.getByRole('button', { name: /^New journey with the starter party/ }).click();
  await expect(page.getByRole('button', { name: 'Replace slot 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep' }).click();
  await page.getByRole('button', { name: /^Continue journey/ }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
});

test('links to the Characters page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Make your own characters' }).click();
  await expect(page.getByRole('heading', { name: 'Characters' })).toBeVisible();
  await expect(page.getByLabel('Import character files')).toBeVisible();
});

test('asks before a new world replaces a save', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^New journey with the starter party/ }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await page.goto('/#/world');
  await page.reload();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Start a new world (replaces the save)' }).click();
  await page.getByRole('button', { name: 'Keep' }).click();
  await expect(page.getByRole('button', { name: /^Continue journey/ })).toBeVisible();
});
