import { expect, test } from '@playwright/test';
import { openWindow } from './windows.ts';

// Tabula Rasa (docs/rules-adaptation.md, Potions: Tabula Rasa): Snag, at 3rd level's XP, drinks
// it and makes his 1st-level picks anew in the dialog. The rules are unit tested.
const starters = ['snag', 'fizzwick'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

test('drinks Tabula Rasa: picks made anew, the dose gone, and the XP kept', async ({ page }) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page
    .getByRole('combobox', { name: 'Front row, slot 2' })
    .selectOption({ label: 'Fizzwick' });
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await expect(page.getByRole('region', { name: 'Party' })).toContainText('Fizzwick');
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    const snag = save.members[0].character;
    snag.xp = 6;
    snag.inventory.push({ id: 'tabula-rasa', quantity: 1, location: 'stowed' });
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();

  const potions = await openWindow(page, 'Potions');
  await potions
    .getByRole('group', { name: 'Tabula Rasa' })
    .getByRole('button', { name: 'Drink' })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Tabula Rasa: Snag' });
  await expect(dialog).toContainText('Background: Raider');
  const begin = dialog.getByRole('button', { name: 'Drink and begin anew' });
  await expect(begin).toBeDisabled();
  // Closing keeps the dose.
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(potions.getByRole('group', { name: 'Tabula Rasa' })).toBeVisible();

  await potions
    .getByRole('group', { name: 'Tabula Rasa' })
    .getByRole('button', { name: 'Drink' })
    .first()
    .click();
  await dialog.getByRole('combobox', { name: 'Learning pick 1' }).selectOption({ index: 2 });
  await dialog.getByRole('combobox', { name: 'Learning pick 2' }).selectOption({ index: 3 });
  // Snag's own picks again: Alert, Armsmaster, and Lucky.
  await dialog.getByRole('combobox', { name: 'Racial focus' }).selectOption({ label: 'Alert' });
  await dialog
    .getByRole('combobox', { name: 'Combat focus' })
    .selectOption({ label: 'Armsmaster' });
  await dialog.getByRole('combobox', { name: 'Any focus' }).selectOption({ label: 'Lucky' });
  await dialog.getByRole('combobox', { name: 'Free skill' }).selectOption({ label: 'Notice' });
  await expect(begin).toBeEnabled();
  await begin.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'Snag drinks Tabula Rasa, and is 1st level again',
  );
  await expect(potions.getByRole('group', { name: 'Tabula Rasa' })).toHaveCount(0);
  const snag = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) as string).members[0].character,
    WORLD_KEY,
  );
  expect(snag.xp).toBe(6);
  expect(snag.classes.levels).toEqual({ 'full-warrior': 1 });
});
