import { expect, test, type Page } from '@playwright/test';

// Phase 12d: crafter's notes are sold to a warlord's agent, advancing the warlord's clock, and once
// the warlord is dead the party decides the Seal of Command's fate at Elder Gorvash.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

/** Changes the autosaved world, then picks the journey back up. */
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

async function inCinderhold(page: Page, seed: string, extra: string) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('link', { name: 'Overland' }).click();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill(seed);
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await edit(
    page,
    `Object.assign(save, { region: 'dark-lands', elsewhere: { borderlands: save.visited },
      visited: ['6,12'], position: { col: 6, row: 12 }, purse: 0 }); ${extra}`,
  );
}

test("sells crafter's notes to a warlord's agent", async ({ page }) => {
  await inCinderhold(page, 'notes-e2e', `save.notes = { 'vats-notes': 'found' };`);
  const panel = page.getByRole('region', { name: 'Orders and raids' });
  const notes = panel.getByRole('group', { name: "the vat-master's notes" });
  await expect(notes).toContainText("The party carries the vat-master's notes.");
  await notes.getByRole('button', { name: "Sell to a warlord's agent" }).click();
  await expect(panel).toContainText("The warlord's clock: 1 of 6.");
  await expect(page.locator('.world-bar')).toContainText('Purse: 150 crowns');
  await expect(notes).toHaveCount(0);
});

test('destroys the Seal of Command, and the epilogue follows', async ({ page }, testInfo) => {
  await inCinderhold(
    page,
    'seal-e2e',
    `save.quests['warlord-falls'] = { status: 'done', step: 2, acceptedDay: 0 };
     save.authority = ['seal-of-command'];`,
  );
  await page.getByRole('button', { name: 'Visit Cinderhold' }).click();
  const seal = page
    .getByRole('region', { name: 'Elder Gorvash' })
    .getByRole('group', { name: 'The Seal of Command' });
  await expect(seal).toContainText('What becomes of it?');
  await page.screenshot({ path: testInfo.outputPath('seal-choice.png'), fullPage: true });
  await seal.getByRole('button', { name: 'Destroy the seal' }).click();
  await expect(seal).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Orders and raids' })).toContainText(
    "The seal cracks in Cinderhold's forge fire.",
  );
});
