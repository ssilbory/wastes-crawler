import { expect, test, type Page } from '@playwright/test';

// Phase 14d: a Priest of Death revives a member slain in the fight just won, who lies unconscious.
const starters = ['snag', 'fizzwick'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

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

/** Snag in front and Fizzwick behind, in a new world on its first day. */
async function begin(page: Page) {
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
  await page
    .getByRole('combobox', { name: 'Rear row, slot 1' })
    .selectOption({ label: 'Fizzwick' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('healer-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
}

test('revives the fallen right after the fight', async ({ page }, testInfo) => {
  await begin(page);
  await expect(page.getByRole('region', { name: 'Revive the Fallen' })).toHaveCount(0);
  await edit(
    page,
    `const fizz = save.members.find((m) => m.character.name === 'Fizzwick').character;
     fizz.classes = { current: 'healer-partial-mage', levels: { 'healer-partial-mage': 8 } };
     fizz.skills.heal = 1;
     fizz.spells = { known: [], prepared: [] };
     fizz.arts = ['healing-touch', 'revive-the-fallen'];
     const snag = save.members.find((m) => m.character.name === 'Snag');
     snag.dead = true;
     snag.character.hp.current = 0;
     save.fallen = { at: save.region + '/' + save.position.col + ',' + save.position.row, members: [snag.id] };`,
  );
  const panel = page.getByRole('region', { name: 'Revive the Fallen' });
  await expect(panel).toContainText('Fizzwick: 2 Effort left today');
  await page.screenshot({ path: testInfo.outputPath('revive.png'), fullPage: true });
  await panel.getByRole('button', { name: 'Revive Snag' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Party' })).toContainText('unconscious');
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'Fizzwick revives Snag, who lies unconscious.',
  );
});

test('purges an ally of Frailty, spending Effort win or lose', async ({ page }) => {
  await begin(page);
  await expect(page.getByRole('region', { name: 'Purge Ailment' })).toHaveCount(0);
  await edit(
    page,
    `const fizz = save.members.find((m) => m.character.name === 'Fizzwick').character;
     fizz.classes = { current: 'healer-partial-mage', levels: { 'healer-partial-mage': 8 } };
     fizz.skills.heal = 1;
     fizz.spells = { known: [], prepared: [] };
     fizz.arts = ['healing-touch', 'purge-ailment'];
     save.members.find((m) => m.character.name === 'Snag').frail = true;`,
  );
  const panel = page.getByRole('region', { name: 'Purge Ailment' });
  await expect(panel).toContainText('Fizzwick: 2 Effort left today');
  await panel.getByRole('button', { name: 'Purge Snag' }).click();
  const log = page.getByRole('region', { name: 'Journey log' });
  await expect(log).toContainText(
    /Fizzwick (purges Snag's Frailty|tends Snag, but the Frailty holds)\./,
  );
  // Either way the panel closes: a cure leaves no one to tend, and a Healer gets one try at each
  // Frailty (docs/rules-adaptation.md, Purge Ailment).
  await expect(panel).toHaveCount(0);
  const party = page.getByRole('region', { name: 'Party' });
  if ((await log.innerText()).includes("purges Snag's Frailty"))
    await expect(party).not.toContainText('Frail');
  else await expect(party).toContainText('Frail');
  // The Effort and Snag's 1 System Strain are spent win or lose.
  await expect(party).toContainText('Strain 1/');
  const spent = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    return save.members.find(
      (m: { character: { name: string } }) => m.character.name === 'Fizzwick',
    ).effortDay as number;
  }, WORLD_KEY);
  expect(spent).toBe(1);
});
