import { expect, test, type Page } from '@playwright/test';

// High Magic outside fights (docs/rules-adaptation.md, High Magic outside fights): a High Mage takes
// the seeming of the bound and calls the palanquin overland, speaks the Imputation to a group met,
// then dissolves stone, opens arcane sight, and steps through a rift in the barrow.
const starters = ['snag', 'fizzwick'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';
const SPELLS = [
  'adopt-the-simulacular-visage',
  'the-jade-palanquin-of-the-faceless-god',
  'the-inexorable-imputation',
  'phantasmal-mimesis',
  'decree-of-lithic-dissolution',
  'apprehending-the-arcane-form',
  'pierce-the-pallid-gate',
];

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

const fresh = `save.members.find((m) => m.character.name === 'Fizzwick').spellsCast = 0;`;

test('casts High Magic outside fights, above ground and below', async ({ page }) => {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page
    .getByRole('combobox', { name: 'Rear row, slot 1' })
    .selectOption({ label: 'Fizzwick' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('sorcery-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await expect(page.getByRole('region', { name: 'High Magic' })).toHaveCount(0);
  await edit(
    page,
    `const fizz = save.members.find((m) => m.character.name === 'Fizzwick').character;
     fizz.classes = { current: 'full-high-mage', levels: { 'full-high-mage': 10 } };
     fizz.spells = { known: ${JSON.stringify(SPELLS)}, prepared: ${JSON.stringify(SPELLS)} };
     save.position = { col: 5, row: 10 };
     save.visited.push('4,9', '5,10');`,
  );
  const panel = page.getByRole('region', { name: 'High Magic' });
  const log = page.getByRole('region', { name: 'Journey log' });
  await panel.getByRole('button', { name: 'Take the seeming of the bound' }).click();
  await expect(panel).toContainText('The party wears the seeming of the bound until dawn.');
  await panel.getByRole('button', { name: 'Call the jade palanquin' }).click();
  await expect(panel).toContainText("A jade palanquin carries the party's packs.");
  await expect(panel.getByRole('button', { name: 'Call the jade palanquin' })).toHaveCount(0);

  await edit(
    page,
    `${fresh}
     save.encounter = { enemies: [['thug-or-militia']], nature: 'hostile', reaction: 'expected',
       parleyed: false, captive: null, quest: null, offer: null, hostile: true, spotted: false,
       text: 'Thugs bar the road.' };`,
  );
  const meeting = page.getByRole('region', { name: 'Encounter' });
  await expect(
    meeting.getByRole('button', { name: 'Fizzwick: cast an illusion and slip away' }),
  ).toBeVisible();
  await meeting.getByRole('button', { name: 'Fizzwick: speak the Inexorable Imputation' }).click();
  await expect(log).toContainText('Fizzwick speaks,');
  await expect(
    meeting.getByRole('button', { name: 'Fizzwick: speak the Inexorable Imputation' }),
  ).toHaveCount(0);

  await edit(page, `${fresh} save.encounter = null;`);
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
  await edit(page, `${fresh} save.dungeon.at = { x: 0, y: 4 }; save.dungeon.facing = 'e';`);
  await panel.getByRole('button', { name: 'Dissolve the stone ahead (1 turn)' }).click();
  await expect(log).toContainText('Fizzwick speaks the decree');
  await panel.getByRole('button', { name: 'Open arcane sight' }).click();
  await expect(log).toContainText('No working of magic shows on this level.');
  await expect(panel).toContainText('Arcane sight lights the dark.');
  await panel.getByRole('button', { name: 'Open a rift to the way out (1,8)' }).click();
  await expect(log).toContainText('Fizzwick tears open a pale rift');
  await expect(page.getByRole('button', { name: 'Climb out of The Old Barrow' })).toBeVisible();
});
