import { expect, test, type Page } from '@playwright/test';

// Phase 13: the Dark Lands' factions take a turn as each month begins; the party hears of them in
// the Factions panel and the journal, and the Dawnwall Bastion's attack on a settlement comes as a
// raid with a week's warning.
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

test('follows the factions month by month, and hears of a Bastion raid', async ({
  page,
}, testInfo) => {
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
    `save.day = 59; save.raid = null;
     Object.assign(save.factions.bastion, { hp: 17, idle: false,
       assets: [{ uid: 'a1', asset: 'infantry', at: 'cinderhold', hp: 6 }] });
     save.factions.settlements.assets = save.factions.settlements.assets.filter((a) => a.at !== 'cinderhold');`,
  );
  await nightAtTheInn(page);
  await expect(page.getByRole('region', { name: 'Orders and raids' })).toContainText(
    'Raiders will strike Cinderhold at the end of day 67.',
  );
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'Word comes that The Dawnwall Bastion will strike Cinderhold within 7 days.',
  );
});
