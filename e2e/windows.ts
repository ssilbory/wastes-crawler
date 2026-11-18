import type { Locator, Page } from '@playwright/test';

/**
 * Opens one of the overland map's windows from the ☰ menu and returns its panel. The window
 * covers the map until closeWindow.
 */
export async function openWindow(page: Page, name: string): Promise<Locator> {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page
    .getByRole('navigation', { name: 'Windows' })
    .getByRole('button', { name, exact: true })
    .click();
  return page.getByRole('dialog', { name, exact: true }).getByRole('region', { name, exact: true });
}

/** Closes the open window, back to the map. */
export async function closeWindow(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close', exact: true }).click();
}

/** The names of the windows the ☰ menu offers now, leaving the menu closed again. */
export async function windowNames(page: Page): Promise<string[]> {
  await page.getByRole('button', { name: 'Menu' }).click();
  const names = await page
    .getByRole('navigation', { name: 'Windows' })
    .getByRole('button')
    .allInnerTexts();
  await page.getByRole('button', { name: 'Menu' }).click();
  return names;
}

/** Opens a window, does `look` with its panel, and closes it again. */
export async function inWindow(
  page: Page,
  name: string,
  look: (panel: Locator) => Promise<void>,
): Promise<void> {
  await look(await openWindow(page, name));
  await closeWindow(page);
}
