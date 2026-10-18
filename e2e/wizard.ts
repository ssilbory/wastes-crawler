import type { Page } from '@playwright/test';

/** Opens a step of the character builder from its step list, as a player would. */
export async function openStep(page: Page, step: string) {
  await page
    .getByRole('navigation', { name: 'Character steps' })
    .getByRole('button', { name: step })
    .click();
}

/** Imports character files on the Characters page and opens the named character's sheet. */
export async function importAndOpen(page: Page, files: string | string[], name: string) {
  await page.goto('/#/builder');
  await page.getByLabel('Import character files').setInputFiles(files);
  await page
    .getByRole('listitem')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Sheet' })
    .click();
}
