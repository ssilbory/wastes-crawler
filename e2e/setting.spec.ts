import { expect, test, type Page } from '@playwright/test';

// Phase 12b: a bound garrison stands down for its countersign and offers a recruit; since Phase
// 23a, a siege's assault falls on a Dark Lands settlement while the party stays the night.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function darkLands(page: Page, seed: string) {
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
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill(seed);
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await expect(page.locator('.world-bar')).toContainText('The Borderlands');
}

/** Edits the saved world and reloads it. */
async function edit(page: Page, change: (save: Record<string, unknown>) => void) {
  await page.evaluate(
    ([key, body]) => {
      const save = JSON.parse(localStorage.getItem(key as string) as string);
      new Function('save', body as string)(save);
      localStorage.setItem(key as string, JSON.stringify(save));
    },
    [WORLD_KEY, `(${change.toString()})(save)`],
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
}

test('gives a garrison its countersign, and takes on the guard it offers', async ({
  page,
}, testInfo) => {
  await darkLands(page, 'orders-e2e');
  await edit(page, (save) => {
    Object.assign(save, {
      region: 'dark-lands',
      elsewhere: { borderlands: save.visited },
      visited: ['18,12'],
      position: { col: 18, row: 12 },
      countersigns: ['ruinfield-gate'],
      encounter: {
        enemies: [['bound-orc-guard', 'bound-orc-guard'], ['bound-orc-captain']],
        nature: 'hostile',
        reaction: 'expected',
        parleyed: false,
        captive: null,
        offer: null,
        quest: null,
        hostile: true,
        spotted: true,
        text: 'An orc garrison still holds the old gate. They demand the countersign.',
        order: 'ruinfield-gate',
      },
    });
  });
  const panel = page.getByRole('region', { name: 'Encounter' });
  await expect(panel.getByRole('group', { name: 'Standing order' })).toContainText(
    'Hold the Ruinfield Gate',
  );
  await expect(page.getByRole('region', { name: 'Orders and sieges' })).toContainText(
    '"The ash remembers"',
  );
  await page.screenshot({ path: testInfo.outputPath('garrison.png'), fullPage: true });
  await panel.getByRole('button', { name: 'Give the countersign' }).click();
  await expect(panel.getByRole('button', { name: 'Let them pass' })).toBeVisible();
  await panel.getByRole('button', { name: 'Take them on' }).click();
  await expect(page.getByRole('region', { name: 'NPCs' })).toContainText('Guard');
  await panel.getByRole('button', { name: 'Let them pass' }).click();
  await expect(page.getByRole('region', { name: 'Orders and sieges' })).toContainText('(ended)');
});

async function nightAtTheInn(page: Page) {
  await page.getByRole('button', { name: 'Visit Cinderhold' }).click();
  await page.getByRole('tab', { name: 'Inn and healer' }).click();
  await page.getByRole('button', { name: /Stay the night/ }).click();
}

test('fights its share of an assault on Cinderhold after a night at the inn', async ({ page }) => {
  await darkLands(page, 'sieges-e2e');
  // The month turns on the first night, and the factions take the field.
  await edit(page, (save) => {
    Object.assign(save, {
      region: 'dark-lands',
      elsewhere: { borderlands: save.visited },
      visited: ['6,12'],
      position: { col: 6, row: 12 },
      purse: 100,
      day: 29,
    });
  });
  await nightAtTheInn(page);
  await page.getByRole('button', { name: 'Back to the map' }).click();
  // Grisk's warband camps before Cinderhold, and its assault comes tonight.
  await edit(page, (save) => {
    const factions = save.factions as Record<string, { assets: unknown[] }>;
    (factions.warhost as { assets: unknown[] }).assets = [
      { uid: 'a1', asset: 'infantry', at: 'cinderhold', hp: 6 },
    ];
    save.sieges = [
      {
        town: 'cinderhold',
        attacker: 'warhost',
        defender: 'settlements',
        began: save.day,
        next: save.day,
        camps: [{ uid: 'a1', col: 7, row: 12 }],
        joined: true,
        pass: false,
        stock: 0,
        gate: null,
      },
    ];
  });
  await expect(page.getByRole('region', { name: 'Orders and sieges' })).toContainText(
    "Grisk's Warhost besieges Cinderhold, held by The Free Settlements, with 1 camp",
  );
  await nightAtTheInn(page);
  const alarm = page.getByRole('alert');
  await expect(alarm).toContainText("Grisk's Warhost's Beastman Warband storms the gates!");
  await alarm.getByRole('button', { name: 'To the gates' }).click();
  const panel = page.getByRole('region', { name: 'Encounter' });
  await expect(panel).toContainText('storms the gates!');
  await expect(panel.getByRole('button', { name: 'Fight' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Slip away' })).toHaveCount(0);
});
