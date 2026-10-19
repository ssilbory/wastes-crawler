import { expect, test } from '@playwright/test';

// Phase 17: the starter party, the character screen, and managing gear in play.
test('sets out with the starter party and sorts gear on the inventory screen', async ({
  page,
}, testInfo) => {
  await page.goto('/#/world');
  await expect(page.getByText('The roster is empty.')).toBeVisible();
  await page.getByRole('button', { name: 'Use the starter party' }).click();
  // Those who fight stand in front, those who cast behind.
  await expect(page.getByRole('combobox', { name: 'Front row, slot 1' })).toHaveValue('gretar');
  await expect(page.getByRole('combobox', { name: 'Rear row, slot 3' })).toHaveValue('lashana');
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('characters-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();

  await page.getByRole('button', { name: 'Characters' }).click();
  await page.getByRole('tab', { name: 'Marsan' }).click();
  await expect(page.getByTestId('character-sheet')).toContainText('Marsan');
  // Gear has a screen of its own, opened on the member whose sheet was showing.
  await page.getByRole('button', { name: 'Inventory' }).click();
  await expect(page.getByRole('tab', { name: 'Marsan' })).toHaveAttribute('aria-selected', 'true');
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
    'Marsan leaves behind Dagger.',
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
  await expect(list.getByRole('listitem')).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('characters.png'), fullPage: true });
  const gretar = list.getByRole('listitem').filter({ hasText: 'Gretar' });
  await gretar.getByRole('button', { name: 'Delete' }).click();
  await gretar.getByRole('button', { name: 'Delete Gretar for good' }).click();
  await expect(page.getByRole('status')).toHaveText('Gretar is deleted.');
  await expect(list.getByRole('listitem')).toHaveCount(5);
  await page.goto('/#/world');
  const slot = page.getByRole('combobox', { name: 'Front row, slot 1' });
  await expect(slot.getByRole('option', { name: 'Marsan' })).toHaveCount(1);
  await expect(slot.getByRole('option', { name: 'Gretar' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Characters page' })).toBeVisible();
});

test('opens a sheet over the list, scrolls to its end, and closes it', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 900, height: 360 });
  await page.goto('/#/builder');
  const starters = ['snag', 'grukk', 'lirael', 'fizzwick'].map(
    (n) => `tools/sim/parties/starter/${n}.json`,
  );
  await page.getByLabel('Import character files').setInputFiles(starters);
  // The list scrolls when it runs past the window.
  const sheetButton = page.getByRole('button', { name: "Fizzwick's sheet" });
  await sheetButton.scrollIntoViewIfNeeded();
  await expect(sheetButton).toBeInViewport();
  await sheetButton.click();

  const dialog = page.getByRole('dialog', { name: "Fizzwick's sheet" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('sheet-popup.png') });
  const last = dialog.locator('li').filter({ hasText: 'Die Hard' }).last();
  await expect(last).not.toBeInViewport();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();

  // Tab stays in the sheet, away from the list it covers.
  for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(sheetButton).toBeFocused();
  // A click on the dim around the sheet closes it too.
  await sheetButton.click();
  await page.mouse.click(4, 4);
  await expect(dialog).toHaveCount(0);
  await expect(sheetButton).toBeFocused();
  await sheetButton.click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
});
