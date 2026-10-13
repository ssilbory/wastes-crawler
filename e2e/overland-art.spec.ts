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
  await expect(map).toHaveScreenshot('overland-start.png');
  await explore(page, 1);
  await expect(map).toHaveScreenshot('overland-day.png');
  await explore(page, 3);
  await expect(map).toHaveScreenshot('overland-night.png');
});
