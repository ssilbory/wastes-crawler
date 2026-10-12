import { expect, test } from '@playwright/test';

// Saved dungeons in the game (Sam's call): a dungeon made and saved in the level editor is on the
// overland map and can be entered.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

test('plays a dungeon saved in the level editor', async ({ page }) => {
  await page.goto('/#/editor');
  await page.getByRole('button', { name: 'New dungeon' }).click();
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('The Sump');
  await name.blur();
  await page.getByRole('button', { name: 'Save dungeon*' }).click();
  await expect(page.getByRole('note')).toHaveText(
    'In the game: open the Overland screen to play it.',
  );
  const col = Number(await page.getByRole('spinbutton', { name: 'Column' }).inputValue());
  const row = Number(await page.getByRole('spinbutton', { name: 'Row' }).inputValue());

  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await page.evaluate(
    ([key, c, r]) => {
      const save = JSON.parse(localStorage.getItem(key as string) as string);
      save.position = { col: c, row: r };
      save.visited.push(`${c},${r}`);
      localStorage.setItem(key as string, JSON.stringify(save));
    },
    [WORLD_KEY, col, row] as const,
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(page.locator(`[data-hex="${col},${row}"] .dungeon`)).toBeVisible();
  await page.getByRole('button', { name: 'Enter The Sump' }).click();
  await expect(page.locator('.world-bar')).toContainText('Level 1, facing south');
  await expect(page.getByRole('img', { name: 'Dungeon view' })).toBeVisible();
});
