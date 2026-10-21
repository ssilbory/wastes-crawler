import { expect, test, type Page } from '@playwright/test';

// The Phase 5 exit criterion (docs/plan.md): create a party and wander the hex map, fighting things
// and surviving encounters, hunger, and cold. Rules details are covered by unit tests; this drives
// the whole loop in the browser.
const starters = ['snag', 'grukk', 'lirael', 'fizzwick'].map(
  (n) => `tools/sim/parties/starter/${n}.json`,
);

async function position(page: Page): Promise<[number, number]> {
  const text = (await page.locator('.world-bar').innerText()).match(/\((\d+),(\d+)\)/);
  if (!text) throw new Error('no position shown');
  return [Number(text[1]), Number(text[2])];
}

test('wanders the overland map, fighting what it meets', async ({ page }, testInfo) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(4);

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
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('overland-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  // Phase 16: a new world opens on the setting in brief.
  const intro = page.getByRole('region', { name: 'Introduction' });
  await expect(intro.getByRole('heading', { name: 'The Dark Lands' })).toBeVisible();
  await expect(intro).toContainText('Twenty years ago he vanished.');
  await expect(page.getByRole('img', { name: 'Overland map' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('intro.png'), fullPage: true });
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await expect(page.getByRole('img', { name: 'Overland map' })).toBeVisible();
  await expect(page.locator('.world-bar')).toContainText('Rubblegate');

  // Walk east along the road, a hex ahead at a time, turning back at Scrapmarch.
  let fights = 0;
  let east = true;
  for (let i = 0; i < 300 && fights < 2; i++) {
    const encounter = page.getByRole('region', { name: 'Encounter' });
    if (await encounter.isVisible()) {
      // The card takes focus, so Tab starts on its choices, and Tab stays inside it either way.
      const card = page.getByRole('dialog', { name: 'Encounter' });
      await expect(card).toBeFocused();
      const inCard = () => card.evaluate((el) => el.contains(document.activeElement));
      await page.keyboard.press('Shift+Tab');
      expect(await inCard()).toBe(true);
      for (let t = 0; t < 12; t++) await page.keyboard.press('Tab');
      expect(await inCard()).toBe(true);
      await encounter.getByRole('button', { name: /^(Fight|Attack them)$/ }).click();
      await page.getByRole('button', { name: 'Auto-resolve' }).click();
      await expect(page.getByRole('status')).toBeVisible();
      if (fights === 0)
        await page.screenshot({ path: testInfo.outputPath('overland-fight.png'), fullPage: true });
      await page.getByRole('button', { name: 'Back to the map' }).click();
      fights += 1;
      continue;
    }
    const [col] = await position(page);
    if (col >= 20) east = false;
    if (col <= 3) east = true;
    await page.locator(`[data-hex="${east ? col + 1 : col - 1},8"]`).click();
    await page.getByRole('button', { name: /^(Hike|Camp) for the quarter$/ }).click();
  }
  expect(fights).toBe(2);
  await expect(page.getByRole('region', { name: 'Journey log' })).toContainText('The party');
  await page.screenshot({ path: testInfo.outputPath('overland-map.png'), fullPage: true });

  // The world autosaves: a reload continues the same journey.
  const date = await page.locator('.world-bar .date').innerText();
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(page.locator('.world-bar .date')).toHaveText(date);
});

test('camps for the night with the suggested watches and shelter', async ({ page }) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters.slice(0, 2));
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  // The arena has a formation of its own: wait for the Overland page before picking slots.
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('camp-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await page.locator('[data-hex="3,7"]').click();
  const plan = page.getByRole('region', { name: 'Quarter plan' });
  await expect(plan.getByRole('radio', { name: 'Hike' })).toHaveAttribute('aria-checked', 'true');
  await plan.getByRole('radio', { name: 'Camp' }).click();
  await expect(plan.getByRole('combobox', { name: 'Snag' })).toBeVisible();
  for (let q = 0; q < 4; q++) {
    const encounter = page.getByRole('region', { name: 'Encounter' });
    if (await encounter.isVisible()) {
      await encounter.getByRole('button', { name: /^(Fight|Attack them)$/ }).click();
      await page.getByRole('button', { name: 'Auto-resolve' }).click();
      await page.getByRole('button', { name: 'Back to the map' }).click();
    }
    await page.getByRole('button', { name: /^(Hike|Camp) for the quarter$/ }).click();
  }
  await expect(page.locator('.world-bar .date')).toContainText(
    /^(morning|day|evening|night), 2 Seedtime/i,
  );
});

test('heads toward an unexplored hex picked on the map', async ({ page }) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters.slice(0, 2));
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('fog-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  const target = page.locator('[data-hex="10,8"]');
  await expect(target).toHaveClass(/\bfog\b/);
  await target.click();
  await expect(target).toHaveClass(/\bdestination\b/);
  await expect(page.locator('.hex.route')).not.toHaveCount(0);
  const plan = page.getByRole('region', { name: 'Quarter plan' });
  await expect(plan.getByRole('radio', { name: 'Hike' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Hike for the quarter' }).click();
  await expect(page.locator('.world-bar')).not.toContainText('Rubblegate');
});
