import { describe, expect, it } from 'vitest';
import { ammoReferenceErrors } from '../src/data/ammo-check.ts';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';

const content = loadContent();
const srd = loadSrd();

describe('ammo content', () => {
  it('loads clean', () => {
    expect(ammoReferenceErrors(srd, content)).toEqual([]);
  });

  it('reports unknown ammo, weapons that are not shot, and a weapon shooting two kinds', () => {
    const fletch = { firewood: 0, metal: 0 };
    const broken = {
      ...content,
      equipmentRules: {
        ...content.equipmentRules,
        ammo: {
          'arrows-20': { weapons: ['bow-small', 'spear-light'], fletch },
          stones: { weapons: ['bow-small'], fletch },
        },
      },
    };
    expect(ammoReferenceErrors(srd, broken)).toEqual([
      "equipmentRules/ammo/arrows-20: spear-light isn't a shooting weapon",
      'equipmentRules/ammo: unknown gear stones',
      'equipmentRules/ammo/stones: bow-small already shoots arrows-20',
    ]);
  });
});
