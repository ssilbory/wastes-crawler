import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Phase 11c: the level editor. Paint the barrow's grid, see the validator react, walk it in first
// person, and export the same ASCII format the game loads (docs/decisions/0003-level-authoring.md).
// Edges are SVG lines with no area, so clicks on them are dispatched.
test('edits, validates, test-walks, and exports a level', async ({ page }, testInfo) => {
  await page.goto('/#/editor');
  const problems = page.getByRole('region', { name: 'Problems' });
  await expect(problems).toContainText('The dungeon is valid.');
  const text = page.getByRole('textbox', { name: 'Map text' });
  await expect(text).toHaveValue(/^\+-\+-\+/);

  // A door from the corridor into the walled-up cell at 0,3.
  await page.getByRole('radio', { name: 'Door', exact: true }).click();
  await page.locator('[data-edge="1,3,w"]').dispatchEvent('click');
  expect((await text.inputValue()).split('\n')[7]).toBe('| d | | | | |       |');
  await expect(problems).toContainText('The dungeon is valid.');

  // Walling the entry room in cuts the level off.
  await page.getByRole('radio', { name: 'Wall' }).click();
  for (const e of ['0,8,n', '1,8,n', '2,8,n', '3,8,w'])
    await page.locator(`[data-edge="${e}"]`).dispatchEvent('click');
  await expect(problems).toContainText("can't be reached from the entry");
  await page.screenshot({ path: testInfo.outputPath('editor.png'), fullPage: true });
  await page.getByRole('button', { name: 'Revert level' }).click();
  await expect(problems).toContainText('The dungeon is valid.');

  // A trap needs its details in the level JSON, and the validator says so.
  await page.getByRole('radio', { name: 'Trap' }).click();
  await page.locator('[data-cell="0,0"]').click();
  await expect(problems).toContainText('the trap at 0,0 has no details');
  await page.getByRole('radio', { name: 'Floor' }).click();
  await page.locator('[data-cell="0,0"]').click();
  await expect(problems).toContainText('The dungeon is valid.');

  // Walk it: west across the entry room into the wall.
  await page.getByRole('button', { name: 'Walk this level' }).click();
  const walk = page.getByRole('region', { name: 'Test walk' });
  await expect(page.getByRole('img', { name: 'Test walk view' })).toBeVisible();
  await walk.getByRole('button', { name: 'Turn left' }).click();
  await walk.getByRole('button', { name: 'Forward' }).click();
  await expect(walk.locator('.bump')).toHaveText(' ');
  await walk.getByRole('button', { name: 'Forward' }).click();
  await expect(walk.locator('.bump')).toHaveText('A wall blocks the way.');
  await page.keyboard.press('d');
  await page.keyboard.press('w');
  await expect(walk.locator('.bump')).toHaveText(' ');

  // Export: the file holds the edited map, row for row.
  await page.getByRole('radio', { name: 'Door', exact: true }).click();
  await page.locator('[data-edge="1,3,w"]').dispatchEvent('click');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download dungeons.json' }).click();
  const file = testInfo.outputPath('dungeons.json');
  await (await download).saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect(exported[0].levels[0].map.join('\n')).toBe(await text.inputValue());
});
