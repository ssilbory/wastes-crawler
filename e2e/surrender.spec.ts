import { expect, test, type Page } from '@playwright/test';

// Phase 19 (docs/rules-adaptation.md, Morale, escape, and surrender): after a won fight the party
// questions the surrendered once, takes one on, then lets the rest go or kills them.
const starters = ['snag', 'fizzwick'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

/** Snag and Fizzwick in a new world, with a thug and a veteran soldier surrendered where they stand. */
async function begin(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page
    .getByRole('combobox', { name: 'Rear row, slot 1' })
    .selectOption({ label: 'Fizzwick' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('surrender-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.surrendered = {
      at: `${save.region}/${save.position.col},${save.position.row}`,
      monsters: ['thug-or-militia', 'veteran-soldier'],
      questioned: false,
      recruited: false,
    };
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
}

test('questions the surrendered, takes one on, and kills the rest', async ({ page }, testInfo) => {
  await begin(page);
  const ask = page.getByRole('dialog', { name: 'The surrendered' });
  await expect(ask).toContainText('Thug or Militia, Veteran Soldier throw down their arms.');
  // The day's plans wait until they are dealt with.
  await expect(page.getByRole('button', { name: /for the quarter$/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('surrendered.png'), fullPage: true });
  const log = page.getByRole('region', { name: 'Journey log' });
  await ask.getByRole('button', { name: 'What lies about?' }).click();
  await expect(log).toContainText('They describe the land about.');
  await expect(ask.getByRole('button', { name: 'What lies about?' })).toHaveCount(0);
  await ask.getByRole('button', { name: /^Take on the Thug or Militia/ }).click();
  await expect(log).toContainText('signs on as a Guard');
  await expect(ask).toContainText('Veteran Soldier throw down their arms.');
  await expect(ask.getByRole('button', { name: /^Take on/ })).toHaveCount(0);
  await ask.getByRole('button', { name: 'Kill them' }).click();
  await expect(ask).toHaveCount(0);
  await expect(log).toContainText('The party kills the veteran soldier.');
  await expect(page.getByRole('button', { name: /for the quarter$/ })).toBeVisible();
});

test('lets the surrendered go', async ({ page }) => {
  await begin(page);
  const ask = page.getByRole('dialog', { name: 'The surrendered' });
  await ask.getByRole('button', { name: 'Let them go' }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'The party lets them go.',
  );
});
