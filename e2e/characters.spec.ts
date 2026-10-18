import { expect, test } from '@playwright/test';

// Phase 17: the starter party, the character screen, and managing gear in play.
test('sets out with the starter party and sorts gear on the inventory screen', async ({
  page,
}, testInfo) => {
  await page.goto('/#/world');
  await expect(page.getByText('The roster is empty.')).toBeVisible();
  await page.getByRole('button', { name: 'Use the starter party' }).click();
  await expect(page.getByRole('combobox', { name: 'Front row, slot 1' })).toHaveValue('snag');
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('characters-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();

  await page.getByRole('button', { name: 'Characters' }).click();
  await page.getByRole('tab', { name: 'Grukk' }).click();
  await expect(page.getByTestId('character-sheet')).toContainText('Grukk');
  // Gear has a screen of its own, opened on the member whose sheet was showing.
  await page.getByRole('button', { name: 'Inventory' }).click();
  await expect(page.getByRole('tab', { name: 'Grukk' })).toHaveAttribute('aria-selected', 'true');
  const gear = page.getByRole('region', { name: 'Inventory' });
  await expect(gear).toContainText(/Readied \d+\/\d+, Stowed \d+\/\d+/);
  const dagger = gear.getByRole('group', { name: 'Dagger' });
  await expect(dagger).toContainText('(enc 1)');
  // Arming Drop and then moving the line disarms it, so the drop can't land on another line.
  await dagger.getByRole('button', { name: 'Drop' }).click();
  await expect(dagger.getByRole('button', { name: 'Drop for good' })).toBeVisible();
  await dagger.getByRole('combobox', { name: 'Where Dagger is carried' }).selectOption('stowed');
  await expect(gear.getByRole('button', { name: 'Drop for good' })).toHaveCount(0);
  await expect(dagger.getByRole('combobox', { name: 'Where Dagger is carried' })).toHaveValue(
    'stowed',
  );
  await page.screenshot({ path: testInfo.outputPath('characters.png'), fullPage: true });
  await dagger.getByRole('button', { name: 'Drop' }).click();
  await dagger.getByRole('button', { name: 'Drop for good' }).click();
  await expect(gear.getByRole('group', { name: 'Dagger' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await expect(page.getByRole('img', { name: 'Overland map' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText(
    'Grukk leaves behind Dagger.',
  );
});

test('manages characters on the Characters page, not the Overland start screen', async ({
  page,
}, testInfo) => {
  await page.goto('/#/world');
  await page.getByRole('button', { name: 'Use the starter party' }).click();
  await expect(page.getByRole('region', { name: 'Saved characters' })).toHaveCount(0);
  await page.goto('/#/builder');
  const list = page.getByRole('list', { name: 'Saved characters' });
  await expect(list.getByRole('listitem')).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath('characters.png'), fullPage: true });
  const snag = list.getByRole('listitem').filter({ hasText: 'Snag' });
  await snag.getByRole('button', { name: 'Delete' }).click();
  await snag.getByRole('button', { name: 'Delete Snag for good' }).click();
  await expect(page.getByRole('status')).toHaveText('Snag is deleted.');
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await page.goto('/#/world');
  await expect(page.getByRole('combobox', { name: 'Front row, slot 1' })).not.toHaveValue('snag');
});
