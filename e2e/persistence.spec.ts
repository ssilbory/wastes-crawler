import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Phase 11a: save slots, full saves, and the Phase 11 exit: save mid-dungeon, reload, and play on
// with identical state, the RNG included.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function party(page: Page, seed: string) {
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill(seed);
}

async function begin(page: Page, seed: string) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  // The arena has a formation of its own: wait for the Overland page before picking slots.
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await party(page, seed);
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
}

const saved = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key) as string, WORLD_KEY);

test('keeps worlds in three slots', async ({ page }) => {
  await begin(page, 'slot-one');
  await page.reload();
  const slots = page.getByRole('group', { name: 'Save slot' });
  await expect(slots).toContainText(
    'Slot 1: Morning, 1 Seedtime, year 1 (spring) · Rubblegate · Snag, Grukk',
  );
  await expect(slots).toContainText('Slot 2: Empty');
  await slots.getByRole('radio', { name: /^Slot 2/ }).check();
  await party(page, 'slot-two');
  await page.getByRole('button', { name: 'Start a new world', exact: true }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await page.locator('[data-hex="4,8"]').click();
  await page.getByRole('button', { name: /^(Hike|Camp)$/ }).click();
  await page.reload();
  await expect(slots).toContainText('Slot 1: Morning, 1 Seedtime');
  await expect(slots).toContainText('Slot 2: Day, 1 Seedtime');
  // The slot chosen last is the one continued.
  await expect(slots.getByRole('radio', { name: /^Slot 2/ })).toBeChecked();
});

test('exports a full save and loads it back, roster and all', async ({ page }, testInfo) => {
  await begin(page, 'bundle-e2e');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save' }).click();
  const file = testInfo.outputPath('wastes-crawler-save.json');
  await (await download).saveAs(file);
  expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ kind: 'wastes-crawler-save' });

  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/world');
  await page.reload();
  await expect(page.getByRole('group', { name: 'Save slot' })).toContainText('Slot 1: Empty');
  await page.getByLabel('Load a save file').setInputFiles(file);
  await expect(page.getByRole('img', { name: 'Overland map' })).toBeVisible();
  await page.goto('/#/arena');
  await expect(page.getByRole('region', { name: 'Roster' })).toContainText('Snag');
});

test('exports a save from town and from underground', async ({ page }) => {
  await begin(page, 'export-e2e');
  const exported = async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export save' }).click();
    expect((await download).suggestedFilename()).toBe('wastes-crawler-save.json');
  };
  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  await exported();
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.position = { col: 5, row: 10 };
    save.visited.push('4,9', '5,10');
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  await expect(page.getByRole('img', { name: 'Dungeon view' })).toBeVisible();
  await exported();
});

test('reloads mid-dungeon into identical state, RNG included', async ({ page }) => {
  await begin(page, 'reload-e2e');
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.position = { col: 5, row: 10 };
    save.visited.push('4,9', '5,10');
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  for (const k of 'www') await page.keyboard.press(k);
  const before = await saved(page);

  // Play on: two searches draw on the RNG.
  const search = page.getByRole('button', { name: 'Search (1 turn)' });
  await search.click();
  await search.click();
  const played = await saved(page);
  expect(played).not.toBe(before);

  // Put the mid-dungeon save back, reload, and play the same: the result is identical.
  await page.evaluate(
    ([key, text]) => localStorage.setItem(key as string, text as string),
    [WORLD_KEY, before],
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(page.getByRole('img', { name: 'Dungeon view' })).toBeVisible();
  expect(await saved(page)).toBe(before);
  await search.click();
  await search.click();
  expect(await saved(page)).toBe(played);
});
