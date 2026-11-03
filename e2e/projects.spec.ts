import { expect, test, type Page } from '@playwright/test';

// Phase 22a: major projects (docs/rules-adaptation.md, Major projects). Renown and crowns go into a
// project from a settlement on its map, and a project with no building work is done the moment
// its Renown covers it.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function begin(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(2);
  await page.goto('/#/world');
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('projects-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
}

/** Sets fields of the autosaved world, then picks the journey back up. */
async function patch(page: Page, fields: Record<string, unknown>) {
  await page.evaluate(
    ([key, set]) => {
      const save = JSON.parse(localStorage.getItem(key as string) as string);
      localStorage.setItem(key as string, JSON.stringify({ ...save, ...(set as object) }));
    },
    [WORLD_KEY, fields] as const,
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
}

test('puts Renown and crowns into a project, and finishes it once covered', async ({ page }) => {
  await begin(page);
  await patch(page, { renown: 5, purse: 100 });
  const panel = page.getByRole('region', { name: 'Projects' });
  await expect(panel).toContainText('Renown: 5');
  await panel.getByText('Secure the West Road').click();
  await expect(panel).toContainText('Against it: the coast raiders (minor figures).');
  const work = panel.getByRole('group', { name: 'Work on Secure the West Road' });
  await work.getByRole('button', { name: 'Put in Renown (5)' }).click();
  await expect(panel).toContainText('Renown: 0');
  await expect(panel).toContainText('5 of 8 Renown');
  for (let i = 0; i < 3; i++) await work.getByRole('button', { name: /^Buy 1 Renown/ }).click();
  // The road needs no building work, so covering it finishes it.
  await expect(panel).toContainText('Secure the West Road done');
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'Secure the West Road is done.',
  );
});

test('pays for a project’s materials on site and spends a day building', async ({ page }) => {
  await begin(page);
  // Scrapmarch, where the pumps are worked from.
  await patch(page, { purse: 400, position: { col: 20, row: 8 }, visited: ['3,8', '20,8'] });
  const panel = page.getByRole('region', { name: 'Projects' });
  await panel.getByText('Restart the Scrapmarch Pumps').click();
  await expect(panel).toContainText('When done: Hexes within 3 of Scrapmarch fill the water die');
  const build = panel.getByRole('group', { name: 'Build Restart the Scrapmarch Pumps' });
  await expect(build).toContainText('250 crowns of materials, then 25 days');
  await build.getByRole('button', { name: 'Pay for the materials' }).click();
  await expect(build).toContainText('25 days');
  await build.getByRole('button', { name: 'Spend a day building' }).click();
  const log = page.getByRole('region', { name: 'Journey log' });
  await expect(log).toContainText('The party works on Restart the Scrapmarch Pumps');
  await expect(log).toContainText('stays the night at the inn in Scrapmarch');
});
