import { expect, test } from '@playwright/test';

// Sam's call: a fallen party is lost for good, and the player gathers a new one at the tavern of
// the last town visited (docs/rules-adaptation.md, Fallen party).
const starters = ['snag', 'grukk', 'lirael'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

test('loses the party for good, then gathers a new one at the tavern', async ({ page }) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  // A hopeless fight: the party at 1 HP and Frail, so the first blow kills, against titans.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    for (const m of save.members) {
      m.character.hp.current = 1;
      m.frail = true;
    }
    save.encounter = {
      enemies: [['legendary-god-titan', 'legendary-god-titan']],
      nature: 'hostile',
      reaction: 'expected',
      parleyed: false,
      captive: null,
      offer: null,
      quest: null,
      hostile: true,
      spotted: false,
      text: 'Titans bar the road.',
    };
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page
    .getByRole('region', { name: 'Encounter' })
    .getByRole('button', { name: /^(Fight|Attack them)$/ })
    .click();
  // The titans may finish it before the party's first turn.
  const auto = page.getByRole('button', { name: 'Auto-resolve' });
  const back = page.getByRole('button', { name: 'Back to the map' });
  await expect(auto.or(back).first()).toBeVisible();
  if (await auto.isVisible()) await auto.click();
  await back.click();

  // The tavern, and nothing else, until a new party is gathered.
  await expect(page.getByRole('alert').filter({ hasText: 'The party is lost.' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveText(['Tavern']);
  await expect(page.getByRole('button', { name: 'Back to the map' })).toHaveCount(0);
  const lost = page.getByRole('region', { name: 'Lost' });
  await expect(lost).toContainText('Snag, Grukk');
  const newFaces = page.getByRole('region', { name: 'New faces' });
  await expect(newFaces.getByRole('button', { name: 'Make a new character' })).toBeVisible();
  // The lost can't come back; Lirael, never in this world, can join.
  await expect(newFaces).not.toContainText('Snag');
  await newFaces.getByRole('listitem').filter({ hasText: 'Lirael' }).getByRole('button').click();
  await expect(page.getByRole('region', { name: 'In the party' })).toContainText('Lirael');
  await expect(page.getByRole('button', { name: 'Back to the map' })).toBeVisible();
});

test('goes from the tavern to make a character, and back to the journey', async ({ page }) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters.slice(0, 1));
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await page.getByRole('button', { name: /Visit/ }).click();
  await page.getByRole('tab', { name: 'Tavern' }).click();
  await page.getByRole('button', { name: 'Make a new character' }).click();
  await expect(page).toHaveURL(/#\/builder\/new$/);
  await page.getByRole('button', { name: 'Back to characters' }).click();
  await page.getByRole('button', { name: 'Back to the journey' }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
});
