import { allMonsters } from './monsters.ts';
import type { ContentData, Monster, MonsterCaster, SrdData } from './schemas/index.ts';
import { gameSkills } from './skills.ts';
import { gameSpells } from './spells.ts';

/**
 * Every monster has combat data, Wpn monsters name a real weapon, routines make as many attacks as
 * the stat line, volleys come with a routine, and magic effects exist.
 */
export function combatReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const weapons = new Set(srd.weapons.map((w) => w.id));
  const skills = new Set(gameSkills(srd, content).map((s) => s.id));
  const monsters = allMonsters(srd, content);
  const ids = new Set(srd.monsters.map((m) => m.id));
  for (const m of content.monsters)
    if (ids.has(m.id)) errors.push(`monsters/${m.id}: clashes with an SRD monster`);
  for (const m of monsters) {
    const c = content.monsterCombat.find((x) => x.id === m.id);
    if (!c) errors.push(`monsterCombat: no entry for ${m.id}`);
    else if (m.damage.kind === 'weapon' && !c.weapon)
      errors.push(`monsterCombat/${m.id}: needs a weapon`);
  }
  for (const c of content.monsterCombat) {
    if (!monsters.some((m) => m.id === c.id)) errors.push(`monsterCombat/${c.id}: unknown monster`);
    if (c.weapon && !weapons.has(c.weapon))
      errors.push(`monsterCombat/${c.id}: unknown weapon ${c.weapon}`);
    const m = monsters.find((x) => x.id === c.id);
    if (m && c.caster) errors.push(...casterErrors(srd, content, m, c.caster));
    const swings = c.routine?.reduce((sum, st) => sum + st.count, 0);
    if (m && swings !== undefined && swings !== m.attacks)
      errors.push(`monsterCombat/${c.id}: the routine makes ${swings} attacks, not ${m.attacks}`);
    if (c.volley && !c.routine) errors.push(`monsterCombat/${c.id}: a volley needs a routine`);
    // Beasts give rations instead of loot (Phase 17).
    if (c.mind === 'animal' && c.loot)
      errors.push(`monsterCombat/${c.id}: beasts give rations, not loot`);
    // Plants give components instead (Phase 18a).
    if (c.tags.includes('plant') && c.loot)
      errors.push(`monsterCombat/${c.id}: plants give components, not loot`);
    if (
      c.tags.includes('plant') &&
      !content.components.some((x) => x.sources.some((s) => s.monster === c.id))
    )
      errors.push(`monsterCombat/${c.id}: a plant needs a component to drop`);
  }
  for (const m of content.combatMagic) {
    const known = m.source === 'spell' ? gameSpells(srd, content) : srd.arts;
    if (!known.some((k) => k.id === m.id)) errors.push(`combatMagic/${m.id}: unknown ${m.source}`);
    const e = m.effect;
    const skill =
      e.kind === 'blast' || e.kind === 'touch-heal' || e.kind === 'repose'
        ? e.skill
        : e.kind === 'enthrall' || e.kind === 'skyward'
          ? e.penaltySkill
          : undefined;
    if (skill !== undefined && !skills.has(skill)) {
      errors.push(`combatMagic/${m.id}: unknown skill ${skill}`);
    }
    if (e.kind === 'summon' && !monsters.some((x) => x.id === e.monster))
      errors.push(`combatMagic/${m.id}: unknown monster ${e.monster}`);
  }
  return errors;
}

/**
 * A monster caster's tradition and table exist, and it prepares no more spells than its table
 * allows at its hit dice, of a level it can cast, from its spell tradition's lists (its own
 * unless it names another); its arts are its tradition's. Every spell and art needs combat mechanics.
 */
function casterErrors(srd: SrdData, content: ContentData, m: Monster, c: MonsterCaster): string[] {
  const where = `monsterCombat/${m.id}`;
  const tradition = content.traditions.find((t) => t.id === c.tradition);
  const spellTradition = c.spellTradition
    ? content.traditions.find((t) => t.id === c.spellTradition)
    : tradition;
  const table = srd['casting-progressions'].find((t) => t.id === c.slots);
  if (!tradition) return [`${where}: unknown tradition ${c.tradition}`];
  if (!spellTradition) return [`${where}: unknown spell tradition ${c.spellTradition}`];
  if (!table) return [`${where}: unknown casting table ${c.slots}`];
  const errors: string[] = [];
  // SRD tables run from level 1 without gaps; a monster past the last uses the last row.
  const row = table.levels[
    Math.min(m.hitDice, table.levels.length) - 1
  ] as (typeof table.levels)[0];
  if (c.spells.length > row.spellsPrepared)
    errors.push(`${where}: prepares more than ${row.spellsPrepared} spells`);
  for (const id of c.spells) {
    const spell = gameSpells(srd, content).find((s) => s.id === id);
    if (!spell || !content.combatMagic.some((x) => x.id === id && x.source === 'spell'))
      errors.push(`${where}: no combat spell ${id}`);
    else if (!(spellTradition.spellLists as string[]).includes(spell.tradition))
      errors.push(`${where}: ${id} is not on its tradition's lists`);
    else if (spell.level > row.maxSpellLevel)
      errors.push(`${where}: ${id} is above its spell level`);
  }
  for (const id of c.arts) {
    const art = srd.arts.find((a) => a.id === id);
    if (!art || !content.combatMagic.some((x) => x.id === id && x.source === 'art'))
      errors.push(`${where}: no combat art ${id}`);
    else if (art.tradition !== c.tradition)
      errors.push(`${where}: ${id} is not a ${c.tradition} art`);
  }
  return errors;
}
