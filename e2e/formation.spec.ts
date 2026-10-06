import { expect, test } from '@playwright/test';

// Rearranging the formation outside combat (docs/rules-adaptation.md, Formation rules).
const starters = ['snag', 'fizzwick'].map((n) => `tools/sim/parties/starter/${n}.json`);

test('rearranges the party on the map, and the change is saved', async ({ page }) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page
    .getByRole('combobox', { name: 'Rear row, slot 1' })
    .selectOption({ label: 'Fizzwick' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('formation-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();

  const panel = page.getByRole('region', { name: 'Formation' });
  const slot = (name: string) => panel.getByRole('combobox', { name });
  // Picking Fizzwick for Snag's slot swaps the two.
  await slot('Front row, slot 1').selectOption({ label: 'Fizzwick' });
  await expect(slot('Front row, slot 1').locator('option:checked')).toHaveText('Fizzwick');
  await expect(slot('Rear row, slot 1').locator('option:checked')).toHaveText('Snag');
  // Moving Snag to an empty slot leaves his old one empty.
  await slot('Front row, slot 3').selectOption({ label: 'Snag' });
  await expect(slot('Rear row, slot 1').locator('option:checked')).toHaveText('Empty');

  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(slot('Front row, slot 1').locator('option:checked')).toHaveText('Fizzwick');
  await expect(slot('Front row, slot 3').locator('option:checked')).toHaveText('Snag');
});
