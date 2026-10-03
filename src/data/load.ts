import armor from '../../data/srd/armor.json';
import castingProgressions from '../../data/srd/casting-progressions.json';
import classes from '../../data/srd/classes.json';
import foci from '../../data/srd/foci.json';
import gear from '../../data/srd/gear.json';
import gearBundles from '../../data/srd/gear-bundles.json';
import monsters from '../../data/srd/monsters.json';
import progressions from '../../data/srd/progressions.json';
import skills from '../../data/srd/skills.json';
import spells from '../../data/srd/spells.json';
import arts from '../../data/srd/arts.json';
import weaponTraits from '../../data/srd/weapon-traits.json';
import weapons from '../../data/srd/weapons.json';
import { SrdSchemas, type SrdData } from './schemas/index.ts';

const RAW: Record<keyof SrdData, unknown> = {
  skills,
  foci,
  classes,
  progressions,
  'casting-progressions': castingProgressions,
  'weapon-traits': weaponTraits,
  weapons,
  armor,
  gear,
  'gear-bundles': gearBundles,
  spells,
  arts,
  monsters,
};

/** Parses every data/srd file with its schema; throws on the first invalid file. */
export function loadSrd(): SrdData {
  const out = {} as Record<keyof SrdData, unknown>;
  for (const name of Object.keys(SrdSchemas) as (keyof SrdData)[]) {
    out[name] = SrdSchemas[name].parse(RAW[name]);
  }
  return out as SrdData;
}
