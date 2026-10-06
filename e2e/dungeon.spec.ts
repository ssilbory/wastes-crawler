import { expect, test, type Page } from '@playwright/test';

// Phase 7: go down into the Old Barrow from the hex map, walk both levels in first person, and climb
// back out. The movement rules are covered by unit tests; the screenshots pin the renderer.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function startAtBarrow(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
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
  await expect(page.getByRole('img', { name: 'Overland map' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'The party climbs out of The Old Barrow.',
  );
});

// Phase 8a: exploration turns, light, wandering encounters, camping, and darkness.
test('fights a wanderer, camps on a safe square, and goes dark', async ({ page }, testInfo) => {
  await startAtBarrow(page);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  const bar = page.locator('.world-bar');
  await expect(bar).toContainText('Turn 1, step 1 of 12');
  await expect(bar).toContainText('Torch (d6); 11 torches spare');
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
  await page.getByRole('button', { name: 'Forward' }).click();
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
  await expect(page.getByRole('img', { name: 'Overland map' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'NPCs' })).toContainText('grave-digger');
  await page.screenshot({ path: testInfo.outputPath('delve-out.png'), fullPage: true });
});
