import { expect, test, type Page } from '@playwright/test';

// Phase 6c: hirelings, parley, and rescues in the browser; the rules behind them are covered by
// unit tests.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function start(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('link', { name: 'Overland' }).click();
  // The arena has a formation of its own: wait for the Overland page before picking slots.
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('npc-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
}

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

test('hires a guard at the tavern', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  await page.getByRole('tab', { name: 'Tavern' }).click();
  await page.getByRole('button', { name: 'Hire a Guard' }).click();
  const npcs = page.getByRole('region', { name: 'NPCs' });
  await expect(npcs).toContainText('Aldo Guard, a quarter share');
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await expect(page.getByRole('region', { name: 'NPCs' })).toContainText('Aldo');
});

test('bribes captors to free a captive, then brings them home', async ({ page }, testInfo) => {
  await start(page);
  await edit(
    page,
    `save.position = { col: 19, row: 8 };
     save.visited.push('19,8', '20,8');
     save.encounter = {
       enemies: [['thug-or-militia', 'thug-or-militia']], nature: 'hostile', reaction: 'expected',
       parleyed: false, captive: 'merchant', offer: null, quest: null, hostile: true, spotted: false,
       text: 'The party meets 2 Thug or Militia. A bound merchant sits among them.',
     };`,
  );
  const encounter = page.getByRole('region', { name: 'Encounter' });
  await expect(encounter.getByRole('group', { name: 'Parley' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('npc-parley.png'), fullPage: true });
  await encounter.getByRole('button', { name: /^Bribe \(10 crowns\)$/ }).click();
  await expect(page.getByRole('region', { name: 'NPCs' })).toContainText('A captured merchant');
  await encounter.getByRole('button', { name: 'Let them pass' }).click();
  await expect(page.getByRole('region', { name: 'Encounter' })).toHaveCount(0);

  // One hex east along the road is Scrapmarch, the merchant's home.
  await page.locator('[data-hex="20,8"]').click();
  for (let i = 0; i < 4; i++) {
    if (await page.getByRole('region', { name: 'Encounter' }).isVisible()) break;
    const log = page.getByRole('region', { name: 'Journey log' });
    if ((await log.innerText()).includes('home safe')) break;
    await page.getByRole('button', { name: 'Pass the quarter' }).click();
  }
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'A captured merchant is home safe',
  );
  await page.screenshot({ path: testInfo.outputPath('npc-rescue.png'), fullPage: true });
});
