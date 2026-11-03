// What a major project's effect does, in the party's words (docs/rules-adaptation.md, Major
// projects: Project kinds). Content checks guarantee every place and faction named.
import type { ProjectEffect } from '../data/schemas/project-content.ts';
import type { GameData } from '../game/character/context.ts';

const site = (data: GameData, id: string) =>
  data.content.regions.flatMap((r) => r.sites).find((s) => s.id === id)?.name as string;

const regionName = (data: GameData, id: string) =>
  data.content.regions.find((r) => r.id === id)?.name as string;

const factionName = (data: GameData, id: string) =>
  data.content.factions.factions.find((f) => f.id === id)?.name as string;

const route = (data: GameData, id: string) => {
  const towns = data.content.coachRoutes.find((r) => r.id === id)?.towns as [string, string];
  return `${site(data, towns[0])} and ${site(data, towns[1])}`;
};

export function effectText(data: GameData, e: ProjectEffect): string {
  switch (e.kind) {
    case 'raid-guard':
      return `Raids on ${site(data, e.at)} fail ${e.percent}% of the time before they're fought, and a sacking there lasts half a month.`;
    case 'raid-warning':
      return `A raid on ${site(data, e.at)} is known ${e.days} days ahead.`;
    case 'road':
      return `The coach between ${route(data, e.route)} is ambushed only 1 time in ${e.ambushDie}, and costs ${e.fareCut} crowns less.`;
    case 'coach':
      return `A coach runs between ${site(data, e.towns[0])} and ${site(data, e.towns[1])}, ${e.fare} crowns a passenger.`;
    case 'tithe':
      return `Villages in ${regionName(data, e.region)} pay ${e.sellPercent}% more for gear and loot${
        e.faction ? `, and ${factionName(data, e.faction)} patrol ${e.patrolPercent}% as often` : ''
      }.`;
    case 'forage':
      return `Foraging and hunting within ${e.radius} hexes of ${site(data, e.at)} are ${e.bonus} easier.`;
    case 'water':
      return `Hexes within ${e.radius} of ${site(data, e.at)} fill the water die and aren't dry land.`;
    case 'workshop-pace':
      return `Work at the workshop in ${site(data, e.at)} goes ${e.percent}% faster.`;
    case 'grave-ward':
      return `The Faithful can't empty the crypt in ${site(data, e.at)}.`;
  }
}
