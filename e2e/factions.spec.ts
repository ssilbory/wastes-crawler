import { expect, test, type Page } from '@playwright/test';

// Phase 13: the Dark Lands' factions take a turn as each month begins; the party hears of them in
// the Factions panel and the journal. Since Phase 23a a faction's attack on a settlement lays siege
// to it, and a siege on the party's ally is heard of at once.
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

async function nightAtTheInn(page: Page) {
  await page.getByRole('button', { name: 'Visit Cinderhold' }).click();
  await page.getByRole('tab', { name: 'Inn and healer' }).click();
  await page.getByRole('button', { name: /Stay the night/ }).click();
  await page.getByRole('button', { name: 'Back to the map' }).click();
}

/** Starts a world with Snag and Grukk in front, on the factions seed. */
async function startWorld(page: Page) {
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
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('factions-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
}

test('follows the factions month by month, and hears of a Bastion siege', async ({
  page,
}, testInfo) => {
  await startWorld(page);
  // The Borderlands have no factions.
  await expect(page.getByRole('region', { name: 'Factions' })).toHaveCount(0);
  await edit(
    page,
    `Object.assign(save, { region: 'dark-lands', elsewhere: { borderlands: save.visited },
      visited: ['6,12'], position: { col: 6, row: 12 }, day: 29, purse: 100 });`,
  );

  const factions = page.getByRole('region', { name: 'Factions' });
  await expect(factions.locator('summary')).toHaveCount(4);
  await factions.getByText("Grisk's Warhost").click();
  await expect(factions).toContainText(
    "Grisk's Hold: Base of Influence (20 of 20), Beastman Warband (6 of 6)",
  );

  // A night at the inn ends day 30, and the month turns.
  await nightAtTheInn(page);
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText('Word spreads:');
  await expect(factions).toContainText('Goal: Blood the Enemy');
  await page.screenshot({ path: testInfo.outputPath('factions.png'), fullPage: true });

  // The Bastion's raiders stand in Cinderhold when the next month turns.
  await edit(
    page,
    `save.day = 59; save.sieges = [];
     Object.assign(save.factions.bastion, { hp: 17, idle: false,
       assets: [{ uid: 'a1', asset: 'infantry', at: 'cinderhold', hp: 6 }] });
     save.factions.settlements.assets = save.factions.settlements.assets.filter((a) => a.at !== 'cinderhold');`,
  );
  await nightAtTheInn(page);
  // The party is inside, so it is in the siege, and the assault comes the next night.
  await expect(page.getByRole('region', { name: 'Orders and sieges' })).toContainText(
    'The Dawnwall Bastion besieges Cinderhold, held by The Free Settlements, with 1 camp: the next assault comes at the end of day 61. The party has fought in it.',
  );
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'The Dawnwall Bastion lays siege to Cinderhold, held by The Free Settlements. The assault comes tonight.',
  );
  await expect(page.getByText('Siege: Cinderhold')).toBeVisible();
  // Its one camp is marked on the map beside the town.
  await expect(
    page.locator('use.camp', { hasText: "The Dawnwall Bastion's camp before Cinderhold" }),
  ).toHaveCount(1);
});

test('storms a held settlement, with only its shop and inn open (Phase 23b)', async ({ page }) => {
  await startWorld(page);
  await edit(
    page,
    `Object.assign(save, { region: 'dark-lands', elsewhere: { borderlands: save.visited },
      visited: ['6,12'], position: { col: 6, row: 12 }, day: 29, purse: 100 });`,
  );
  // The month turns, and the warhost picks its goal.
  await nightAtTheInn(page);
  await edit(
    page,
    `save.sieges = []; save.position = { col: 10, row: 4 }; save.visited.push('10,4');
     const free = save.factions.settlements;
     free.assets = free.assets.filter((a) => a.at !== 'lanternfall');
     free.bases = free.bases.filter((b) => b.at !== 'lanternfall');
     save.factions.warhost.bases.push({ at: 'lanternfall', hp: 2, max: 2 });
     save.factions.warhost.assets.push({ uid: 'held1', asset: 'infantry', at: 'lanternfall', hp: 6 });`,
  );
  await page.getByRole('button', { name: 'Visit Lanternfall' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: 'Inn and healer' })).toBeVisible();
  await expect(page.getByText("Held by Grisk's Warhost: shop and inn only")).toBeVisible();
  const storm = page.getByRole('region', { name: 'Storm the town' });
  await expect(storm).toContainText("Grisk's Warhost's Beastman Warband (4 fighters)");
  await storm.getByRole('button', { name: "Storm Grisk's Warhost's Beastman Warband" }).click();
  await expect(page.getByRole('heading', { name: 'To arms' })).toBeVisible();
});

test('waits free at an ally’s inn for a siege (Phase 23c)', async ({ page }) => {
  await startWorld(page);
  await edit(
    page,
    `Object.assign(save, { region: 'dark-lands', elsewhere: { borderlands: save.visited },
      visited: ['6,12'], position: { col: 6, row: 12 }, day: 25, purse: 100 });`,
  );
  await page.getByRole('button', { name: 'Visit Cinderhold' }).click();
  await page.getByRole('tab', { name: 'Inn and healer' }).click();
  await page.getByRole('button', { name: 'Wait for a siege (free)' }).click();
  const log = page.getByRole('region', { name: 'Journey log' });
  await expect(log).toContainText(
    "The party waits in Cinderhold for a siege, the Free Settlements' guests.",
  );
  await expect(log).toContainText(/the wait ends|ends the wait/);
  await expect(page.getByText('Purse: 100')).toBeVisible();
});

test('picks a side in a rivals’ siege of a held settlement (Phase 23d)', async ({ page }) => {
  await startWorld(page);
  await edit(
    page,
    `Object.assign(save, { region: 'dark-lands', elsewhere: { borderlands: save.visited },
      visited: ['6,12', '10,4'], position: { col: 10, row: 4 }, day: 29, purse: 100 });
     const free = save.factions.settlements;
     free.assets = free.assets.filter((a) => a.at !== 'lanternfall');
     free.bases = free.bases.filter((b) => b.at !== 'lanternfall');
     save.factions.warhost.bases.push({ at: 'lanternfall', hp: 20, max: 20 });
     save.factions.bastion.assets.push({ uid: 'b9', asset: 'infantry', at: 'lanternfall', hp: 6 });
     save.sieges = [{ town: 'lanternfall', attacker: 'bastion', defender: 'warhost', began: 28,
       next: 35, camps: [], joined: false, pass: false, stock: 0, gate: null }];`,
  );
  await page.getByRole('button', { name: 'Visit Lanternfall' }).click();
  const sides = page.getByRole('region', { name: 'Take a side' });
  await expect(sides).toContainText(
    "The Dawnwall Bastion besieges the town, held by Grisk's Warhost.",
  );
  await sides.getByRole('button', { name: 'Keep out of it' }).click();
  await expect(sides).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'The party keeps out of the siege of Lanternfall.',
  );
});
