import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { importAndOpen, openStep } from './wizard.ts';

const select = (page: Page, label: string, option: string) =>
  page.getByRole('combobox', { name: label, exact: true }).selectOption({ label: option });

/** Fills in every step for Snag, a Goblin Raider Warrior, ready to create. */
async function fillSnag(page: Page) {
  await page.goto('/#/builder/new');
  const array = [
    ['Strength', '14'],
    ['Dexterity', '12'],
    ['Constitution', '11'],
    ['Intelligence', '10'],
    ['Wisdom', '9'],
    ['Charisma', '7'],
  ];
  await select(page, 'People', 'Goblin');
  await openStep(page, 'Attributes');
  for (const [attr, value] of array) await select(page, attr as string, value as string);

  await openStep(page, 'Background');
  await select(page, 'Background', 'Raider');
  await select(page, 'Learning pick 1', 'Sneak');
  await select(page, 'Learning pick 2', 'Exert');
  await openStep(page, 'Class');
  await select(page, 'Class', 'Warrior');
  await openStep(page, 'Foci');
  await select(page, 'Racial focus', 'Alert');
  await select(page, 'Combat focus', 'Armsmaster');
  await select(page, 'Any focus', 'Lucky');
  await openStep(page, 'Free skill');
  await select(page, 'Free skill', 'Notice');
  await openStep(page, 'Gear');
  await page.getByRole('radio', { name: 'Starting package' }).check();
  await select(page, 'Package', 'Shield Wall');
  await openStep(page, 'Name and goal');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Snag');
  await page.getByRole('textbox', { name: 'Goal', exact: true }).fill('Outlive the war-band');
}

// The Phase 3a exit criterion (docs/plan.md): build a Goblin Warrior in the browser, export it to
// JSON, reload the page, and import it.
test('builds, exports, and re-imports a Goblin Warrior', async ({ page }, testInfo) => {
  await fillSnag(page);

  const preview = page.getByRole('complementary', { name: 'Character preview' });
  await expect(preview).toContainText('Attack bonus: +1');
  await page.screenshot({ path: testInfo.outputPath('builder.png'), fullPage: true });

  await page.getByRole('button', { name: 'Create character' }).click();
  const sheet = page.getByTestId('character-sheet');
  await expect(sheet).toContainText('Goblin Warrior, level 1. Background: Raider.');
  // Goblin: +2 Dex, +1 Int, -2 Str on top of the array.
  for (const text of ['Strength12', 'Dexterity14+1', 'Intelligence11', 'Charisma7-1'])
    await expect(sheet).toContainText(text);
  // Warren-born raises Sneak, Armsmaster raises Stab, and the free pick raises Alert's Notice.
  for (const skill of ['Exert-0', 'Notice-1', 'Sneak-1', 'Stab-1', 'Survive-0'])
    await expect(sheet).toContainText(skill);
  // Phase 3d fixture: small cuirass 15 with a large shield is max(15, 17), plus Dex 1.
  await expect(sheet).toContainText('AC 18.');
  await expect(sheet).toContainText('Spear, Light (melee) +3, 1d6+2, Shock 4/AC 13');
  await expect(sheet).toContainText('Unarmed Attack (melee) +0, 1d2+1');
  await expect(sheet).toContainText('Cuirass and Greaves (small): worn');
  await expect(sheet).toContainText('Purse: 10 crowns.');
  for (const focus of ['Warren-born-1', 'Scrounger-1', 'Alert-1', 'Armsmaster-1', 'Lucky-1'])
    await expect(sheet).toContainText(focus);
  const before = await sheet.innerText();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const file = testInfo.outputPath('snag.json');
  await (await download).saveAs(file);
  expect((await download).suggestedFilename()).toBe('Snag.json');

  await importAndOpen(page, file, 'Snag');
  await expect(sheet).toBeVisible();
  expect(await sheet.innerText()).toBe(before);
});

test('shows validation errors for a bad import', async ({ page }) => {
  await page.goto('/#/builder');
  await page.getByLabel('Import character files').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion": 1, "name": ""}'),
  });
  await expect(page.getByRole('alert')).toContainText('broken.json: ');
  await expect(page.getByRole('list', { name: 'Saved characters' })).toHaveCount(0);
});

test('imports several files at once, re-ids a duplicate, and reports a broken one', async ({
  page,
}) => {
  await page.goto('/#/builder');
  const json = (name: string, text: string) => ({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  const snag = json('snag.json', readFileSync('tools/sim/parties/starter/snag.json', 'utf8'));
  await page
    .getByLabel('Import character files')
    .setInputFiles([snag, snag, json('broken.json', '{}')]);
  await expect(page.getByRole('status')).toHaveText('Snag, Snag joined the roster.');
  await expect(page.getByRole('alert')).toContainText('broken.json: ');
  const list = page.getByRole('list', { name: 'Saved characters' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  const ids = await page.evaluate(() => {
    const raw = localStorage.getItem('wastes-crawler.roster') ?? '{}';
    const roster = JSON.parse(raw) as { entries: { character: { id: string } }[] };
    return roster.entries.map((e) => e.character.id);
  });
  expect(new Set(ids).size).toBe(2);
});

test('saves, edits over the original, and saves a renamed copy as a new character', async ({
  page,
}) => {
  await fillSnag(page);
  await page.getByRole('button', { name: 'Create character' }).click();
  await page.getByRole('button', { name: 'Save character' }).click();
  await expect(page.getByRole('status')).toHaveText('Snag joined the roster.');
  const list = page.getByRole('list', { name: 'Saved characters' });
  await expect(list.getByRole('listitem')).toHaveCount(1);

  const row = (name: string) => list.getByRole('listitem').filter({ hasText: name });
  await row('Snag').getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Editing Snag' })).toBeVisible();
  // Every pick comes back, so the character can be created again at once.
  await openStep(page, 'Name and goal');
  await page.getByRole('textbox', { name: 'Goal', exact: true }).fill('Rule the warren');
  await page.getByRole('button', { name: 'Create character' }).click();
  await page.getByRole('button', { name: 'Save over Snag' }).click();
  await expect(page.getByRole('status')).toHaveText('Snag is saved.');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await row('Snag').getByRole('button', { name: 'Sheet' }).click();
  await expect(page.getByTestId('character-sheet')).toContainText('Rule the warren');
  await page.keyboard.press('Escape');

  await row('Snag').getByRole('button', { name: 'Edit' }).click();
  await openStep(page, 'Name and goal');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Grit');
  await page.getByRole('button', { name: 'Create character' }).click();
  await page.getByRole('button', { name: 'Save as a new character' }).click();
  await expect(page.getByRole('status')).toHaveText('Grit joined the roster.');
  await expect(list.getByRole('listitem')).toHaveCount(2);

  await page.reload();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await row('Grit').getByRole('button', { name: 'Delete' }).click();
  await row('Grit').getByRole('button', { name: 'Keep' }).click();
  await row('Grit').getByRole('button', { name: 'Delete' }).click();
  await row('Grit').getByRole('button', { name: 'Delete Grit for good' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).not.toContainText('Grit');
});

test('opens an imported character with the picks its sheet shows', async ({ page }) => {
  await page.goto('/#/builder');
  await page
    .getByLabel('Import character files')
    .setInputFiles('tools/sim/parties/starter/snag.json');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('The builder has no picks saved for this character')).toBeVisible();
  await openStep(page, 'Name and goal');
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Snag');
  await page.getByRole('button', { name: 'Back to characters' }).click();
  await expect(page.getByRole('heading', { name: 'Characters' })).toBeVisible();
});
