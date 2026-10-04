import type { ContentData, Monster, SrdData } from './schemas/index.ts';

/** Every monster the game knows: the SRD's, those authored for the setting, then the reskins. */
export function allMonsters(srd: SrdData, content: ContentData): Monster[] {
  const lines: Monster[] = [...srd.monsters, ...content.monsters];
  const reskins = content.settingMonsters.flatMap((r) => {
    const base = lines.find((m) => m.id === r.base);
    return base ? [{ ...base, id: r.id, name: r.name }] : [];
  });
  return [...lines, ...reskins];
}

/** The stat line a monster is drawn on: its base if it is a setting monster, else itself. */
export const baseMonster = (content: ContentData, id: string) =>
  content.settingMonsters.find((r) => r.id === id)?.base ?? id;

/** Gives each setting monster its base's combat entry under its own id, with its own magic if any. */
export function withSettingMonsters(content: ContentData): ContentData {
  const extra = content.settingMonsters.flatMap((r) => {
    const base = content.monsterCombat.find((m) => m.id === r.base);
    return base ? [{ ...base, id: r.id, ...(r.caster ? { caster: r.caster } : {}) }] : [];
  });
  return { ...content, monsterCombat: [...content.monsterCombat, ...extra] };
}
