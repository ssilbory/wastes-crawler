import { expect, test, type Locator, type Page } from '@playwright/test';

// The Phase 4 exit criterion (docs/plan.md): fight a chosen party against chosen monsters, and
// watch a monster vs monster fight to the end.
const starters = ['snag', 'grukk', 'lirael', 'fizzwick'].map(
  (n) => `tools/sim/parties/starter/${n}.json`,
);

async function addMonster(picker: Locator, monster: string, row: string) {
  await picker.getByRole('combobox', { name: 'Monster' }).selectOption({ label: monster });
  await picker.getByRole('button', { name: `Add to ${row}` }).click();
}

const result = (page: Page) => page.getByRole('status').filter({ hasText: 'wins' });

test('fights a chosen party against chosen monsters', async ({ page }, testInfo) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  const roster = page.getByRole('region', { name: 'Roster' });
  await expect(roster.getByRole('listitem')).toHaveCount(4);

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
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('arena-e2e');
  await page.getByRole('button', { name: 'Start fight' }).click();

  // One command by hand: the first attack, aimed by clicking a highlighted foe.
  const menu = page.getByRole('region', { name: 'Commands' });
  await expect(menu).toBeVisible();
  await menu.locator('button.cmd.attack').first().click();
  await page
    .getByRole('button', { name: /^Target / })
    .first()
    .click();
  await page.screenshot({ path: testInfo.outputPath('arena-fight.png'), fullPage: true });

  // The rest by each character's default action, a round at a time.
  const defaults = page.getByRole('button', { name: 'Defaults for the round' });
  for (let i = 0; i < 100 && (await defaults.isVisible()); i++) await defaults.click();
  await expect(result(page)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Battle log' })).toContainText('Round 1:');
  await page.screenshot({ path: testInfo.outputPath('arena-result.png'), fullPage: true });

  // The roster is saved in the browser.
  await page.getByRole('button', { name: 'New fight' }).click();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(4);
});

test('watches a monster vs monster fight to the end', async ({ page }, testInfo) => {
  await page.goto('/#/arena');
  await page.getByRole('tab', { name: 'Monster vs monster' }).click();
  const left = page.getByRole('region', { name: 'Left side' });
  const right = page.getByRole('region', { name: 'Right side' });
  await addMonster(left, 'Veteran Soldier (HD 1, AC 13)', 'front row');
  await addMonster(left, 'Veteran Soldier (HD 1, AC 13)', 'front row');
  await addMonster(right, 'Thug or Militia (HD 1, AC 13)', 'front row');
  await addMonster(right, 'Thug or Militia (HD 1, AC 13)', 'front row');
  await addMonster(right, 'Thug or Militia (HD 1, AC 13)', 'second row');
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('spectator-e2e');
  await page.getByRole('button', { name: 'Start fight' }).click();
  await expect(page.getByRole('region', { name: 'The left side' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'The right side' })).toBeVisible();

  // Step once, then play the rest at speed, unless the first round already settled it.
  await page.getByRole('button', { name: 'Step round' }).click();
  await expect(page.getByRole('region', { name: 'Battle log' })).toContainText('Round 1:');
  const play = page.getByRole('button', { name: 'Play' });
  if (await play.isVisible()) {
    await page.getByRole('combobox', { name: 'Speed' }).selectOption({ label: 'Fast' });
    await play.click();
  }
  await expect(result(page).or(page.getByText('The fight is a draw.'))).toBeVisible({
    timeout: 60_000,
  });
  await page.screenshot({ path: testInfo.outputPath('arena-spectator.png'), fullPage: true });
});

test('takes a character from the Characters page to the arena roster', async ({ page }) => {
  await page.goto('/#/builder');
  await page.getByLabel('Import character files').setInputFiles(starters[0] as string);
  await expect(page.getByRole('status')).toContainText('Snag joined the roster.');
  await page.getByRole('link', { name: 'arena', exact: true }).click();
  const roster = page.getByRole('region', { name: 'Roster' });
  await expect(roster.getByRole('listitem')).toHaveCount(1);
  await expect(roster).toContainText('Snag, level 1 Warrior');
});
