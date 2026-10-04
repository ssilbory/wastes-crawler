import { expect, test, type Page } from '@playwright/test';

// Phase 12c: Elder Gorvash in Cinderhold starts the Command authority chain, which sends the party
// into Ashgate Keep, where the bound garrison's first post challenges it in the gatehouse.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

/** Changes the autosaved world, then picks the journey back up. */
async function edit(page: Page, change: string) {
  await page.evaluate(
    ([key, body]) => {
      const save = JSON.parse(localStorage.getItem(key as string) as string);
      new Function('save', body as string)(save);
      localStorage.setItem(key as string, JSON.stringify(save));
    },
    [WORLD_KEY, change],
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
}

test('takes on the Ashgate Rolls and meets the gatehouse post', async ({ page }, testInfo) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('link', { name: 'Overland' }).click();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('campaign-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await edit(
    page,
    `Object.assign(save, { region: 'dark-lands', elsewhere: { borderlands: save.visited },
      visited: ['6,12'], position: { col: 6, row: 12 } });`,
  );

  await page.getByRole('button', { name: 'Visit Cinderhold' }).click();
  const elder = page.getByRole('region', { name: 'Elder Gorvash' });
  await elder.getByRole('button', { name: 'Take on The Ashgate Rolls' }).click();
  await expect(elder).toContainText("Get down into Ashgate's undervaults.");
  await expect(elder).toContainText('The Cull Records');
  await page.screenshot({ path: testInfo.outputPath('gorvash.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back to the map' }).click();

  await edit(page, `save.position = { col: 22, row: 12 }; save.visited.push('22,12');`);
  await page.getByRole('button', { name: 'Enter Ashgate Keep' }).click();
  await expect(page.locator('.world-bar')).toContainText('The Outer Ward, facing north');
  const log = page.getByRole('region', { name: 'Journey log' });
  // Up through the courtyard to the gatehouse door.
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Forward' }).click();
  await expect(log).toContainText('HOLD UNTIL RELIEVED');
  const panel = page.getByRole('region', { name: 'Encounter' });
  await expect(panel).toContainText('Three old goblins stand to in the gatehouse');
  await expect(panel.getByRole('group', { name: 'Standing order' })).toContainText(
    'Hold Ashgate Until Relieved',
  );
  await page.screenshot({ path: testInfo.outputPath('ashgate-post.png'), fullPage: true });
  await panel.getByRole('button', { name: 'Slip away' }).click();
  await expect(panel).toHaveCount(0);
});
