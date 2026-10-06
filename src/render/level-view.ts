// What a level brought (Sam's call): the lines the training tab shows after a level-up, read from the
// character before and after it.
import type { Character, ClassOption } from '../data/schemas/index.ts';
import { gameSkills } from '../data/skills.ts';
import { gameSpells } from '../data/spells.ts';
import { classOption } from '../game/character/class-step.ts';
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { focusInfo } from '../game/character/foci.ts';
import { characterLevel } from '../rules/progression.ts';

const SAVES = { physical: 'Physical', evasion: 'Evasion', mental: 'Mental', luck: 'Luck' } as const;

/** Hit point gains and attack bonuses are never below zero. */
const signed = (n: number) => `+${n}`;

export function levelSummary(data: GameData, before: Character, after: Character): string[] {
  const [was, now] = [characterSheet(before, data), characterSheet(after, data)];
  const classId = after.classes.current;
  const className = (classOption(data, classId) as ClassOption).name;
  const lines = [
    `${after.name} reaches level ${characterLevel(after.classes)} (${className} ${after.classes.levels[classId] as number}).`,
    `Hit points ${before.hp.max} → ${after.hp.max} (${signed(after.hp.max - before.hp.max)}).`,
  ];
  if (now.attackBonus !== was.attackBonus)
    lines.push(`Attack bonus ${signed(was.attackBonus)} → ${signed(now.attackBonus)}.`);
  const saves = (Object.keys(SAVES) as (keyof typeof SAVES)[]).filter(
    (s) => now.saves[s] !== was.saves[s],
  );
  if (saves.length > 0)
    lines.push(`Saves: ${saves.map((s) => `${SAVES[s]} ${now.saves[s]}+`).join(', ')}.`);
  const points = (c: Character) => c.advancement.skillPoints + c.advancement.quickPoints;
  if (points(after) > points(before))
    lines.push(`${points(after) - points(before)} skill points to spend.`);
  const skillName = (id: string) =>
    (gameSkills(data.srd, data.content).find((s) => s.id === id) as { name: string }).name;
  const raised = Object.entries(after.skills).filter(([id, l]) => before.skills[id] !== l);
  if (raised.length > 0)
    lines.push(`Skills: ${raised.map(([id, l]) => `${skillName(id)}-${l}`).join(', ')}.`);
  const foci = after.foci.filter(
    (f) =>
      !before.foci.some((b) => b.id === f.id && b.level === f.level && b.attribute === f.attribute),
  );
  if (foci.length > 0)
    lines.push(
      `Foci: ${foci.map((f) => `${(focusInfo(data, f.id) as { name: string }).name} ${f.level}`).join(', ')}.`,
    );
  const arts = after.arts.filter((a) => !before.arts.includes(a));
  if (arts.length > 0)
    lines.push(
      `Arts: ${arts.map((a) => (data.srd.arts.find((x) => x.id === a) as { name: string }).name).join(', ')}.`,
    );
  const spells = after.spells.known.filter((s) => !before.spells.known.includes(s));
  const spellName = (id: string) =>
    (gameSpells(data.srd, data.content).find((s) => s.id === id) as { name: string }).name;
  if (spells.length > 0) lines.push(`Spells: ${spells.map(spellName).join(', ')}.`);
  return lines;
}
