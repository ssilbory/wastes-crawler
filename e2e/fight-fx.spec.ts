import { expect, test, type Locator } from '@playwright/test';

// docs/presentation-plan.md, V3: the fight shows its odds before every attack, the turns left in
// the round, and floats each blow off the slot it lands on.
const starters = ['snag', 'grukk', 'lirael', 'fizzwick'].map(
  (n) => `tools/sim/parties/starter/${n}.json`,
);

async function addMonster(picker: Locator, monster: string, row: string) {
  await picker.getByRole('combobox', { name: 'Monster' }).selectOption({ label: monster });
  await picker.getByRole('button', { name: `Add to ${row}` }).click();
}

test('shows the odds and turn order, and floats each blow', async ({ page }, testInfo) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  const slots: [string, string][] = [
    ['Front row, slot 1', 'Snag'],
    ['Front row, slot 2', 'Grukk'],
    ['Rear row, slot 1', 'Lirael'],
    ['Rear row, slot 2', 'Fizzwick'],
  ];
  for (const [slot, name] of slots)
    await page.getByRole('combobox', { name: slot }).selectOption({ label: name });
  const enemies = page.getByRole('region', { name: 'Enemies' });
  await addMonster(enemies, 'Thug or Militia (HD 1, AC 13)', 'front row');
  await addMonster(enemies, 'Thug or Militia (HD 1, AC 13)', 'front row');
  await addMonster(enemies, 'Veteran Soldier (HD 1, AC 13)', 'second row');
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('fight-fx');
  await page.getByRole('button', { name: 'Start fight' }).click();

  // Whose turn it is leads the strip, and the next round closes it.
  const strip = page.getByRole('list', { name: /^Turn order, round 1/ });
  await expect(strip.locator('[aria-current="step"]')).toHaveCount(1);
  await expect(strip.getByRole('listitem').last()).toHaveText('Round 2');

  // Before a command, the foes in reach are marked.
  await expect(page.locator('.slot.reach-melee .reach-tag').first()).toHaveText('in reach');
  await page.screenshot({ path: testInfo.outputPath('fight-reach.png'), fullPage: true });

  // Picking an attack shows its odds on every target, in the menu and on the field.
  const menu = page.getByRole('region', { name: 'Commands' });
  await menu.locator('button.cmd.attack').first().click();
  await expect(menu.locator('.choices .odds').first()).toHaveText(
    /^\d+% to hit, \d+(–\d+)? damage/,
  );
  const target = page.getByRole('button', { name: /^Target .*% to hit/ }).first();
  await expect(target).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('fight-odds.png'), fullPage: true });

  // The blow, and every turn after it up to the next command, floats off the slots it lands on.
  await target.click();
  await expect(page.locator('.slot .float').first()).toBeAttached();
  await page.screenshot({ path: testInfo.outputPath('fight-floats.png'), fullPage: true });

  // The log shows one side's turns at a time.
  const log = page.getByRole('region', { name: 'Battle log' });
  const all = await log.getByRole('listitem').count();
  await log.getByRole('button', { name: 'The party' }).click();
  await expect(log.getByRole('button', { name: 'The party' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const ours = await log.getByRole('listitem').count();
  expect(ours).toBeGreaterThan(0);
  expect(ours).toBeLessThan(all);
  await expect(log.locator('ol')).toContainText('Snag');
  await log.getByRole('button', { name: 'All' }).click();
  await expect(log.getByRole('listitem')).toHaveCount(all);
});
