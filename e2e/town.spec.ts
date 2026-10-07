import { expect, test, type Page } from '@playwright/test';

// Phase 6a: the town hub. The inn, healer, shop, tavern, and training work in the browser; the
// rules behind them are covered by unit tests.
const starters = ['snag', 'grukk', 'lirael'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function startInRubblegate(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  // The arena has a formation of its own: wait for the Overland page before picking slots.
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('town-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  await expect(page.getByRole('heading', { name: 'Rubblegate' })).toBeVisible();
}

const purse = async (page: Page) =>
  Number((await page.locator('.world-bar').innerText()).match(/Purse: ([\d.]+) crown/)?.[1]);

test('rests at the inn, shops, and changes the party at the tavern', async ({ page }, testInfo) => {
  await startInRubblegate(page);
  const start = await purse(page);
  await page.getByRole('tab', { name: 'Inn and healer' }).click();
  await page.getByRole('button', { name: /^Stay the night \(6 crowns\)$/ }).click();
  expect(await purse(page)).toBe(start - 6);
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'The party stays the night at the inn in Rubblegate.',
  );

  await page.getByRole('tab', { name: 'Shop', exact: true }).click();
  await page.getByRole('combobox', { name: 'Item' }).selectOption({ label: 'Crowbar (4 crowns)' });
  await page.getByRole('button', { name: 'Buy', exact: true }).click();
  const pack = page.getByRole('region', { name: "Snag's pack" });
  await expect(pack).toContainText('Crowbar (stowed)');
  expect(await purse(page)).toBe(start - 10);
  await pack.getByRole('listitem').filter({ hasText: 'Crowbar' }).getByRole('button').click();
  await expect(pack).not.toContainText('Crowbar');
  expect(await purse(page)).toBe(start - 8);
  await page.screenshot({ path: testInfo.outputPath('town-shop.png'), fullPage: true });

  await page.getByRole('tab', { name: 'Tavern' }).click();
  const faces = page.getByRole('region', { name: 'New faces' });
  await faces.getByRole('listitem').filter({ hasText: 'Lirael' }).getByRole('button').click();
  const party = page.getByRole('region', { name: 'In the party' });
  await expect(party).toContainText('Lirael');
  await party.getByRole('listitem').filter({ hasText: 'Grukk' }).getByRole('button').click();
  const waiting = page.getByRole('region', { name: 'At the tavern' });
  await expect(waiting).toContainText('Grukk');
  await waiting.getByRole('button', { name: 'Rejoin' }).click();
  await expect(party.getByRole('listitem')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('town-tavern.png'), fullPage: true });

  await page.getByRole('button', { name: 'Back to the map' }).click();
  await expect(page.getByRole('img', { name: 'Overland map' })).toBeVisible();
});

test('levels up a character with XP to spend', async ({ page }, testInfo) => {
  await startInRubblegate(page);
  // Wait for the autosave to hold the party, then edit it from the title screen, where nothing
  // autosaves over the change (a pending town autosave could, which made this test flaky).
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const save = JSON.parse(localStorage.getItem(key) ?? 'null');
        return save?.members?.some(
          (m: { character: { name: string } }) => m.character.name === 'Snag',
        );
      }, WORLD_KEY),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue journey' })).toBeVisible();
  // Grant Snag the 3 XP for 2nd level through the save, then pick the journey back up.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    const snag = save.members.find(
      (m: { character: { name: string } }) => m.character.name === 'Snag',
    );
    snag.character.xp = 3;
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  await page.getByRole('tab', { name: 'Training' }).click();
  await page.getByRole('combobox', { name: 'Who' }).selectOption({ label: 'Snag' });
  const form = page.getByRole('region', { name: 'Level up' });
  await expect(form).toBeVisible();
  // Nothing picked yet: the form says what it needs and holds the button back.
  await expect(form.getByRole('list', { name: 'Still needed' })).toContainText('Choose a focus.');
  await expect(form.getByRole('button', { name: 'Level up' })).toBeDisabled();
  await form.getByRole('combobox', { name: 'Focus (any)' }).selectOption({ label: 'Die Hard' });
  await expect(form.getByRole('list', { name: 'Still needed' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('town-level-up.png'), fullPage: true });
  await form.getByRole('button', { name: 'Level up' }).click();
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    /Snag reaches level 2/,
  );
  const assign = page.getByRole('region', { name: 'Assign skill points' });
  await expect(assign).toContainText('Available: 3 skill points');
  await page.getByRole('combobox', { name: 'Skill' }).selectOption('lead');
  await page.getByRole('button', { name: 'Raise Lead' }).click();
  await expect(assign).toContainText('Available: 2 skill points');
});

test('plays the common room for the party’s lodging', async ({ page }) => {
  await startInRubblegate(page);
  await page.getByRole('tab', { name: 'Inn and healer' }).click();
  const show = page.getByRole('group', { name: 'Perform' });
  await show.getByRole('combobox', { name: 'Performer' }).selectOption({ index: 1 });
  await show.getByRole('button', { name: "Play for the party's lodging" }).click();
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    /Grukk plays (to a cold room|the common room)/,
  );
});
