import { expect, test, type Page } from '@playwright/test';

// Phase 12e: a ruin is generated on the first visit, the same layout comes back after a reload,
// and its first level is a valid, walkable dungeon.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function edit(page: Page, change: string) {
  await page.evaluate(
    ([key, body]) => {
      const save = JSON.parse(localStorage.getItem(key as string) as string);
      new Function('save', body as string)(save);
      localStorage.setItem(key as string, JSON.stringify(save));
    },
    [WORLD_KEY, change],
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
}

test('enters the Sunken Chapel, and finds the same ruin after a reload', async ({
  page,
}, testInfo) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('link', { name: 'Overland' }).click();
  // The arena has a formation of its own: wait for the Overland page before picking slots.
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('ruins-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await edit(page, `save.position = { col: 2, row: 10 }; save.visited.push('2,10');`);
  await expect(page.locator('[data-hex="2,10"] .dungeon')).toBeVisible();
  await page.getByRole('button', { name: 'Enter The Sunken Chapel' }).click();
  const bar = page.locator('.world-bar');
  await expect(bar).toContainText('The Sunken Chapel, level 1');
  await page.screenshot({ path: testInfo.outputPath('ruin.png'), fullPage: true });
  const seed = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) as string).ruins['sunken-chapel'].seed,
    WORLD_KEY,
  );
  const map = await page.getByRole('img', { name: 'Dungeon view' }).screenshot();
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(bar).toContainText('The Sunken Chapel, level 1');
  expect(await page.getByRole('img', { name: 'Dungeon view' }).screenshot()).toEqual(map);
  const again = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) as string).ruins['sunken-chapel'].seed,
    WORLD_KEY,
  );
  expect(again).toBe(seed);
});
