# Presentation plan

The plan for continued development after the rules and content phases in
`docs/plan.md`. Those phases held the renderer to wireframe until the game
loop was complete (plan.md, Risks: Renderer rabbit hole). The loop is
complete now, so this plan turns to how the game looks and how its fights
read.

## Ground rules (Sam's calls)

- **No external assets for now.** Every texture, glyph, and portrait is
  generated in code: SVG geometry from `src/render/`, drawn by `src/ui/`. If
  generated art doesn't hold up, the fallback is images made from prompts to
  an image model, checked into the repo as our own work. No third-party art
  packs.
- **Layers stay as they are.** `src/render/` returns plain drawing data
  (points, path strings, colors) and stays covered at 100%. `src/ui/` only
  turns that data into elements and CSS.
- **Deterministic.** Variation (which stone is cracked, where a joint
  falls) comes from a hash of the cell and side, never from an RNG, so a
  view looks the same on every visit and in every screenshot. Game
  randomness still goes only through the seeded RNG.
- **Motion is optional.** Flicker and transitions are CSS animations, off
  under `prefers-reduced-motion`. Playwright screenshots freeze animations,
  so baselines stay stable.
- **Presentation is not rules.** Nothing here changes a roll, a number, or a
  turn. Any combat change that does (stage V5) needs a ruling in
  `docs/rules-adaptation.md` first.
- **Screenshots.** Each stage that changes the look updates the e2e
  baselines in the same PR, so the diff shows the change.

## Stages

| Stage | Scope                                                                                                                                                                                                                                                                                            | Exit                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| V1    | Dungeon view. Light falloff and tint by source (torch, lantern, Light of Faith, sight without light), dimming as the light's die steps down, torch flicker. Perspective-correct procedural detail: coursed stone on walls, planks and iron bands on doors, flagstones on the floor, stair treads | Done: see V1 below. The level editor's test walk shares the same view                                   |
| V2    | Overland map. Terrain glyphs per hex (trees, hills, peaks, reeds, ripples) as SVG symbols, roads and rivers as paths joining hex edges, a parchment and ink theme, icons for towns, dungeons, groves, and exits, soft-edged fog, a party token, and a tint for the quarter of the day            | Every terrain in `data/content/terrains.json` has a glyph; map editor and game share them               |
| V3    | Combat presentation. Generated silhouettes by monster type and by people and class, floating damage and Shock numbers, hit and miss flashes, a turn-order strip, hit chance and damage range on hover (read from `src/rules/attacks.ts`), reach lines from `formation.ts`, log filters by side   | The command menu shows odds before every attack; no change to `pnpm sim` results                        |
| V4    | Dungeon furniture. Floor and wall features (rubble, bones, altars, fountains, braziers) as a new field in the level format and the editor, an encounter portrait over the view, a compass on the automap, step and turn transitions                                                              | `content-guide.md` documents the field; `pnpm validate:levels` passes                                   |
| V5    | Combat mechanics, only with rulings: mid-fight formation swaps, Fighting Withdrawal, readied actions                                                                                                                                                                                             | Each one has its ruling in `docs/rules-adaptation.md` and its SRD citation before code                  |
| V6    | Prompted art, only if V1 to V4 fall short: portraits and textures from an image model, kept in `public/art/`, with the prompt beside each file so it can be made again                                                                                                                           | A decision recorded as an ADR in `docs/decisions/`, including the license we put on the generated files |

## V1: dungeon view (done)

