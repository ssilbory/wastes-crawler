import { expect, test, type Page } from '@playwright/test';
import { closeWindow, openWindow, windowNames } from './windows.ts';

// Sam's ask: the map's panels are windows from the ☰ menu, and the party strip keeps to one line.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function begin(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.goto('/#/world');
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('windows-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
}

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

test('lists the map’s windows in the ☰ menu, only those with something in them', async ({
  page,
}) => {
  await begin(page);
  // The dock holds the quarter's plan alone, and the menu no longer lists the sections.
  await expect(page.locator('.dock').getByRole('region')).toHaveCount(1);
  const names = await windowNames(page);
  expect(names).toContain('NPCs');
  expect(names).toContain('Save');
  expect(names).not.toContain('Quests');
  expect(names).not.toContain('Overland');
  expect(names.slice(0, 3)).toEqual(['Characters', 'Formation', 'Inventory']);
  expect(names.at(-2)).toBe('Return to Overland start');

  await edit(page, `save.quests['bandit-camp'] = { status: 'active', step: 0, acceptedDay: 0 };`);
  expect(await windowNames(page)).toContain('Quests');
  const quests = await openWindow(page, 'Quests');
  await expect(quests).toContainText('The Raider Camp');
  // The window holds the keys: Q plays no quarter under it, and Escape closes it.
  const date = await page.locator('.world-bar .date').innerText();
  await page.keyboard.press('q');
  await expect(page.locator('.world-bar .date')).toHaveText(date);
  await page.keyboard.press('Escape');
  await expect(quests).toBeHidden();
  await openWindow(page, 'NPCs');
  await closeWindow(page);
  await expect(page.getByRole('dialog', { name: 'NPCs' })).toHaveCount(0);
});

test('returns to the Overland start, where the menu lists the sections again', async ({ page }) => {
  await begin(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Return to Overland start' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('link', { name: 'Title screen' })).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
});

test('keeps each party card to a line: Str, a big F for Frail, Dead for the dead', async ({
  page,
}) => {
  await begin(page);
  await edit(
    page,
    `save.members.find((m) => m.character.name === 'Snag').frail = true;
     const grukk = save.members.find((m) => m.character.name === 'Grukk');
     grukk.dead = true;
     grukk.character.hp.current = 0;`,
  );
  const cards = page.getByRole('region', { name: 'Party' }).getByRole('listitem');
  const snag = cards.filter({ hasText: 'Snag' });
  await expect(snag.locator('.slot-stats')).toHaveText(/^HP \d+\/\d+ · Str \d+\/\d+\s*F\s*Frail$/);
  await expect(snag.locator('.chip')).toHaveCount(0);
  const grukk = cards.filter({ hasText: 'Grukk' });
  await expect(grukk.locator('.slot-stats')).toHaveText('Dead');
  await expect(grukk.locator('.chip')).toHaveCount(0);
});

test('on a phone, opens the party’s screens from the ☰ menu, not the bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page);
  await expect(page.locator('.world-bar').getByRole('button', { name: 'Inventory' })).toBeHidden();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page
    .getByRole('navigation', { name: 'Windows' })
    .getByRole('button', { name: 'Inventory' })
    .click();
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
});

test('keeps a town’s and a dungeon’s panels in the ☰ menu too', async ({ page }) => {
  await begin(page);
  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  // No dock in town: the tabs have the room.
  await expect(page.locator('.dock')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0);
  const inTown = await windowNames(page);
  expect(inTown.slice(0, 3)).toEqual(['Characters', 'Formation', 'Inventory']);
  expect(inTown).toContain('NPCs');
  expect(inTown).toContain('Save');
  expect(inTown).toContain('Return to Overland start');
  await openWindow(page, 'NPCs');
  await closeWindow(page);
  await page.getByRole('button', { name: 'Back to the map' }).click();

  await edit(page, `save.position = { col: 5, row: 10 }; save.visited.push('4,9', '5,10');`);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  await expect(page.getByRole('img', { name: 'Dungeon view' })).toBeVisible();
  const below = await windowNames(page);
  expect(below).toContain('NPCs');
  expect(below).toContain('Save');
  expect(below).not.toContain('Mounts');
  // A window holds the dungeon's keys: the party does not turn under it.
  const bar = page.locator('.world-bar');
  const facing = await bar.locator('.bar-status span').nth(1).innerText();
  await openWindow(page, 'NPCs');
  await page.keyboard.press('d');
  await expect(bar.locator('.bar-status span').nth(1)).toHaveText(facing);
  await closeWindow(page);
  // Leaving for the start screen and continuing comes back underground.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Return to Overland start' }).click();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(page.getByRole('img', { name: 'Dungeon view' })).toBeVisible();
});
