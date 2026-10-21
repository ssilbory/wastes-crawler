import { expect, test } from '@playwright/test';

// The overland map editor (Sam's calls): roll a random map with settlements, edit a hex, put a
// dungeon on it, save it in the browser, and pick it again after a reload.
test('rolls, edits, and saves an overland map with a dungeon on it', async ({ page }, testInfo) => {
  await page.goto('/#/maps');
  const problems = page.getByRole('region', { name: 'Problems' });
  await expect(problems).toContainText('The map is valid.');

  const random = page.getByRole('region', { name: 'New map' });
  await random.getByRole('textbox', { name: 'Name' }).fill('Ember Wastes');
  await random.getByRole('textbox', { name: 'Seed' }).fill('42');
  await random.getByRole('button', { name: 'Roll a new map' }).click();
  await expect(page.getByRole('group', { name: 'Editing Ember Wastes' })).toBeVisible();
  await expect(problems).toContainText('The map is valid.');
  await expect(page.locator('.hex .site')).toHaveCount(5);
  await page.screenshot({ path: testInfo.outputPath('map-editor.png'), fullPage: true });

  // A blank map is one terrain with a village to start in; rolling again comes after.
  await random.getByRole('button', { name: 'Create blank map' }).click();
  await expect(page.locator('.hex .site')).toHaveCount(1);
  await expect(problems).toContainText('The map is valid.');
  await random.getByRole('textbox', { name: 'Seed' }).fill('42');
  await random.getByRole('button', { name: 'Roll a new map' }).click();
  await expect(page.locator('.hex .site')).toHaveCount(5);

  // Painting a settlement's hex as lake is a problem; painting it back clears it.
  const site = page.locator('.hex:has(.site)').first();
  const key = (await site.getAttribute('data-hex')) as string;
  await page.getByRole('radio', { name: 'Lake' }).click();
  await site.click();
  await expect(problems).toContainText('on impassable land');
  await page.getByRole('radio', { name: 'Plains' }).click();
  await page.locator(`[data-hex="${key}"]`).click();
  await expect(problems).toContainText('The map is valid.');

  // Select a hex, rename its settlement, and put the barrow there's no room for: a town.
  await page.getByRole('radio', { name: 'Select' }).click();
  await page.locator(`[data-hex="${key}"]`).click();
  const hex = page.getByRole('region', { name: 'Hex details' });
  await hex.getByRole('textbox', { name: 'Settlement name' }).fill('Emberhold');
  await hex.getByRole('textbox', { name: 'Settlement name' }).blur();
  await hex.getByRole('button', { name: 'Put it here' }).click();
  await expect(problems).toContainText('the entrance is in a town');
  await hex.getByRole('button', { name: 'Remove settlement' }).click();
  await expect(problems).toContainText('The map is valid.');
  await expect(page.locator(`[data-hex="${key}"] .dungeon`)).toHaveCount(1);

  await page.getByRole('button', { name: 'Save map*' }).click();
  await expect(page.getByRole('status')).toContainText('Saved Ember Wastes and the dungeons on it');

  // After a reload the saved map is there to pick, with its dungeon.
  await page.reload();
  await page.getByRole('combobox', { name: 'Map' }).selectOption({ label: 'Ember Wastes (saved)' });
  await expect(page.locator('.hex .site')).toHaveCount(4);
  await expect(page.locator(`[data-hex="${key}"] .dungeon`)).toHaveCount(1);

  // The level editor sees the dungeon on its new map.
  await page.goto('/#/editor');
  await expect(page.getByRole('combobox', { name: 'Map' })).toHaveValue('ember-wastes');
});

test('creates, edits, and saves a new dungeon', async ({ page }) => {
  await page.goto('/#/editor');
  await page.getByRole('button', { name: 'New dungeon' }).click();
  await expect(page.getByRole('status')).toContainText('Created and saved New dungeon');
  const problems = page.getByRole('region', { name: 'Problems' });
  await expect(problems).toContainText('The dungeon is valid.');

  // A second level, reached by stairs linked both ways.
  await page.getByRole('button', { name: 'Add level' }).click();
  await page.getByRole('radio', { name: 'Stairs up' }).click();
  await page.locator('[data-cell="0,0"]').click();
  await expect(problems).toContainText('stairs at 0,0 lead nowhere');
  await page
    .getByRole('combobox', { name: 'Level', exact: true })
    .selectOption({ label: 'Level 1' });
  await page.getByRole('radio', { name: 'Open' }).click();
  await page.locator('[data-edge="1,0,w"]').dispatchEvent('click');
  await page.getByRole('radio', { name: 'Stairs down' }).click();
  await page.locator('[data-cell="1,0"]').click();
  const cell = page.getByRole('region', { name: 'Cell details' });
  await cell.getByRole('combobox', { name: 'Lead to' }).selectOption({ label: 'Level 2' });
  await cell.getByRole('button', { name: 'Link the stairs there back here' }).click();
  await expect(problems).toContainText('The dungeon is valid.');

  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('The Sump');
  await page.getByRole('textbox', { name: 'Name', exact: true }).blur();
  await page.getByRole('button', { name: 'Save dungeon*' }).click();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Dungeon' })).toContainText('The Sump (saved)');
});
