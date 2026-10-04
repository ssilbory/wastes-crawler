import { expect, test, type Page } from '@playwright/test';

// Phase 12 exit, in the browser: with Warlord Grisk dead, the party climbs out of his hold, turns
// the quest in to Elder Gorvash, and keeps the Seal of Command. The whole campaign is played
// headlessly in tests/campaign/campaign.test.ts.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

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

test('climbs out of Grisk’s Hold, turns the warlord in, and keeps the seal', async ({
  page,
}, testInfo) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('link', { name: 'Overland' }).click();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('finale-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await edit(
    page,
    `Object.assign(save, {
      region: 'dark-lands', elsewhere: { borderlands: save.visited }, visited: ['2,21'],
      position: { col: 2, row: 21 }, purse: 0, authority: ['lieutenants-token', 'seal-of-command'],
      notes: { 'vats-notes': 'burned', 'grisk-notes': 'kept' },
      dungeon: { dungeon: 'grisks-hold', level: 'hold-stockade', at: { x: 4, y: 9 }, facing: 's',
        seen: {}, turn: 0, steps: 0, found: {}, glimpsed: {}, traps: {}, read: {} },
    });
    for (const id of ['ashgate-rolls', 'cull-records', 'lieutenants-seal'])
      save.quests[id] = { status: 'done', step: 2, acceptedDay: 0 };
    save.quests['warlord-falls'] = { status: 'ready', step: 2, acceptedDay: 0 };`,
  );
  await page.getByRole('button', { name: "Climb out of Grisk's Hold" }).click();
  await expect(page.locator('.world-bar')).toContainText('(2,21)');

  await edit(page, `save.position = { col: 6, row: 12 }; save.visited.push('6,12');`);
  await page.getByRole('button', { name: 'Visit Cinderhold' }).click();
  const elder = page.getByRole('region', { name: 'Elder Gorvash' });
  await elder.getByRole('button', { name: 'Collect the reward' }).click();
  await expect(page.locator('.world-bar')).toContainText('Purse: 300 crowns');
  const seal = elder.getByRole('group', { name: 'The Seal of Command' });
  await seal.getByRole('button', { name: 'Keep it' }).click();
  await expect(seal).toHaveCount(0);
  const panel = page.getByRole('region', { name: 'Orders and raids' });
  await expect(panel).toContainText('The party keeps the seal.');
  await expect(panel).toContainText('lie 1 sets of crafter');
  await expect(panel).toContainText('Carrying The Seal of Command.');
  await page.screenshot({ path: testInfo.outputPath('finale.png'), fullPage: true });
});
