import { expect, test, type Page } from '@playwright/test';

// The Beastmaster (1.5.4): binding a companion in the wilds, sending it away, and calling it back.
const WORLD_KEY = 'wastes-crawler.world';

async function startWorld(page: Page) {
  const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('beastmaster-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
}

test('binds a companion in the wilds, sends it away, and calls it back', async ({ page }) => {
  await startWorld(page);
  // Make Snag a third-level Ranger standing by a herd of beasts, through the autosave.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    const snag = save.members.find(
      (m: { character: { name: string } }) => m.character.name === 'Snag',
    );
    snag.character.classes = {
      current: 'beastmaster-partial-warrior',
      levels: { 'beastmaster-partial-warrior': 3 },
    };
    snag.character.arts = ['bind-companion', 'mind-call'];
    save.position = { col: 3, row: 7 };
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  const panel = page.getByRole('region', { name: 'Companions' });
  const snag = panel.getByRole('group', { name: 'Snag' });
  await expect(snag).toContainText('Snag has no companion.');
  await snag.getByRole('combobox', { name: 'Beast' }).selectOption({ label: 'Herd Beast (2 HD)' });
  await snag.getByRole('textbox', { name: 'Name' }).fill('Bramble');
  await snag.getByRole('button', { name: 'Bind Companion' }).click();
  await expect(snag).toContainText('Bramble, Herd Beast (2 HD)');
  await expect(snag).toContainText('with the party');
  await expect(page.getByRole('region', { name: 'NPCs' })).toContainText('companion of Snag');
  await snag.getByRole('button', { name: 'Send Bramble away' }).click();
  await expect(snag).toContainText('waiting to be called');
  await expect(page.getByRole('region', { name: 'NPCs' })).not.toContainText('Bramble');
  await snag.getByRole('button', { name: 'Call Bramble' }).click();
  await expect(snag).toContainText('with the party');
});
