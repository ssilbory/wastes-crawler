import { expect, test, type Page } from '@playwright/test';

// The Phase 6 exit criterion (docs/plan.md): accept a quest in town, complete it on the hex map,
// and collect the reward.
const starters = ['snag', 'grukk', 'lirael', 'fizzwick'].map(
  (n) => `tools/sim/parties/starter/${n}.json`,
);

async function fightIfMet(page: Page): Promise<boolean> {
  const encounter = page.getByRole('region', { name: 'Encounter' });
  if (!(await encounter.isVisible())) return false;
  await encounter.getByRole('button', { name: /^(Fight|Attack them)$/ }).click();
  await page.getByRole('button', { name: 'Auto-resolve' }).click();
  await page.getByRole('button', { name: 'Back to the map' }).click();
  return true;
}

/** Hikes toward a hex until `done` holds, fighting whatever turns up. */
async function walk(page: Page, hex: string, done: () => Promise<boolean>) {
  for (let i = 0; i < 40 && !(await done()); i++) {
    if (await fightIfMet(page)) continue;
    await page.locator(`[data-hex="${hex}"]`).click();
    await page.getByRole('button', { name: /^(Hike|Camp) for the quarter$/ }).click();
  }
}

test('takes a quest in town, finishes it on the map, and collects the reward', async ({
  page,
}, testInfo) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  // The arena has a formation of its own: wait for the Overland page before picking slots.
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  const slots: [string, string][] = [
    ['Front row, slot 1', 'Snag'],
    ['Front row, slot 2', 'Grukk'],
    ['Rear row, slot 1', 'Lirael'],
    ['Rear row, slot 2', 'Fizzwick'],
  ];
  for (const [slot, name] of slots)
    await page.getByRole('combobox', { name: slot }).selectOption({ label: name });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('quest-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();

  // The reeve's map shows the way: the land between Rubblegate and the camp is known.
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('wastes-crawler.world') as string);
    for (let col = 3; col <= 6; col++)
      for (let row = 8; row <= 12; row++) save.visited.push(`${col},${row}`);
    localStorage.setItem('wastes-crawler.world', JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();

  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  const reeve = page.getByRole('region', { name: 'Reeve Halda' });
  await reeve.getByRole('button', { name: 'Take on The Raider Camp' }).click();
  await expect(reeve).toContainText('Break the raider camp in the forest at 6,12.');
  await page.screenshot({ path: testInfo.outputPath('quest-board.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back to the map' }).click();

  const log = page.getByRole('region', { name: 'Journey log' });
  const quests = page.getByRole('region', { name: 'Quests' });
  await expect(quests).toContainText('The Raider Camp');
  await walk(page, '6,12', async () => (await log.innerText()).includes('The Raider Camp: done.'));
  await expect(quests).toContainText('Done: return for the reward.');
  await page.screenshot({ path: testInfo.outputPath('quest-done.png'), fullPage: true });

  await walk(page, '3,8', () => page.getByRole('button', { name: 'Visit Rubblegate' }).isVisible());
  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  await reeve.getByRole('button', { name: 'Collect the reward' }).click();
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'Reeve Halda pays for The Raider Camp: 60 crowns and 3 XP each.',
  );
  await expect(reeve).toContainText('Done.');
});
