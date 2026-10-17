import { expect, test } from '@playwright/test';
import { openStep } from './wizard.ts';

// Shop mode (SRD 1.7.7): roll 3d6 x 10 crowns, buy items sized for the people, and place them.
async function start(page: import('@playwright/test').Page, people: string, lineage?: string) {
  const select = (label: string, option: string) =>
    page.getByRole('combobox', { name: label, exact: true }).selectOption({ label: option });
  await page.goto('/#/builder');
  await select('People', people);
  if (lineage) await select('Lineage', lineage);
  const attrs = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
  await openStep(page, 'Attributes');
  for (const [i, attr] of attrs.entries()) await select(attr, String([14, 12, 11, 10, 9, 7][i]));
  await openStep(page, 'Gear');
  await page.getByRole('radio', { name: 'Roll for crowns and shop' }).check();
  await page.getByRole('button', { name: 'Roll 3d6 × 10 crowns' }).click();
  await expect(page.getByText(/Starting purse: \d+ crowns\./)).toBeVisible();
  return select;
}

test('buys small armor for a goblin and moves it between locations', async ({ page }) => {
  const select = await start(page, 'Goblin');
  await select('Item to buy', 'Dagger (3 crowns)');
  await page.getByRole('button', { name: 'Buy' }).click();
  await select('Item to buy', 'Linothorax (20 crowns)');
  await page.getByRole('button', { name: 'Buy' }).click();
  const gear = page.locator('section.step', { hasText: '8. Gear' });
  await expect(gear).toContainText('Linothorax (small)');
  const location = page.getByRole('combobox', { name: 'Location for Linothorax (small)' });
  await expect(location).toHaveValue('worn');
  await location.selectOption('stowed');
  await expect(location).toHaveValue('stowed');
  await gear.getByRole('button', { name: 'Remove' }).first().click();
  await expect(gear.locator('ul.inventory')).not.toContainText('Dagger');
});

test('lets a centaur buy barding at double cost', async ({ page }) => {
  const select = await start(page, 'Centaur', 'Goat');
  await select('Item to buy', 'War Shirt (5 crowns)');
  await page.getByLabel('As barding (double cost)').check();
  await page.getByRole('button', { name: 'Buy' }).click();
  await expect(page.locator('section.step', { hasText: '8. Gear' })).toContainText(
    'War Shirt (barding)',
  );
});
