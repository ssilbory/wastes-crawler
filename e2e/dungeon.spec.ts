import { expect, test, type Page } from '@playwright/test';

// Phase 7: go down into the Old Barrow from the hex map, walk both levels in first person, and climb
// back out. The movement rules are covered by unit tests; the screenshots pin the renderer.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

// A MacBook-sized window, where the view has room to draw at its full 640x480, so the screenshots
// compare unscaled pixels.
test.use({ viewport: { width: 1440, height: 900 } });

async function startAtBarrow(page: Page) {
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
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('dungeon-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  // Put the party on the barrow's hex through the autosave, then pick the journey back up.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.position = { col: 5, row: 10 };
    save.visited.push('4,9', '5,10');
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
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

/** Presses movement keys in order: w forward, s back, a/d turn, q/e step aside. */
async function keys(page: Page, moves: string) {
  for (const k of moves) await page.keyboard.press(k);
}

// Sam's ask: Space enters the dungeon here and takes the stairs, and the bar shows the rations.
test('enters with Space, shows the rations, and climbs out with Space', async ({ page }) => {
  await startAtBarrow(page);
  const bar = page.locator('.world-bar');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(' ');
  await expect(bar).toContainText('The Upper Barrow, facing north');
  await expect(bar).toContainText(/Rations: (d\d+|none)/);
  await expect(page.getByRole('button', { name: 'Climb out of The Old Barrow' })).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(' ');
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
});

test('enters the barrow from the hex map, walks both levels, and climbs out', async ({ page }) => {
  await startAtBarrow(page);
  await expect(page.locator('[data-hex="5,10"] .dungeon')).toBeVisible();
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();

  const view = page.getByRole('img', { name: 'Dungeon view' });
  const bar = page.locator('.world-bar');
  await expect(bar).toContainText('The Upper Barrow, facing north');
  await expect(view).toHaveScreenshot('barrow-entry.png');

  // Up the corridor to the door of the first room.
  await keys(page, 'wwwww');
  await expect(view).toHaveScreenshot('barrow-door.png');
  await page.getByRole('button', { name: 'Forward' }).click();
  await page.getByRole('button', { name: 'Turn left' }).click();
  await expect(bar).toContainText('facing west');
  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(page.locator('.bump')).toHaveText('\u00a0');
  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(page.locator('.bump')).toHaveText('A wall blocks the way.');

  // Back to the corridor and down it, then east along the lower corridor, north through the door, and on to the stairs.
  await keys(page, 'ddwdwwwwww');
  await expect(bar).toContainText('facing south');
  await keys(page, 'awwwwwwawwwwwdwwawww');
  await expect(bar).toContainText('The Upper Barrow, facing north');
  await expect(page.getByRole('img', { name: 'Map of The Upper Barrow' })).toHaveScreenshot(
    'barrow-upper-map.png',
  );
  await page.getByRole('button', { name: 'Take the stairs to The Lower Barrow' }).click();
  await expect(bar).toContainText('The Lower Barrow, facing south');
  await expect(view).toHaveScreenshot('barrow-lower.png');

  // The descent survives a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(bar).toContainText('The Lower Barrow, facing south');
  await page.getByRole('button', { name: 'Take the stairs to The Upper Barrow' }).click();
  await expect(bar).toContainText('The Upper Barrow, facing west');

  await keys(page, 'awwwdwwawwwwwdwwwwww');
  await page.getByRole('button', { name: 'Climb out of The Old Barrow' }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'The party climbs out of The Old Barrow.',
  );

  // Going back down, the party still has its map (docs/rules-adaptation.md, Charts).
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  await expect(bar).toContainText('The Upper Barrow, facing north');
  // The day's notices can pop up over the map; they're not what this checks.
  await expect(page.getByRole('img', { name: 'Map of The Upper Barrow' })).toHaveScreenshot(
    'barrow-upper-map-again.png',
    { mask: [page.locator('.toasts')] },
  );
});

// Phase 8a: exploration turns, light, wandering encounters, camping, and darkness.
test('fights a wanderer, camps on a safe square, and goes dark', async ({ page }, testInfo) => {
  await startAtBarrow(page);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  const bar = page.locator('.world-bar');
  await expect(bar).toContainText('Turn 1, step 1 of 12');
  await expect(bar).toContainText('Torch (d6); 1 torch spare');
  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(bar).toContainText('Turn 1, step 2 of 12');

  // Three turns in, something comes out of the dark.
  await edit(
    page,
    `save.dungeon.turn = 3;
     save.encounter = {
       enemies: [['predator-small-vicious']], nature: 'hostile', reaction: 'expected',
       parleyed: false, captive: null, offer: null, quest: null, hostile: true, spotted: false,
       text: 'Something small and vicious scuttles out of the dark.',
     };`,
  );
  const encounter = page.getByRole('region', { name: 'Encounter' });
  await expect(encounter).toContainText('scuttles out of the dark');
  // The encounter pops out over the view and its buttons; the keys still try to move.
  await page.keyboard.press('w');
  await expect(page.locator('.bump')).toHaveText('Settle the encounter first.');
  await page.screenshot({ path: testInfo.outputPath('dungeon-encounter.png'), fullPage: true });
  await encounter.getByRole('button', { name: 'Fight' }).click();
  await page.getByRole('button', { name: 'Auto-resolve' }).click();
  // A won fight's log ends with the XP it earns.
  await expect(page.locator('.fight')).toContainText(/fight: \d+(\.\d+)? XP each\./);
  await page.getByRole('button', { name: 'Back to the dungeon' }).click();
  // The fight and the first aid after it take a turn each.
  await expect(bar).toContainText('Turn 6, step 2 of 12');

  // The first room of the lower level is safe to camp in.
  await edit(page, `Object.assign(save.dungeon, { level: 'barrow-lower', at: { x: 1, y: 1 } });`);
  const camp = page.getByRole('region', { name: 'Camp' });
  await expect(camp).toBeVisible();
  await camp.getByRole('button', { name: 'Camp for the quarter' }).click();
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText('The party camps.');

  // With every torch gone, the party sees and maps nothing.
  await edit(
    page,
    `Object.assign(save.light, { lit: null, torch: 0, kitTorches: 0 });
     save.encounter = null;
     Object.assign(save.dungeon, { level: 'barrow-upper', at: { x: 1, y: 8 }, facing: 'n' });`,
  );
  await expect(bar).toContainText('No light; 0 torches spare');
  const view = page.getByRole('img', { name: 'Dungeon view' });
  await expect(view).toContainText('Pitch dark');
  await expect(view).toHaveScreenshot('barrow-dark.png');
});

// Phase 8b: Search for a secret door, and a known trap to disarm.
test('searches out the secret closet and works on a known trap', async ({ page }) => {
  await startAtBarrow(page);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  await edit(page, `Object.assign(save.dungeon, { at: { x: 2, y: 1 }, facing: 'e' });`);
  const log = page.getByRole('region', { name: 'Journey log' });
  const searchButton = page.getByRole('button', { name: 'Search (1 turn)' });
  for (let i = 0; i < 10 && !(await log.innerText()).includes('finds a secret door'); i++)
    await searchButton.click();
  await expect(log).toContainText('finds a secret door');
  await page.getByRole('button', { name: 'Forward' }).click();
  const view = page.getByRole('img', { name: 'Dungeon view' });
  await expect(view).toHaveScreenshot('barrow-secret-door.png');
  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(page.locator('.bump')).toHaveText(' ');
  await expect(page.getByRole('region', { name: 'Camp' })).toBeVisible();

  await edit(
    page,
    `save.encounter = null;
     Object.assign(save.dungeon, { at: { x: 4, y: 7 }, facing: 'n' });
     save.dungeon.traps = { 'barrow-upper': { '4,6': 'noticed' } };`,
  );
  await expect(view).toHaveScreenshot('barrow-trap.png');
  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(page.locator('.bump')).toHaveText('The dart trap lies ahead.');
  await page.getByRole('button', { name: 'Disarm the dart trap (1 turn)' }).click();
  await expect(log).toContainText(/(disarms|can't work out|fumbles) the dart trap/);
});

// Presentation V1: a wall dug through by magic shows a ragged hole, not a gap, and can be walked.
test('shows a wall dug through by magic as a ragged hole', async ({ page }) => {
  await startAtBarrow(page);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  await edit(
    page,
    `save.encounter = null;
     Object.assign(save.dungeon, { at: { x: 5, y: 8 }, facing: 'e' });
     save.dungeon.dug = { 'barrow-upper': ['5,8,n', '8,8,w'] };`,
  );
  const view = page.getByRole('img', { name: 'Dungeon view' });
  await expect(view).toHaveScreenshot('barrow-breach.png');
  await keys(page, 'a');
  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(page.locator('.bump')).toHaveText(' ');
});

test('shows a notice on picking up a quest item', async ({ page }) => {
  await startAtBarrow(page);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  await edit(
    page,
    `save.quests['barrow-torc'] = { status: 'active', step: 2, acceptedDay: 0 };
     Object.assign(save.dungeon, { at: { x: 4, y: 0 }, facing: 'e' });`,
  );
  const notice = page.getByRole('status', { name: 'Quest item found' });
  await expect(notice).toBeHidden();
  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(notice).toContainText(
    "The Barrow-King's Torc: the party takes the barrow-king's torc.",
  );
  await notice.getByRole('button', { name: 'Dismiss' }).click();
  await expect(notice).toBeHidden();
});

test('tends a PC a trap brings down, as after a fight', async ({ page }) => {
  await startAtBarrow(page);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  // Grukk, without the Die Hard that would stabilize him on its own.
  await edit(
    page,
    `Object.assign(save.dungeon, { at: { x: 4, y: 7 }, facing: 'n' });
     save.dungeon.traps = { 'barrow-upper': { '4,6': 'noticed' } };
     const grukk = save.members.find((m) => m.character.name === 'Grukk').character;
     grukk.hp.current = 1;
     grukk.foci = grukk.foci.filter((f) => f.id !== 'die-hard');`,
  );
  await page.getByRole('button', { name: 'Step onto the dart trap' }).click();
  // The fallen are tended on the fight screen, Heal checks and healing magic and all.
  await expect(page.locator('.fight')).toContainText('Grukk falls, mortally wounded.');
  const result = page.getByRole('status').filter({ hasText: /^(The fallen live|1 dead)\.$/ });
  await expect(result).toBeVisible();
  const saved = (await result.innerText()).startsWith('The fallen live');
  await page.getByRole('button', { name: 'Back to the dungeon' }).click();
  const party = page.getByRole('region', { name: 'Party' });
  if (saved) await expect(party).toContainText('Frail');
  else await expect(page.getByRole('region', { name: 'Journey log' })).toContainText('Grukk dies.');
});

/** Fights out any pending encounters with auto-resolve, until the way is clear. */
async function settle(page: Page) {
  const encounter = page.getByRole('region', { name: 'Encounter' });
  const view = page.getByRole('img', { name: 'Dungeon view' });
  for (;;) {
    // The dungeon comes back once the fight's XP simulation has finished.
    await expect(view).toBeVisible();
    if (!(await encounter.isVisible())) return;
    await encounter.getByRole('button', { name: /^(Fight|Attack them)$/ }).click();
    await page.getByRole('button', { name: 'Auto-resolve' }).click();
    await page.getByRole('button', { name: 'Back to the dungeon' }).click();
  }
}

/** Walks key by key, fighting whatever turns up on the way. */
async function go(page: Page, moves: string) {
  for (const k of moves) {
    await settle(page);
    await page.keyboard.press(k);
  }
  await settle(page);
}

// Phase 8 exit: a full delve from the entrance to the stairs and back, with fights, a trap, a
// camp, and a rescue.
test('delves to the stairs and back with fights, a trap, a camp, and a rescue', async ({
  page,
}, testInfo) => {
  await startAtBarrow(page);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  const log = page.getByRole('region', { name: 'Journey log' });
  const bar = page.locator('.world-bar');

  // East along the lower corridor, then up the dead end into the dart trap.
  await go(page, 'dwwwaw');
  await go(page, 'w');
  if (!(await log.innerText()).includes('The dart trap springs!'))
    await page.getByRole('button', { name: 'Step onto the dart trap' }).click();
  await expect(log).toContainText('The dart trap springs!');

  // Back down, east, and north through the door to the grave robbers and their captive.
  await go(page, 'ddwwawwwawwwwwwawdww');
  await expect(log).toContainText('grave-digger is free');
  await expect(page.getByRole('region', { name: 'NPCs' })).toContainText('grave-digger');

  // On to the stairs, down, and a camp in the first room below.
  await go(page, 'dwww');
  await page.getByRole('button', { name: 'Take the stairs to The Lower Barrow' }).click();
  await expect(bar).toContainText('The Lower Barrow');
  await go(page, 'w');
  await page.getByRole('region', { name: 'Camp' }).getByRole('button').click();
  await expect(log).toContainText('The party camps.');
  await settle(page);
  await page.screenshot({ path: testInfo.outputPath('delve-camp.png'), fullPage: true });

  // Back up and out the way the party came.
  await go(page, 's');
  await page.getByRole('button', { name: 'Take the stairs to The Upper Barrow' }).click();
  await go(page, 'awwwdwwawwwwwdwwwwww');
  await page.getByRole('button', { name: 'Climb out of The Old Barrow' }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'NPCs' })).toContainText('grave-digger');
  await page.screenshot({ path: testInfo.outputPath('delve-out.png'), fullPage: true });
});

// Sam's ask: a square of magical darkness looks dark from outside, hiding what lies beyond it.
test('shows a square of magical darkness as black', async ({ page }) => {
  await startAtBarrow(page);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  await edit(
    page,
    `Object.assign(save.dungeon, { level: 'barrow-lower', at: { x: 6, y: 1 }, facing: 's' });`,
  );
  // 6,4 is dark, three cells down the passage.
  await expect(page.getByRole('img', { name: 'Dungeon view' })).toHaveScreenshot(
    'barrow-darkness.png',
  );
});

// Sam's ask: who stands ahead shows in the view: a captive among their guards, and a quest's item.
test('shows a held captive among their guards, and a quest item, in the cells ahead', async ({
  page,
}) => {
  await startAtBarrow(page);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  const view = page.getByRole('img', { name: 'Dungeon view' });
  await edit(page, `Object.assign(save.dungeon, { at: { x: 9, y: 0 }, facing: 'w' });`);
  await expect(view.locator('.occupant.captive title')).toContainText('held by guards');
  await expect(view).toHaveScreenshot('barrow-captive.png');
  await edit(
    page,
    `save.quests['barrow-torc'] = { status: 'active', step: 2, acceptedDay: 0 };
     Object.assign(save.dungeon, { at: { x: 5, y: 1 }, facing: 'n' });`,
  );
  await expect(view.locator('.occupant.item')).toHaveCount(1);
  await expect(view).toHaveScreenshot('barrow-quest-item.png');
});

// Sam's ask: a level's boss is seen before the fight. A hoard's guards stand over its chest, named
// for a warlord whose hoard it is, until they're beaten.
test('shows a hoard’s guards, the level’s boss, over its chest in the cells ahead', async ({
  page,
}) => {
  await startAtBarrow(page);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  const view = page.getByRole('img', { name: 'Dungeon view' });
  await edit(
    page,
    `Object.assign(save.dungeon, {
       dungeon: 'scrap-kings-pumpworks', level: 'scrap-kings-pumpworks-2',
       at: { x: 6, y: 2 }, facing: 'n',
     });`,
  );
  const hoard = view.locator('.occupant.hoard');
  await expect(hoard).toHaveCount(1);
  await expect(hoard.locator('title')).toHaveText('The Scrap King, over a hoard');
  await expect(hoard.locator('svg.foe')).toHaveCount(2);
  await expect(view).toHaveScreenshot('pumpworks-hoard.png');
  await edit(page, `save.beaten.push('scrap-kings-pumpworks/scrap-kings-pumpworks-2/6,0');`);
  await expect(hoard.locator('title')).toHaveText('A hoard');
  await expect(hoard.locator('svg.foe')).toHaveCount(0);
});
