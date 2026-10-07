import { expect, test, type Page } from '@playwright/test';

// Phase 9 exit: overspending in one town raises its prices, and reaching a town a month later
// moves the party's crowns with the economic climate. The curves themselves are unit tested, and
// `pnpm economy` checks that no death spiral can lock a party out.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function start(page: Page) {
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
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('economy-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
}

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

const purse = async (page: Page) =>
  Number((await page.locator('.world-bar').innerText()).match(/Purse: ([\d.]+) crown/)?.[1]);

test('overspending in Rubblegate raises its prices', async ({ page }, testInfo) => {
  await start(page);
  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  await page.getByRole('tab', { name: 'Shop', exact: true }).click();
  const item = page.getByRole('combobox', { name: 'Item' });
  await expect(item.locator('option', { hasText: 'Crowbar (4 crowns)' })).toHaveCount(1);
  // Twice the town's spending threshold already spent this month: half again on every price.
  await edit(page, `save.towns.westhold = { spent: 3000, looted: 0, since: save.day };`);
  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  await page.getByRole('tab', { name: 'Shop', exact: true }).click();
  await expect(item.locator('option', { hasText: 'Crowbar (6 crowns)' })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('economy-prices.png'), fullPage: true });
});

test('a month later, coming back to town moves the purse with the climate', async ({ page }) => {
  await start(page);
  // A month and more on the road, one hex out of Rubblegate.
  await edit(
    page,
    `save.day += 31;
     save.position = { col: 4, row: 8 };
     save.visited.push('4,8');`,
  );
  const before = await purse(page);
  await page.locator('[data-hex="3,8"]').click();
  await page.getByRole('button', { name: /^(Hike|Camp)$/ }).click();
  const log = page.getByRole('region', { name: 'Journey log' });
  await expect(log).toContainText('The economic climate moves the purse');
  expect(await purse(page)).not.toBe(before);
});