| Piece        | Where                                               | What it does                                                                                                                                                                                                                                                                                                          |
| ------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Light        | `src/render/dungeon-light.ts`                       | What lights the view and how: tint, reach, and whether it flickers. Torches flicker warm orange, lanterns burn steadier and further, Light of Faith is pale gold and still, and sight without light is a cold grey with short reach                                                                                   |
| Reach        | same                                                | Reach follows the light's die (1 + die / 4 cells): a fresh lantern lights the whole corridor, a guttering torch two cells. Each panel darkens by its distance, along it for walls and floors running away, so a near wall is never shadowed by the dark beyond it                                                     |
| Detail       | `src/render/dungeon-detail.ts`                      | Mortar lines and joints, door planks, bands, and ring, flagstones, ceiling beams, and stair treads, laid out in each panel's own perspective quad so they recede with it                                                                                                                                              |
| Dug walls    | `breach()` in `src/render/dungeon-detail.ts`        | A wall opened by The Burrower Below or the Decree of Lithic Dissolution shows a ragged hole open to the floor, with a broken rim and rubble at its foot, instead of vanishing. Keyed by the edge, so both sides show the same hole                                                                                    |
| View         | `src/render/dungeon-view.ts`, `dungeon-geometry.ts` | Floor cells now come back as panels so their flagstones draw, and every panel carries its detail path                                                                                                                                                                                                                 |
| Traps        | `src/render/trap-art.ts`                            | A known trap: a pressure plate with spike holes (damage), needle holes and a green stain (poison), or spilled filth (disease); a tripwire wall to wall at ankle height (alarm). The party's chalk ring circles each one. A disarmed trap stays in view, its plate wedged or its wire cut and its chalk struck through |
| Drawing      | `src/ui/world/DungeonView.tsx`                      | One SVG for the game and the editor's test walk: each panel with its detail and its shadow, then the light's tint glowing up from the party                                                                                                                                                                           |
| Flicker, CSS | `src/ui/world/world.css`                            | Torch flicker keyframes on the shadows and tint, off under `prefers-reduced-motion`                                                                                                                                                                                                                                   |

## V2: overland map (first pass done)

| Piece      | Where                      | What it does                                                                                                                                                                                                              |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Glyphs     | `src/render/hex-art.ts`    | Where each terrain's glyphs sit in a known hex, nudged by a hash of the hex: grass tufts, trees, pines, hills, peaks, reeds, mesas, ripples, stepping stones. A hex with a town, dungeon, or grove keeps its middle clear |
| Roads      | same                       | One curve per hex from the edge a road enters by to the edge it leaves by, so a run of road hexes reads as one line, running on into the towns beside it                                                                  |
| Rivers     | same                       | The same through river and ford hexes, joining lakes beside them                                                                                                                                                          |
| Hour       | same                       | A tint for the quarter of the day: warm morning, clear day, red evening, dark night                                                                                                                                       |
| Symbols    | `src/ui/world/HexArt.tsx`  | The glyphs and the icons (town, dungeon mouth, grove, signpost, party banner) as SVG symbols                                                                                                                              |
| Drawing    | `src/ui/world/HexMap.tsx`  | Layers: parchment, terrain washes and glyphs, rivers and roads, the hour's tint, fog as a dark sheet with soft-edged holes over what the party knows, then one clickable group per hex with its icons and outlines        |
| Theme, CSS | `src/ui/world/hex-map.css` | Parchment and ink colours. Hexes seen but not visited take a pale wash                                                                                                                                                    |

Every terrain in `data/content/terrains.json` has a glyph, and the map editor uses the same map.

Added after the first pass (`src/render/hex-water.ts`): an ink shoreline with a pale wash of
shallows on every edge between known water and known dry land; a plank bridge, laid along the
road, wherever a road crosses a river or ford; a compass rose in the map's corner. Crossroads now
run each road straight into the hex centre instead of curving every pair. A scale bar sits in the bottom left: five hex-long blocks, 30 miles at the SRD's six-mile hex
(vendor/wwn-srd/2.0 The Rules of the Game/2.12.0 Wilderness Exploration and Expeditions.md).

Not presentation, but found while drawing roads: the hike planner now keeps to roads when a road
costs no more hike points than the way across country (Sam's call, docs/rules-adaptation.md,
Overland travel: Route).

## V3: combat presentation (first slice)

