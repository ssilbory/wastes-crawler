import { expect, test, type Page } from '@playwright/test';

// Phase 14b: a Necromancer raises a skeleton from the corpses of a won fight into an NPC slot,
// then releases it.
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

test('raises a skeleton from the fallen and releases it', async ({ page }, testInfo) => {
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
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('necromancy-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await expect(page.getByRole('region', { name: 'Necromancy' })).toHaveCount(0);
  await edit(
    page,
    `const fizz = save.members.find((m) => m.character.name === 'Fizzwick').character;
     fizz.classes = { current: 'full-necromancer', levels: { 'full-necromancer': 3 } };
     fizz.spells = { known: ['raise-corpse', 'command-the-dead', 'smite-the-dead', 'query-the-skull'],
       prepared: ['raise-corpse', 'command-the-dead', 'smite-the-dead'] };
     fizz.arts = ['bonetalker'];
     save.corpses = { at: save.region + '/' + save.position.col + ',' + save.position.row, hitDice: [1, 1],
       day: save.day, queried: false };`,
  );
  const panel = page.getByRole('region', { name: 'Necromancy' });
  await expect(panel).toContainText('2 corpses lie here.');
  await expect(panel).toContainText('Fizzwick: 2 spells left today');
  await panel.getByRole('button', { name: 'Raise a skeleton' }).click();
  await expect(panel).toContainText('A corpse lies here.');
  const npcs = page.getByRole('region', { name: 'NPCs' });
  await expect(npcs).toContainText('Raised Skeleton undead, serving Fizzwick');
  await page.screenshot({ path: testInfo.outputPath('necromancy.png'), fullPage: true });
  await npcs.getByRole('button', { name: 'Release' }).click();
  await expect(npcs).not.toContainText('Raised Skeleton');
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'Raised Skeleton is released and falls still.',
  );
});

test('questions the dead, then reshapes a companion and lifts it', async ({ page }) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page
    .getByRole('combobox', { name: 'Rear row, slot 1' })
    .selectOption({ label: 'Fizzwick' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('necromancy-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await edit(
    page,
    `const fizz = save.members.find((m) => m.character.name === 'Fizzwick').character;
     fizz.classes = { current: 'full-necromancer', levels: { 'full-necromancer': 7 } };
     fizz.spells = { known: ['query-the-skull', 'boneshaper'], prepared: ['query-the-skull', 'boneshaper'] };
     fizz.arts = ['bonetalker'];
     save.corpses = { at: save.region + '/' + save.position.col + ',' + save.position.row, hitDice: [1],
       day: save.day, queried: false };`,
  );
  const panel = page.getByRole('region', { name: 'Necromancy' });
  await expect(panel).toContainText('Query the Skull (up to 7 questions)');
  await panel.getByRole('checkbox', { name: 'The lay of the land' }).check();
  await panel.getByRole('button', { name: 'Question the dead' }).click();
  const log = page.getByRole('region', { name: 'Journey log' });
  await expect(log).toContainText('The dead describe the land about.');
  await expect(panel).toContainText('Query the Skull: These dead have already spoken.');

  await panel.getByRole('combobox', { name: 'Shape' }).selectOption({ label: 'Snag' });
  await panel.getByRole('combobox', { name: 'Raise' }).selectOption('str');
  await panel.getByRole('combobox', { name: 'Lower' }).selectOption('con');
  await panel.getByRole('button', { name: 'Reshape' }).click();
  await expect(panel).toContainText('Snag is shaped (+1 STR, −1 CON).');
  await panel.getByRole('button', { name: 'Lift the shaping from Snag' }).click();
  await expect(panel).not.toContainText('Snag is shaped');
  await expect(log).toContainText("Fizzwick lets Snag's flesh settle back into its old shape.");
});
