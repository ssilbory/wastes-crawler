import { expect, test, type Page } from '@playwright/test';

// The Skinshifter (1.5.15): a first form built in the builder, and Change Form on the map.
const WORLD_KEY = 'wastes-crawler.world';

test('builds a Berserker with a Wolf form', async ({ page }) => {
  const select = (label: string, option: string) =>
    page.getByRole('combobox', { name: label, exact: true }).selectOption({ label: option });
  await page.goto('/');
  await select('People', 'Orc');
  for (const [attr, v] of [
    ['Strength', '14'],
    ['Dexterity', '12'],
    ['Constitution', '11'],
    ['Intelligence', '7'],
    ['Wisdom', '10'],
    ['Charisma', '9'],
  ] as const)
    await select(attr, v);
  await select('Background', 'Raider');
  await select('Learning pick 1', 'Sneak');
  await select('Learning pick 2', 'Exert');
  await select('Class', 'Berserker (Skinshifter/Warrior)');
  for (const [label, option] of [
    ['Bonus skill for War-bred', 'Stab'],
    ['Racial focus', 'Die Hard'],
    ['Combat focus', 'Impervious Defense'],
    ['Any focus', 'Lucky'],
  ] as const)
    await select(label, option);
  const magic = page.locator('section.step', { hasText: '6. Magic' });
  await expect(magic).toContainText('No spells: arts alone');
  await magic.getByLabel('Savage Talons', { exact: true }).check();
  await magic.getByRole('button', { name: 'Add a form' }).click();
  await expect(magic.getByRole('button', { name: 'Add a form' })).toHaveCount(0);
  const form = magic.getByRole('group', { name: 'Form 1' });
  await form.getByLabel('Form 1 name').fill('Wolf');
  await form.getByLabel('Savage Talons', { exact: true }).check();
  await select('Free skill', 'Know');
  await page.getByRole('radio', { name: 'Starting package' }).check();
  await select('Package', 'Apprentice');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Fang');
  await page.getByRole('button', { name: 'Create character' }).click();
  const sheet = page.getByTestId('character-sheet');
  await expect(sheet).toContainText('Arts only.');
  await expect(sheet).toContainText('Arts: Change Form, Savage Talons.');
  await expect(sheet).toContainText('Forms: Wolf: Savage Talons.');
});

async function startWorld(page: Page) {
  const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('skinshifter-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
}

test('changes form on the map for Effort, and goes back for free', async ({ page }) => {
  await startWorld(page);
  // Make Snag a third-level Berserker with two forms, through the autosave.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    const snag = save.members.find(
      (m: { character: { name: string } }) => m.character.name === 'Snag',
    );
    snag.character.classes = {
      current: 'partial-warrior-skinshifter',
      levels: { 'partial-warrior-skinshifter': 3 },
    };
    snag.character.arts = ['change-form', 'savage-talons', 'warform'];
    snag.character.forms = [
      { name: 'Wolf', humanoid: false, arts: ['savage-talons'] },
      { name: 'War Shape', humanoid: true, arts: ['warform'] },
    ];
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  const panel = page.getByRole('region', { name: 'Forms' });
  const snag = panel.getByRole('group', { name: 'Snag' });
  await expect(snag).toContainText('Snag: own shape');
  await snag.getByRole('button', { name: 'Take the Wolf form' }).click();
  await expect(snag).toContainText('Snag: Wolf form');
  // Effort 1 is spent: the War Shape waits for tomorrow.
  await snag.getByRole('button', { name: 'Take the War Shape form' }).click();
  await expect(panel).toContainText('Snag has no Effort left today.');
  await snag.getByRole('button', { name: 'Own shape' }).click();
  await expect(snag).toContainText('Snag: own shape');
});
