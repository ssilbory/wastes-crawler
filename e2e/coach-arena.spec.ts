import { expect, test, type Page } from '@playwright/test';

// Phase 6d: coaches between towns and the town arenas, in the browser; the rules behind them are
// covered by unit tests.
const starters = ['snag', 'grukk', 'lirael', 'fizzwick'].map(
  (n) => `tools/sim/parties/starter/${n}.json`,
);

async function start(page: Page, seed: string) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  // The arena has a formation of its own: wait for the Overland page before picking slots.
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  const slots: [string, string][] = [
    ['Front row, slot 1', 'Snag'],
    ['Front row, slot 2', 'Grukk'],
    ['Rear row, slot 1', 'Lirael'],
    ['Rear row, slot 2', 'Fizzwick'],
  ];
  for (const [slot, name] of slots)
    await page.getByRole('combobox', { name: slot }).selectOption({ label: name });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill(seed);
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  // Enough crowns for fares and fees.
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('wastes-crawler.world') as string);
    save.purse = 500;
    localStorage.setItem('wastes-crawler.world', JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
}

test('rides the coach from Rubblegate to Scrapmarch', async ({ page }, testInfo) => {
  await start(page, 'coach-e2e');
  await page.getByRole('tab', { name: 'Coaches' }).click();
  await page.getByRole('button', { name: /^Board for 60 crowns$/ }).click();
  await expect(page.getByRole('region', { name: 'Coach' })).toContainText(
    'On the coach to Scrapmarch',
  );
  await page.screenshot({ path: testInfo.outputPath('coach.png'), fullPage: true });
  const log = page.getByRole('region', { name: 'Journey log' });
  for (let i = 0; i < 40; i++) {
    if ((await log.innerText()).includes('The party reaches Scrapmarch.')) break;
    const encounter = page.getByRole('region', { name: 'Encounter' });
    if (await encounter.isVisible()) {
      await encounter.getByRole('button', { name: /^(Fight|Attack them)$/ }).click();
      await page.getByRole('button', { name: 'Auto-resolve' }).click();
      await page.getByRole('button', { name: 'Back to the map' }).click();
      continue;
    }
    if (await page.getByRole('button', { name: 'Visit Rubblegate' }).isVisible()) break;
    await page.getByRole('button', { name: 'Ride on' }).click();
  }
  await expect(log).toContainText(/The party reaches Scrapmarch\.|The party falls\./);
});

test('fights a bout in the town arena for the prize', async ({ page }, testInfo) => {
  await start(page, 'arena-e2e');
  await page.getByRole('tab', { name: 'Arena' }).click();
  const card = page.getByRole('region', { name: 'Arena' });
  await card
    .getByRole('listitem')
    .filter({ hasText: 'Two pit fighters' })
    .getByRole('button')
    .click();
  await page.getByRole('button', { name: 'Auto-resolve' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('arena-bout.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back to town' }).click();
  await expect(page.getByRole('heading', { name: 'Rubblegate' })).toBeVisible();
  await page.getByRole('tab', { name: 'Arena' }).click();
  await expect(page.getByRole('region', { name: 'Arena' })).toContainText(
    'The party has fought its bout for today.',
  );
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    /The party (wins Two pit fighters looking for a spar|yields)/,
  );
});
