import { expect, test } from '@playwright/test';

// Phase 21 (docs/rules-adaptation.md, Scrolls outside fights): a scroll of a spell cast outside
// fights is read from the dock, and the spell waits for its reader to cast it.
const starters = ['snag', 'fizzwick'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

test('reads a scroll of Query the Skull, and the spell waits for Snag to cast it', async ({
  page,
}, testInfo) => {
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
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('scroll-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  // Snag carries a level-3 scroll of Query the Skull, and Magic 2 reads it safely.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    const snag = save.members.find(
      (m: { character: { name: string } }) => m.character.name === 'Snag',
    );
    snag.character.skills.magic = 2;
    snag.character.inventory.push({
      id: 'scroll',
      quantity: 1,
      location: 'stowed',
      spell: 'query-the-skull',
      casterLevel: 3,
    });
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();

  const scrolls = page.getByRole('region', { name: 'Scrolls' });
  await scrolls.getByRole('button', { name: 'Snag: read the scroll of Query the Skull' }).click();
  await expect(scrolls).toContainText('Snag holds Query the Skull, read from a scroll');
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    "Query the Skull is Snag's to cast until the quarter ends.",
  );
  await page.screenshot({ path: testInfo.outputPath('scroll-held.png'), fullPage: true });
});
