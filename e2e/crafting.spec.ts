import { expect, test, type Page } from '@playwright/test';

// Phase 10: crafting. Fizzwick (Craft-0 and the Artisan focus) builds gear at Westhold's workshop,
// and stays behind to finish a mastercrafted weapon. The rules are unit tested.
const starters = ['snag', 'fizzwick'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function start(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('link', { name: 'Overland' }).click();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page
    .getByRole('combobox', { name: 'Front row, slot 2' })
    .selectOption({ label: 'Fizzwick' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('crafting-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  // Enough crowns for a mastercrafted spear and the rent.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.purse = 200;
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page.getByRole('button', { name: 'Visit Westhold' }).click();
  await page.getByRole('tab', { name: 'Workshop' }).click();
}

test('builds a crowbar in a day, then leaves the crafter to finish a mastercrafted spear', async ({
  page,
}, testInfo) => {
  await start(page);
  const log = page.getByRole('region', { name: 'Journey log' });
  const make = page.getByRole('region', { name: 'Make' });
  await make.getByRole('combobox', { name: 'Make' }).selectOption({ label: 'Crowbar' });
  await make.getByRole('button', { name: /^Start \(4 crowns, 1 day\)$/ }).click();
  await expect(log).toContainText('Fizzwick starts on a Crowbar: 1 day of work.');
  await page.getByRole('button', { name: 'Work a day and sleep at the inn' }).click();
  await expect(log).toContainText('Fizzwick finishes the Crowbar.');

  await make.getByRole('combobox', { name: 'Make' }).selectOption({ label: 'Spear, Light' });
  await make.getByRole('combobox', { name: 'Quality' }).selectOption('mastercrafted');
  await make.getByRole('button', { name: /^Start \(50 crowns, 14 days\)$/ }).click();
  const underway = page.getByRole('region', { name: 'Under way' });
  await expect(underway).toContainText('Fizzwick: mastercrafted Spear, Light, 14 days left');
  await page.screenshot({ path: testInfo.outputPath('workshop.png'), fullPage: true });
  await underway.getByRole('button', { name: 'Stay to finish it' }).click();
  await expect(underway).toContainText('at the workshop in Westhold');
  await expect(log).toContainText('Fizzwick stays at the workshop in Westhold');

  await page.getByRole('tab', { name: 'Shop', exact: true }).click();
  await expect(page.getByRole('region', { name: "Snag's pack" })).toBeVisible();
  await page.getByRole('tab', { name: 'Tavern' }).click();
  const tavern = page.locator('.tavern-list li', { hasText: 'Fizzwick' });
  await tavern.getByRole('button', { name: 'Rejoin' }).click();
  await expect(page.locator('.town-message')).toContainText('still at work in the workshop');
});

// Phase 10b: a mod paid in loot dice and built at the workshop, then kept up each night.
test('builds Customized onto a spear and keeps it maintained', async ({ page }, testInfo) => {
  await start(page);
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.loot = [{ count: 8, sides: 6 }];
    save.components = { 'cold-iron': 1 };
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page.getByRole('button', { name: 'Visit Westhold' }).click();
  await page.getByRole('tab', { name: 'Workshop' }).click();

  const mods = page.getByRole('region', { name: 'Mods' });
  await mods
    .getByRole('combobox', { name: 'Item' })
    .selectOption({ label: 'Snag: Spear, Light (readied)' });
  await mods.getByRole('combobox', { name: 'Mod' }).selectOption({ label: 'Customized (Craft-1)' });
  await expect(
    mods.getByRole('button', { name: 'Build Customized, dice in crowns (36 crowns)' }),
  ).toBeVisible();
  await mods.getByRole('button', { name: 'Build Customized', exact: true }).click();
  const log = page.getByRole('region', { name: 'Journey log' });
  await expect(log).toContainText(
    "Fizzwick starts building Customized onto Snag's Spear, Light: 4 days",
  );
  await expect(page.getByRole('region', { name: 'Components' })).toContainText('Cold iron ×1');
  await expect(page.locator('.world-bar')).toContainText('Loot: 2d6');
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Work a day and sleep at the inn' }).click();
  await expect(log).toContainText('Fizzwick finishes Customized on the Spear, Light.');
  const upkeep = page.getByRole('region', { name: 'Maintenance' });
  await expect(upkeep).toContainText('Fizzwick can maintain 4');
  await expect(upkeep).toContainText('Snag: Spear, Light (Customized, readied)');
  await page.screenshot({ path: testInfo.outputPath('mods.png'), fullPage: true });
});
