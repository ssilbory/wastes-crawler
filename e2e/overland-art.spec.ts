import { expect, test, type Page } from '@playwright/test';

// Presentation V2: the overland map as an inked chart, with fog over the unknown and the light of
// the hour. The screenshots pin the art; the map's rules are covered by unit tests.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

test.use({ viewport: { width: 1440, height: 900 } });

async function startWorld(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('overland-art');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
}

/** Shows the whole map: it opens closed in on what the party knows. */
async function fit(page: Page) {
  const button = page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: 'Fit' });
  if (await button.isEnabled()) await button.click();
  await expect(page.locator('.map-wrap.zoom-scroll')).toHaveClass(/fit/);
}

/** Marks a band of hexes visited and sets the quarter, through the autosave. */
async function explore(page: Page, quarter: number) {
  await page.evaluate(
    ([key, q]) => {
      const save = JSON.parse(localStorage.getItem(key as string) as string);
      const band: string[] = [];
      for (let col = 0; col < 14; col++)
        for (let row = 6; row < 13; row++) band.push(`${col},${row}`);
      save.visited = [...new Set([...save.visited, ...band])];
      save.quarter = q;
      localStorage.setItem(key as string, JSON.stringify(save));
    },
    [WORLD_KEY, quarter] as const,
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
}

test('draws the overland map as a chart, fogged beyond what the party knows', async ({ page }) => {
  await startWorld(page);
  const map = page.getByRole('img', { name: 'Overland map' });
  await fit(page);
  await expect(map).toHaveScreenshot('overland-start.png');
  await explore(page, 1);
  await fit(page);
  await expect(map).toHaveScreenshot('overland-day.png');
  await explore(page, 3);
  await fit(page);
  await expect(map).toHaveScreenshot('overland-night.png');
});

/** Whether the party's banner lies inside the map's frame, left to right. */
async function partyInView(page: Page) {
  const party = await page.locator('.hex .party').boundingBox();
  const box = await page.locator('.map-wrap.zoom-scroll').boundingBox();
  expect(party && box).toBeTruthy();
  if (party && box) {
    expect(party.x).toBeGreaterThan(box.x);
    expect(party.x + party.width).toBeLessThan(box.x + box.width);
  }
}

test('opens closed in on the hexes the party knows', async ({ page }) => {
  await startWorld(page);
  const zoom = page.getByRole('group', { name: 'Zoom' });
  await expect(page.locator('.map-wrap.zoom-scroll')).toHaveClass(/zoomed/);
  await expect(zoom.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  await partyInView(page);
});

// The overland map answers the keyboard: Tab to it, the arrow keys, then Enter.
test('picks a destination with the keyboard', async ({ page }) => {
  await startWorld(page);
  const map = page.getByRole('img', { name: 'Overland map' });
  await map.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.map-cursor')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.hex.destination')).toHaveCount(1);
  await expect(
    page.getByRole('region', { name: 'Quarter plan' }).getByRole('radio', { name: 'Hike' }),
  ).toBeEnabled();
});

// Sam's ask: zoom in and out on the overland map.
test('zooms in on the party, scrolls, and fits the whole map again', async ({ page }, testInfo) => {
  await startWorld(page);
  const zoom = page.getByRole('group', { name: 'Zoom' });
  const frame = page.locator('.map-wrap.zoom-scroll');
  await fit(page);
  await expect(zoom.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  await zoom.getByRole('button', { name: 'Zoom in' }).click();
  await zoom.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoom).toContainText('2×');
  await expect(frame).toHaveClass(/zoomed/);
  // The map is now wider than its frame, and the party is still in view.
  const wider = await frame.evaluate((el) => el.scrollWidth > el.clientWidth * 1.5);
  expect(wider).toBe(true);
  await partyInView(page);
  await page.screenshot({ path: testInfo.outputPath('overland-zoomed.png') });
  // Clicking a hex still picks it as the destination.
  await page.locator('.hex .party').click({ force: true });
  await zoom.getByRole('button', { name: 'Fit' }).click();
  await expect(frame).toHaveClass(/fit/);
  await expect(zoom.getByRole('button', { name: 'Fit' })).toBeDisabled();
});

// Sam's ask: minimize the column of quests and companions, and the journal shrinks with it.
test('minimizes the side column, growing the map, and remembers it', async ({ page }) => {
  await startWorld(page);
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.quests = { 'bandit-camp': { status: 'active', step: 0, acceptedDay: 0 } };
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  const map = page.getByRole('img', { name: 'Overland map' });
  const journal = page.getByRole('region', { name: 'Journey log' });
  await expect(page.locator('.side-dock')).toContainText('The Raider Camp');
  const before = { map: await map.boundingBox(), journal: await journal.boundingBox() };

  await page.getByRole('button', { name: 'Minimize the side panels' }).click();
  await expect(page.locator('.side-dock')).not.toContainText('The Raider Camp');
  const after = { map: await map.boundingBox(), journal: await journal.boundingBox() };
  expect(after.journal?.height ?? 0).toBeLessThan(before.journal?.height ?? 0);
  expect(after.map?.height ?? 0).toBeGreaterThan(before.map?.height ?? 0);

  // It stays minimized across a reload, and comes back on asking.
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page.getByRole('button', { name: 'Show the side panels' }).click();
  await expect(page.locator('.side-dock')).toContainText('The Raider Camp');
});
