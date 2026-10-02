import type { Monster } from '../../../src/data/schemas/index.ts';
import { findHeading, parseTables, sectionLines, slug } from '../markdown.ts';
import { parseDice, parseInt10, parseSigned } from '../parse-values.ts';
import type { SrdReader } from '../reader.ts';

const FILE = '5.0 Monsters and Foes/Monster and NPC Stats.md';

function parseDamage(text: string, where: string): Monster['damage'] {
  const wpn = /^Wpn(?:\+(\d+))?$/.exec(text);
  if (wpn) return { kind: 'weapon', bonus: Number(wpn[1] ?? 0) };
  try {
    return { kind: 'dice', dice: parseDice(text) };
  } catch {
    throw new Error(`${where}: bad damage "${text}"`);
  }
}

function parseShock(text: string, where: string): Monster['shock'] {
  if (text === 'None') return null;
  const wpn = /^Wpn(?:\+(\d+))?(\/-)?$/.exec(text);
  if (wpn) return { kind: 'weapon', bonus: Number(wpn[1] ?? 0), ignoresAc: wpn[2] !== undefined };
  const fixed = /^(\d+)\/(?:AC )?(\d+|-)$/.exec(text);
  if (fixed?.[1] && fixed[2]) {
    return {
      kind: 'fixed',
      damage: Number(fixed[1]),
      maxAc: fixed[2] === '-' ? null : Number(fixed[2]),
    };
  }
  throw new Error(`${where}: bad Shock "${text}"`);
}

export function extractMonsters(reader: SrdReader): Monster[] {
  const doc = reader.doc(FILE);
  const heading = findHeading(doc, /Monster & NPC Statistics$/);
  return parseTables(sectionLines(doc, heading)).flatMap((table) => {
    const category = table.header[0] ?? '';
    return table.rows.map((row) => {
      if (row.length !== 11) throw new Error(`${FILE}: ${row[0]} has ${row.length} cells`);
      const [name, hd, ac, atk, dmg, shock, move, ml, inst, skill, save] = row as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      const where = `${FILE}: ${name}`;
      const acMatch = /^(\d+)(a?)$/.exec(ac);
      const atkMatch = /^([+-]\d+)(?:\s*x(\d+))?$/.exec(atk);
      const moveMatch = /^(\d+)'$/.exec(move);
      const saveMatch = /^(\d+)\+$/.exec(save);
      if (!acMatch?.[1] || !atkMatch?.[1] || !moveMatch?.[1] || !saveMatch?.[1]) {
        throw new Error(`${where}: bad AC, attack, move, or save in ${JSON.stringify(row)}`);
      }
      return {
        id: slug(name),
        name,
        source: { file: FILE, heading: heading.text },
        category,
        hitDice: parseInt10(hd),
        ac: Number(acMatch[1]),
        armored: acMatch[2] === 'a',
        attackBonus: parseSigned(atkMatch[1]),
        attacks: Number(atkMatch[2] ?? 1),
        damage: parseDamage(dmg, where),
        shock: parseShock(shock, where),
        move: Number(moveMatch[1]),
        morale: parseInt10(ml),
        instinct: parseInt10(inst),
        skill: parseSigned(skill),
        save: Number(saveMatch[1]),
      };
    });
  });
}
