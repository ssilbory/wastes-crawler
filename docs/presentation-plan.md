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

| Stage | Scope                                                                                                                                                                                                                                                                                            | Exit                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| V1    | Dungeon view. Light falloff and tint by source (torch, lantern, Light of Faith, sight without light), dimming as the light's die steps down, torch flicker. Perspective-correct procedural detail: coursed stone on walls, planks and iron bands on doors, flagstones on the floor, stair treads | Done: see V1 below. The level editor's test walk shares the same view                                            |
| V2    | Overland map. Terrain glyphs per hex (trees, hills, peaks, reeds, ripples) as SVG symbols, roads and rivers as paths joining hex edges, a parchment and ink theme, icons for towns, dungeons, groves, and exits, soft-edged fog, a party token, and a tint for the quarter of the day            | Every terrain in `data/content/terrains.json` has a glyph; map editor and game share them                        |
| V3    | Combat presentation. Generated silhouettes by monster type and by people and class, floating damage and Shock numbers, hit and miss flashes, a turn-order strip, hit chance and damage range on hover (read from `src/rules/attacks.ts`), reach lines from `formation.ts`, log filters by side   | The command menu shows odds before every attack; no change to `pnpm sim` results                                 |
| V4    | Dungeon furniture. Floor and wall features (rubble, bones, altars, fountains, braziers) as a new field in the level format and the editor, an encounter portrait over the view, a compass on the automap, step and turn transitions                                                              | `content-guide.md` documents the field; `pnpm validate:levels` passes                                            |
| V5    | Combat mechanics, only with rulings: mid-fight formation swaps, Fighting Withdrawal, readied actions                                                                                                                                                                                             | Each one has its ruling in `docs/rules-adaptation.md` and its SRD citation before code                           |
| V6    | Prompted art, only if V1 to V4 fall short: portraits and textures from an image model, kept in `public/art/`, with the prompt beside each file so it can be made again                                                                                                                           | A decision recorded as an ADR in `docs/decisions/`, including the license we put on the generated files          |
| V7    | Richer procedural art (Sam's call: route A, ahead of V6). Relief on dungeon surfaces, shaded overland glyphs and a parchment grain, two-tone silhouettes, pools of light on the floor. Still SVG built in code, no image files                                                                   | Each slice updates its e2e baselines; `src/render/` stays at 100%; no SVG filter in a view redrawn on every step |

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

## V4: dungeon (first slice)

| Piece    | Where                                                                       | What it does                                                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legend   | `automapLegend` in `src/render/automap-view.ts`, `src/ui/world/Automap.tsx` | Under the automap, a scale of up to five cell-long blocks in feet (10-foot cells, Turns in `rules-adaptation.md`) and a compass: the map is drawn north up                                        |
| Motion   | `src/render/dungeon-motion.ts`, `DungeonView.tsx`, `world.css`              | The view grows on a step forward, shrinks on a step back, slides on a sidestep, swings on a turn, and shakes when a wall stops the party. The light stays put. Off under `prefers-reduced-motion` |
| Portrait | `src/render/encounter-portrait.ts`, `DungeonView.tsx`                       | A pending encounter's foes stand in the corridor ahead as the fight screen's silhouettes, dark against the torchlight, each row further back smaller and dimmer. Pitch dark shows none            |
| Charts   | `src/game/dungeon/chart.ts`, `World.charted` (save version 35)              | Not presentation, asked for while this was built: the party keeps its map of a dungeon between visits (Sam's call, `rules-adaptation.md`, Charts). A changed layout starts a fresh map            |

Furniture, last of V4:

| Piece   | Where                                                                                       | What it does                                                                                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Format  | `furniture` on a level (`src/data/schemas/dungeon-content.ts`), `src/data/dungeon-check.ts` | Optional list of a cell and a kind: rubble, bones, altar, fountain, brazier. Only on plain floor, one a cell; `pnpm validate:levels` checks it. Decoration only: no rule reads it                                              |
| Editor  | `setFurniture` in `src/game/dungeon/level-details.ts`, `CellPanel.tsx`, `LevelGrid.tsx`     | A Furniture choice on a selected floor cell, a two-letter mark in the cell's corner, and painting a cell as anything but floor clears it. The test walk shows it                                                               |
| Art     | `src/render/furniture-art.ts`                                                               | Path data in the figures' 48 by 48 box; flames and water in their own colours                                                                                                                                                  |
| View    | `src/render/dungeon-furniture.ts`, `dungeon-view.ts`, `DungeonView.tsx`                     | Each piece stands mid-cell, a cell wide, after the cell's far wall and before nearer side walls, shaded like stone and dimmed by the light. Flames aren't dimmed. What lies in the party's own cell is underfoot and not drawn |
| Map     | `automap-view.ts`, `Automap.tsx`                                                            | A small copy of the piece on its cell, once seen                                                                                                                                                                               |
| Content | `data/content/dungeons.json`                                                                | The Old Barrow: bones and rubble in the upper west room, an altar between braziers by the captive, a fountain, rubble, and bones below                                                                                         |

`dungeon-view.ts` passed 300 lines with this, so its `Panel` type and shading moved to `dungeon-panel.ts`.

## Follow-ups after V1 to V5

An audit of the stages against their exit criteria, and asks since:

| Item                    | Where                                                                    | What it does                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Odds for every attack   | `src/game/combat/blast.ts`, `blastOdds` in `src/render/fight-odds.ts`    | Elemental Blast makes an attack roll too, so it shows its odds like a weapon; its roll moved to `blast.ts` so the odds and the roll share it, and it floats a hit or a miss                                                                                                                                                                     |
| Odds on hover           | `Field.tsx`, `CommandMenu.tsx`                                           | Each target's odds are also its tooltip                                                                                                                                                                                                                                                                                                         |
| SRD citation            | `rules-adaptation.md`, Swapping                                          | Swapping notes that the SRD has no swap and that it builds on Run (2.4.4)                                                                                                                                                                                                                                                                       |
| Map zoom (Sam's ask)    | `src/render/map-zoom.ts`, `src/ui/world/ZoomFrame.tsx`                   | −, +, and Fit over the overland map and the map editor, and Ctrl with the wheel or a pinch about the pointer. Zoomed in, the map scrolls; zooming in from Fit closes in on the party                                                                                                                                                            |
| Side column (Sam's ask) | `MapScreen.tsx`, `DungeonScreen.tsx`, `layout.css`                       | First a column of quests, companions, and the like that minimized to a strip. Then (Sam's call) folded into the dock beside the main view: quests under the plan or the automap, the party and NPCs, then the panels of powers and places. The minimize went with the column. With no quest under way the quarter's plan says where to find one |
| Map opening (Sam's ask) | `knownBounds`, `fitZoom` in `src/render/map-zoom.ts`, `ZoomFrame.tsx`    | The overland opens as close in as shows every hex the party knows, with a few hexes of fog about them, centred on them; Fit still shows the whole map                                                                                                                                                                                           |
| Map keys (Sam's ask)    | `src/render/map-cursor.ts`, `src/ui/world/map-keys.ts`                   | Every hex is a button named for what lies there, with one Tab stop among them (Sam's call): Tab to the map, the arrow keys move from hex to hex, and Enter picks one as a click would                                                                                                                                                           |
| Darkness (Sam's ask)    | `src/render/dungeon-darkness.ts`, `dungeon-view.ts`                      | A square of magical darkness seen from outside is a block of black the light doesn't enter, hiding what lies beyond. Those who see without light (sight arts, Apprehending the Arcane Form) see into it, as they see standing in it                                                                                                             |
| Occupants (Sam's ask)   | `src/render/dungeon-occupants.ts`, `dungeon-view.ts`, `DungeonProps.tsx` | Who and what waits in the cells ahead stands there before the party arrives: a held captive between their guards, an unbeaten garrison, the active quest step's guardian, and its item as a chest. Each carries its name on hover. Up to three figures per cell; the editor's test walk shows none                                              |

## V7: richer procedural art

Sam's call: take the generated SVG further before reaching for prompted art (V6). The ground
rules above hold, plus one for phones: the dungeon view and the fight field redraw on every step
or turn, so they get no SVG filters (blur, turbulence, lighting). Depth comes from fills laid in
each panel's own quad. A filter may go on a layer that redraws only when it changes, such as the
overland's land layer.

| Slice       | Scope                                                                                                                                                                                                                   | State |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Surfaces    | Relief on the dungeon's stone, flagstones, doors, and stairs                                                                                                                                                            | Done  |
| Overland    | Glyph colours fixed, glyphs lit from the north-west with a shaded side and a ground shadow, and a paper grain over the land. Softer washes between terrains left for later                                              | Done  |
| Silhouettes | A lit rim and a shaded edge on each standing figure, so people and monsters read as solid in the fight field and the dungeon. With it (Sam's ask), a hoard's or vault's guards stand over its chest in the dungeon view | Done  |
| Light       | Pools of light on the floor and walls nearest the party, and rims on furniture, foes, and hoards on the side that faces the party's light, in that light's colour                                                       | Done  |

Surfaces:

| Piece        | Where                                                 | What it does                                                                                                                                                                                                         |
| ------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quad helpers | `src/render/dungeon-quad.ts`                          | Points, quads, laying lines and shapes inside a quad, and the hash, moved out of `dungeon-detail.ts` so the relief can draw with them without an import cycle. `dungeon-detail.ts` re-exports them                   |
| Stones       | `courses` in `src/render/dungeon-detail.ts`           | A wall's stones as fractions of its panel, shared by the mortar and the relief. The mortar and the darker stones are as before                                                                                       |
| Relief       | `src/render/dungeon-relief.ts`                        | Each stone lit along its top and shadowed along its foot, about one in seven a shade lighter, one in eight cracked, and grime in three bands up from a wall's foot. Flagstones are lit along their near edge instead |
| Wood, stairs | same, and `planks`, `treads` in `dungeon-detail.ts`   | Two wavering grain lines down each of a door's planks; each stair tread lit along its nosing, never cracked                                                                                                          |
| Drawing      | `ReliefShapes` in `src/ui/world/DungeonView.tsx`, CSS | Over the panel's fill and dark stones, under the mortar and the light's shadow, so the light dims the relief with the stone. The editor's test walk shares it                                                        |

Overland:

| Piece           | Where                                        | What it does                                                                                                                                                                                                                                                                            |
| --------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Glyph colours   | `src/ui/world/hex-terrain.css`               | A fix: the glyph rules began at `.hex-map`, which Chrome doesn't see from inside a `<use>` copy, so every glyph drew as a black shape with no ink line. They now begin at the symbol's own class, `hex-glyph` (renamed from `glyph`, which the level editor also uses)                  |
| Light and shade | `src/ui/world/HexArt.tsx`, `hex-terrain.css` | Lit from the north-west, as on a chart: a tree's crown shaded to the south-east with a glint to the north-west, a pine's east half darker, a hill's and a mesa's east face shaded, a dune's lee side; trees cast a shadow on the ground. Each filled shape keeps its ink outline on top |
| Paper grain     | `src/render/paper-grain.ts`, `HexMap.tsx`    | Specks and short fibres in a 97-unit tile, repeated as an SVG pattern over the land and under the hour's tint and the fog. A pattern rather than a filter, so zooming and scrolling cost nothing. An odd tile size keeps its repeat from lining up with the hexes                       |

Silhouettes:

| Piece          | Where                                                      | What it does                                                                                                                                                                                                                                                                                               |
| -------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relief         | `RELIEF` in `src/render/figure-draw.ts`                    | How far a figure's body is shifted against itself to find its edges; none for a figure that is down, which lies flat                                                                                                                                                                                       |
| Drawing        | `FigureParts` in `src/ui/arena/Figure.tsx`, `fight-fx.css` | The figure as before, then two translucent bands over it: light on the upper-left rim (the body less itself moved down and right) and shade on the lower-right edge (less itself moved up and left), each a small mask. Lines and cuts keep their order, so nothing is restacked                           |
| Dungeon        | `dungeon-props.css`                                        | A foe in the corridor stays dark, its rim catching the party's light in the torch's colour                                                                                                                                                                                                                 |
| Hoards in view | `occupantsOf` in `src/render/dungeon-occupants.ts`         | Sam's ask: a level's boss is seen before the fight. A guarded hoard or a ruin's vault shows its guards (up to two, the first row) standing over its chest, named for its warlord if it has one. Once beaten, or its order ended, the chest stands alone until taken. Unguarded caches are left to be found |

Light:

| Piece   | Where                                                          | What it does                                                                                                                                                                                                                         |
| ------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pool    | `pool` and `poolAt` in `src/render/dungeon-light.ts`           | Each light pools at the party's feet in its own colour (torch strongest, then lantern, then Light of Faith; sight casts none), easing off over the nearer 60% of its reach, so a guttering torch pools less far                      |
| Drawing | `Pool` in `src/ui/world/DungeonView.tsx`, `dungeon-view.css`   | Over each panel under the dark, flat or as a gradient along a panel running away, like the shadow. It holds steady while a torch flickers: fading it with the flicker would brighten and dim the view against the dark at once       |
| Facing  | `lightFrom` in `src/render/figure-draw.ts`                     | The party's light is held up in the middle of the corridor: a piece ahead catches it on its top, and one to either side on its top and the side toward the middle. Fights keep their light from the upper left                       |
| Rims    | `ReliefBands` in `src/ui/arena/Figure.tsx`, `DungeonProps.tsx` | The figures' light-and-shade bands, shared now by furniture, a hoard's chest, occupants, and the foes of a pending encounter, each with its own facing. In the dungeon the lit band takes the light's colour (`--light` on the view) |

Animals (Sam's ask, after the light):

| Piece    | Where                                                         | What it does                                                                                                                                                                                                                                                                                                |
| -------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Split    | `src/render/animal-art.ts`, `figure` in `monster-combat.json` | Seven more figures split from the shared beasts: vermin (rats, stoats, the death hare), big cats (the apex predator, the sabre-tooth, the stalkers), a boar, a tusker, a unicorn, a shelled beast (the giant turtle), and a lizard. The bear-like great beast, the canine beast, and the horned grazer stay |
| Override | `figure` on a setting monster, `withSettingMonsters`          | A setting monster that looks nothing like its base takes its own figure: the sand drake is a lizard, the bone crawler a crawler, the sand burrower a shelled beast                                                                                                                                          |
| Facing   | `facesMiddle` and `mirror` in `src/render/figure-draw.ts`     | Beasts are drawn facing left; in the dungeon one left of the corridor's middle turns round to face it, its light turning with it. Figures that stand upright face the viewer and are left alone                                                                                                             |