| Piece      | Where                                                    | What it does                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hit chance | `src/rules/attacks.ts` (`hitChance`)                     | The exact chance of a hit: the d20 plus or minus a d6 per step of advantage, against the AC. Rolls nothing                                                                                                           |
| Same roll  | `src/game/combat/attack.ts` (`attackInput`)              | The attack and the odds build their roll from one function, so the odds can't drift from the roll. `pnpm sim` output is unchanged                                                                                    |
| Odds       | `src/render/fight-odds.ts`                               | Chance to hit, a hit's damage range (never under its Shock), and the Shock a miss still deals, with God Wills It, Flame Without End, Red Harvest, Smite the Wicked, and Call of the Tomb. Resistances aren't counted |
| Blows      | `Battle.events` (`src/game/combat/types.ts`)             | Each weapon blow as a hit, Shock, miss, or a blow turned aside (shield, ward, Master of Bones, a Rider's guard), kept only when the battle keeps a log                                                               |
| Numbers    | `src/render/fight-fx.ts`                                 | Numbers that float up off each slot after a batch of turns: each blow, and any other change in HP (spells, healing). Up to four a slot, and a flash: struck, healed, or missed                                       |
| Turn order | same, and `src/ui/arena/TurnStrip.tsx`                   | The turns left this round, in order, whose turn it is first, then the next round                                                                                                                                     |
| Drawing    | `src/ui/arena/Field.tsx`, `CommandMenu.tsx`, `fight.css` | The odds sit under each target in the menu and on the field, and in the target's accessible name. Without motion, the numbers stay put until the next batch                                                          |

Silhouettes, added next:

| Piece   | Where                                                                                         | What it does                                                                                                                                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data    | `figure` in `monster-combat.json`, `look` in `peoples.json`, `held` in `equipment-rules.json` | Which of 19 figures a monster is drawn as (setting monsters take their base's), a people's build and head mark, and each SRD weapon's shape in hand. Presentation only; a content check wants a shape for every weapon                                       |
| Choice  | `src/render/figure-view.ts`                                                                   | A monster's figure from its entry (large ones drawn bigger); a character from its people's look, its armor (AC 14 or more reads as armor, else a robe for a caster or a cloak), its first weapon, and its shield; a Skinshifter in a beast's form as a beast |
| Art     | `src/render/figure-art.ts`, `monster-art.ts`, `figure-draw.ts`                                | Path data in a 48 by 48 box: people built from parts (centaurs ride a horse body), monsters drawn whole, armed folk reusing the people's parts. Downed figures lie on their side, beasts on their back                                                       |
| Drawing | `src/ui/arena/Figure.tsx`, `fight.css`                                                        | The silhouette at the right of each slot, in the ink colour for the near side and a rust red for the far side, with cut lines in the slot's colour carving out visors, belts, and eyes                                                                       |

Reach and log filters, last of V3:

| Piece       | Where                                                      | What it does                                                                                                                                                                                                              |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reach       | `src/render/fight-reach.ts`, `Field.tsx`                   | On a turn awaiting a command, each foe the actor can strike is marked: "in reach" (solid edge) when a melee weapon gets there, "in range" (dashed) when only a missile does. Read from the same targeting the attacks use |
| Log sides   | `Battle.acting` and `Battle.logSides` (`src/game/combat/`) | The side whose turn is playing, set when a turn begins and cleared between rounds and once the fight is settled; every log line keeps it. Nothing the rules read, and `pnpm sim` output is unchanged                      |
| Log filters | `src/render/fight-log.ts`, `BattleLog` in `Field.tsx`      | All, or one side's turns, named after the sides. Lines from between turns (deaths from wounds, the end of a round) and after the fight show only under All                                                                |

Reach marks instead of drawn lines: the field is laid out as a grid of slots, so a mark on each foe in reach says the same without measuring the page.

## V5: combat mechanics

Each with Sam's ruling in `docs/rules-adaptation.md` (Formation rules) before code.

| Ruling              | Where                                                                    | What it does                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Swapping            | `act` in `src/game/combat/actions.ts`, `moveChoices` in `commands.ts`    | Change slot now offers allies' slots too: "trade places with Grukk", for the mover's action alone. Works on a downed ally, to pull a fallen front-liner back                                                  |
| Fighting Withdrawal | none                                                                     | Stepping back out of melee draws no free attack, so the SRD's Fighting Withdrawal has no use. Noted on the Moving rows ruling                                                                                 |
| Holding             | `holdTurn` in `src/game/combat/round.ts`, `holdChoices` in `commands.ts` | Hold: pick anyone still to act this round, and the turn comes again right after theirs. Once a round; On Turn actions aren't taken twice. Monsters and default actions never hold, so `pnpm sim` is unchanged |
