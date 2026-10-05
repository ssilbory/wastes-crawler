import { expect, test } from '@playwright/test';

// Phase 12a: the Borderlands lead by road into the Dark Lands, where Cinderhold has its own
// craftsman and crypt.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

test('takes the east road into the Dark Lands and visits Cinderhold', async ({
  page,
}, testInfo) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('link', { name: 'Overland' }).click();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('regions-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  const bar = page.locator('.world-bar');
  await expect(bar).toContainText('The Borderlands');
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.position = { col: 23, row: 8 };
    save.visited.push('23,8');
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page.getByRole('button', { name: 'Take the east road into the Dark Lands' }).click();
  await expect(bar).toContainText('The Dark Lands');
  await expect(bar).toContainText('(0,12)');
  await page.screenshot({ path: testInfo.outputPath('dark-lands.png'), fullPage: true });

  // Six hexes east along the road to Cinderhold.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.position = { col: 6, row: 12 };
    save.visited.push('6,12');
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page.getByRole('button', { name: 'Visit Cinderhold' }).click();
  await page.getByRole('tab', { name: 'Craftsman' }).click();
  await expect(page.getByRole('heading', { name: 'Grashna Ironhand' })).toBeVisible();
  await page.getByRole('tab', { name: 'Inn and healer' }).click();
  await expect(page.getByRole('region', { name: 'Crypt' })).toContainText('elf necromancer');
});
