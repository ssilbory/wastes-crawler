import { expect, test, type Page } from '@playwright/test';

// Phase 7: go down into the Old Barrow from the hex map, walk both levels in first person, and climb
// back out. The movement rules are covered by unit tests; the screenshots pin the renderer.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function startAtBarrow(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('link', { name: 'Overland' }).click();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('dungeon-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  // Put the party on the barrow's hex through the autosave, then pick the journey back up.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.position = { col: 5, row: 10 };
    save.visited.push('4,9', '5,10');
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
}

/** Presses movement keys in order: w forward, s back, a/d turn, q/e step aside. */
async function keys(page: Page, moves: string) {
  for (const k of moves) await page.keyboard.press(k);
}

test('enters the barrow from the hex map, walks both levels, and climbs out', async ({ page }) => {
  await startAtBarrow(page);
  await expect(page.locator('[data-hex="5,10"] .dungeon')).toBeVisible();
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();

  const view = page.getByRole('img', { name: 'Dungeon view' });
  const bar = page.locator('.world-bar');
  await expect(bar).toContainText('The Upper Barrow, facing north');
  await expect(view).toHaveScreenshot('barrow-entry.png');

  // Up the corridor to the door of the first room.
  await keys(page, 'wwwww');
  await expect(view).toHaveScreenshot('barrow-door.png');
  await page.getByRole('button', { name: 'Forward' }).click();
  await page.getByRole('button', { name: 'Turn left' }).click();
  await expect(bar).toContainText('facing west');
  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(page.locator('.bump')).toHaveText('\u00a0');
  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(page.locator('.bump')).toHaveText('A wall blocks the way.');

  // Back to the corridor and down it, then east along the lower corridor, north through the door, and on to the stairs.
  await keys(page, 'ddwdwwwwww');
  await expect(bar).toContainText('facing south');
  await keys(page, 'awwwwwwawwwwwdwwawww');
  await expect(bar).toContainText('The Upper Barrow, facing north');
  await expect(page.getByRole('img', { name: 'Map of The Upper Barrow' })).toHaveScreenshot(
    'barrow-upper-map.png',
  );
  await page.getByRole('button', { name: 'Take the stairs to The Lower Barrow' }).click();
  await expect(bar).toContainText('The Lower Barrow, facing south');
  await expect(view).toHaveScreenshot('barrow-lower.png');

  // The descent survives a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(bar).toContainText('The Lower Barrow, facing south');
  await page.getByRole('button', { name: 'Take the stairs to The Upper Barrow' }).click();
  await expect(bar).toContainText('The Upper Barrow, facing west');

  await keys(page, 'awwwdwwawwwwwdwwwwww');
  await page.getByRole('button', { name: 'Climb out of The Old Barrow' }).click();
  await expect(page.getByRole('img', { name: 'Overland map' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'The party climbs out of The Old Barrow.',
  );
});
