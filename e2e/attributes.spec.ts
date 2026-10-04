import { expect, test } from '@playwright/test';

// Phase 16: attributes rolled 3d6 in order with one score swapped for 14 (SRD 1.1.1); three free
// rerolls, then the builder asks for the stats the player wants (Sam's call).
test('rolls, rerolls three times, then takes the stats the player names', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const select = (label: string, option: string) =>
    page.getByRole('combobox', { name: label, exact: true }).selectOption({ label: option });
  await select('People', 'Goblin');
  await page.getByRole('radio', { name: 'Roll 3d6 in order' }).check();
  const step = page.locator('section.step', { hasText: '2. Attributes' });
  await expect(step).toContainText('Rolled: Strength');
  await expect(step).toContainText('Rerolls: 0 of 3');
  await select('Set one score to 14', 'Wisdom');
  await expect(step).toHaveClass(/step-ok/);
  for (const n of [1, 2, 3]) {
    await page.getByRole('button', { name: 'Reroll' }).click();
    await expect(step).toContainText(`Rerolls: ${n} of 3`);
  }
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reroll' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Your own stats' });
  await expect(dialog).toContainText("Why don't you just tell me the stats you want?");
  await page.screenshot({ path: testInfo.outputPath('stats-prompt.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Set my stats' }).click();
  const scores = [
    ['Strength', '16'],
    ['Dexterity', '18'],
    ['Constitution', '13'],
    ['Intelligence', '12'],
    ['Wisdom', '10'],
    ['Charisma', '8'],
  ];
  for (const [attr, value] of scores)
    await step.getByRole('spinbutton', { name: attr as string }).fill(value as string);
  await expect(step).toHaveClass(/step-ok/);
  await step.getByRole('spinbutton', { name: 'Charisma' }).fill('19');
  await expect(step).toContainText('each score must be a whole number from 3 to 18');
  await step.getByRole('spinbutton', { name: 'Charisma' }).fill('8');

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
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Grit');
  await page.getByRole('button', { name: 'Create character' }).click();
  const sheet = page.getByTestId('character-sheet');
  // Goblin: -2 Str, +2 Dex (18 stays 18), +1 Int on the named scores.
  for (const text of ['Strength14+1', 'Dexterity18+2', 'Intelligence13'])
    await expect(sheet).toContainText(text);
});
