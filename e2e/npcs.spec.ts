import { expect, test, type Page } from '@playwright/test';
import { inWindow } from './windows.ts';

// Phase 6c: hirelings, parley, and rescues in the browser; the rules behind them are covered by
// unit tests.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function start(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('button', { name: 'Menu' }).click();
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
  await inWindow(page, 'NPCs', (npcs) => expect(npcs).toContainText('Aldo Guard, a quarter share'));
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await inWindow(page, 'NPCs', (panel) => expect(panel).toContainText('Aldo'));
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
  await encounter.getByRole('button', { name: 'Let them pass' }).click();
  await expect(page.getByRole('region', { name: 'Encounter' })).toHaveCount(0);
  await inWindow(page, 'NPCs', (panel) => expect(panel).toContainText('A captured merchant'));

  // One hex east along the road is Scrapmarch, the merchant's home.
  await page.locator('[data-hex="20,8"]').click();
  for (let i = 0; i < 4; i++) {
    if (await page.getByRole('region', { name: 'Encounter' }).isVisible()) break;
    const log = page.getByRole('region', { name: 'Journey log' });
    if ((await log.innerText()).includes('home safe')) break;
    await page.getByRole('button', { name: /^(Hike|Camp) for the quarter$/ }).click();
  }
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'A captured merchant is home safe',
  );
  await page.screenshot({ path: testInfo.outputPath('npc-rescue.png'), fullPage: true });
});

// Sam's ask: a captive freed with both NPC slots full asks the party to make room.
test('dismisses an NPC to make room for a freed captive', async ({ page }) => {
  await start(page);
  const npc = (id: string, name: string, column: number) =>
    `{ id: '${id}', kind: 'hireling', type: 'porter', name: '${name}', hp: 4, maxHp: 4, row: 1,
       column: ${column}, quitting: false, inventory: [], owed: 0, refund: 0 }`;
  await edit(
    page,
    `save.position = { col: 19, row: 8 };
     save.visited.push('19,8');
     save.npcs = [${npc('npc-0', 'Aldo', 2)}, ${npc('npc-1', 'Brenna', 3)}];
     save.freedCaptive = 'merchant';`,
  );
  const ask = page.getByRole('dialog', { name: 'A freed captive' });
  await expect(ask).toContainText('no room for another NPC');
  await ask.getByRole('button', { name: 'Dismiss Aldo to make room' }).click();
  await ask.getByRole('button', { name: 'Dismiss for good' }).click();
  await expect(ask).toBeHidden();
  await inWindow(page, 'NPCs', async (npcs) => {
    await expect(npcs).toContainText('rescued, bound for Scrapmarch');
    await expect(npcs).toContainText('Brenna');
    await expect(npcs).not.toContainText('Aldo');
  });

  // Or the party keeps its company, and the captive goes their own way.
  await edit(page, `save.freedCaptive = 'pilgrim';`);
  await ask.getByRole('button', { name: 'Let them go their own way' }).click();
  await expect(ask).toBeHidden();
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'thanks the party and goes their own way.',
  );
});
