import { expect, test } from '@playwright/test';

// The Phase 3a exit criterion (docs/plan.md): build a Goblin Warrior in the browser, export it to
// JSON, reload the page, and import it.
test('builds, exports, and re-imports a Goblin Warrior', async ({ page }, testInfo) => {
  await page.goto('/');
  const select = (label: string, option: string) =>
    page.getByRole('combobox', { name: label, exact: true }).selectOption({ label: option });

  const array = [
    ['Strength', '14'],
    ['Dexterity', '12'],
    ['Constitution', '11'],
    ['Intelligence', '10'],
    ['Wisdom', '9'],
    ['Charisma', '7'],
  ];
  await select('People', 'Goblin');
  for (const [attr, value] of array) await select(attr as string, value as string);

  await select('Background', 'Raider');
  await select('Learning pick 1', 'Sneak');
  await select('Learning pick 2', 'Exert');
  await select('Class', 'Warrior');
  await select('Racial focus', 'Alert');
  await select('Combat focus', 'Armsmaster');
  await select('Any focus', 'Lucky');
  await select('Free skill', 'Notice');
  await page.getByRole('radio', { name: 'Starting package' }).check();
  await select('Package', 'Shield Wall');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Snag');
  await page.getByRole('textbox', { name: 'Goal', exact: true }).fill('Outlive the war-band');

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

  await page.reload();
  await expect(sheet).toHaveCount(0);
  await page.getByLabel('Import character file').setInputFiles(file);
  await expect(sheet).toBeVisible();
  expect(await sheet.innerText()).toBe(before);
});

test('shows validation errors for a bad import', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Import character file').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion": 1, "name": ""}'),
  });
  await expect(page.getByRole('alert')).toContainText('broken.json: ');
  await expect(page.getByTestId('character-sheet')).toHaveCount(0);
});
