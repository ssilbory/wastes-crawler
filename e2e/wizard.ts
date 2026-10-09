import type { Page } from '@playwright/test';

/** Opens a step of the character builder from its step list, as a player would. */
export async function openStep(page: Page, step: string) {
  await page
    .getByRole('navigation', { name: 'Character steps' })
    .getByRole('button', { name: step })
    .click();
}
