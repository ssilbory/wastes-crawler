# Grid Crawler: Project Plan

Oct 2, 2026 · @Samuel Silbory

## Overview

Build a first-person, grid-based party dungeon crawler in the style of Wizardry and The Bard's Tale, running in the browser, written in TypeScript, with Claude Code doing most of the implementation. Rules are Worlds Without Number (WWN) from its CC0 SRD, plus a small set of house rules borrowed from Year Zero Engine. Personal project, not for sale.

**Goals**

| Goal                 | What it means                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| Classic crawler feel | Step-and-turn grid movement, first-person wireframe view, automapped minimap, party of adventurers  |
| Living dungeon       | Monsters, traps, allies, creatures to rescue, mission givers, special squares                       |
| OSR, but not too OSR | Lethal and resource-driven, without old-school opacity or save-or-die everywhere                    |
| Claude Code friendly | Typed, testable, data-driven, small files with hard layer boundaries                                |
| License clean        | Permissive OSS only (MIT, BSD, Apache, zlib, ISC, CC0). No GPL, LGPL, EPL, or MS-PL in shipped code |

**Non-goals:** 3D or modern graphics, multiplayer, mobile-native builds, monetization, procedural-everything (hand-authored levels first, procedural is optional later).

## Setting

A forbidding wasteland in the years after the Dark Lord was slain. There are no humans; the peoples who remain are those the old stories cast as monsters, servants, or strangers. The setting is original, since WWN's default setting is reserved.

| Element              | Canon                                                               |
| -------------------- | ------------------------------------------------------------------- |
| Playable peoples     | Goblins, Orcs, Elves, Centaurs, Beastmen, Gnomes, with more to come |
| Centaur lineages     | Deer, goat, lion, and bison                                         |
| Humans               | None                                                                |
| Livestock and beasts | No horses or cows. Aurochs and bison exist                          |
| Unicorns             | Exist, but are deer- or goat-based                                  |

## Tech stack

Everything below is permissively licensed. Licenses are from memory; verify each in its repo before adding it.

| Component          | Choice                       | License      | Role                                                                                                                                |
| ------------------ | ---------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Language           | TypeScript (strict)          | Apache-2.0   | All game code                                                                                                                       |
| Package manager    | pnpm                         | MIT          | Installs only versions at least 7 days old, with trust and install-script checks (`pnpm-workspace.yaml`)                            |
| Build / dev server | Vite                         | MIT          | Hot reload, static build                                                                                                            |
| UI                 | Preact                       | MIT          | Menus, the character builder, and other panels; the game view stays on Canvas 2D                                                    |
| Rendering          | Canvas 2D (built in)         | n/a          | First-person view, minimap, UI panels                                                                                               |
| Roguelike toolkit  | rot.js                       | BSD-3-Clause | Pathfinding, FOV, scheduler. Game randomness uses the seeded, serializable RNG in `src/rules/rng.ts` instead of rot.js's global one |
| Schema validation  | zod                          | MIT          | Typed, validated game data                                                                                                          |
| Unit tests         | Vitest                       | MIT          | Rules and engine tests                                                                                                              |
| Visual smoke tests | Playwright                   | Apache-2.0   | Screenshots Claude Code can inspect                                                                                                 |
| Lint / format      | ESLint, Prettier             | MIT          | Consistency                                                                                                                         |
| Optional later     | PixiJS                       | MIT          | Sprites, effects, if Canvas 2D gets limiting                                                                                        |
| CI / hosting       | GitHub Actions, GitHub Pages | n/a          | Typecheck, test, build, deploy static site                                                                                          |

Map authoring tools such as Tiled are fine to use even if GPL, since the editor's license doesn't attach to your data files. The repo itself never imports GPL-family code.

## Licensing and sources

The WWN SRD is CC0 and explicitly covers computer games, including verbatim text, tables, and spell names ([WWN SRD](https://wwn.quadrifons.com/)). Setting material and most GM tools from the full WWN book are excluded, so those get written from scratch.

| Source                                 | Status                                                             | How we use it                                                                               |
| -------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [WWN SRD](https://wwn.quadrifons.com/) | CC0                                                                | Vendored into the repo, extracted into JSON data                                            |
| WWN free/deluxe book (non-SRD parts)   | Reserved                                                           | Not used. No setting, NPCs, world tags, or GM tool text                                     |
| [CWN SRD](https://cwn.quadrifons.com/) | Public domain, per the mirror; verify against the official release | Crafting, mod, and maintenance rules, reskinned for fantasy                                 |
| Year Zero Engine                       | Mechanics only                                                     | Resource dice, Push, and journey rules from Forbidden Lands, reimplemented in our own words |
| Art and audio                          | CC0 only                                                           | Kenney.nl, OpenGameArt with the CC0 filter                                                  |

The site above is a third-party mirror. Before extraction, diff it against Sine Nomine's official SRD release to confirm fidelity.

- [x] Locate the official WWN SRD release and the mirror's source repo
- [x] Add `NOTICE` crediting the WWN SRD (not required under CC0, but good hygiene)
- [ ] Never describe the game as official or approved by Sine Nomine

## Architecture

Game logic is pure TypeScript with no DOM access; rendering only reads state; all content is data. Input becomes commands, the game layer applies them to state, and the renderer draws the result.

| Layer  | Path                 | Responsibility                                                        | Rule                                                                                        |
| ------ | -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Rules  | `src/rules/`         | Dice, checks, saves, attacks, Shock, spells, leveling                 | Pure functions. RNG passed in. No imports from other layers                                 |
| Game   | `src/game/`          | State machine, party, dungeon, encounters, quests, time               | Imports rules only. Owns all state mutation                                                 |
| Render | `src/render/`        | First-person view, minimap, portraits, panels                         | Reads state, never mutates it                                                               |
| UI     | `src/ui/`            | Keyboard/mouse input, menus                                           | Emits commands to the game layer                                                            |
| Data   | `data/`, `src/data/` | SRD extracts and authored content, plus their zod schemas and loaders | JSON validated by zod at load. `src/data` imports no other layer; every layer may import it |

Every encounter opens with a reaction roll, not a fight:

```
                              deal: ally, rescue, quest, trade
                        +----------------------------------------+
                        v                                        |
+--------+ stairs +-----------+       +----------+  else  +--------------+
|  Town  |<------>|  Explore  |------>| Reaction |------->|    Parley    |
+--------+        +-----------+       |   roll   |        +--------------+
    ^                   ^             +----------+               |
    |                   |                  | hostile             | talks fail
    |                   |                  v                     |
    |             +-----------+       +-----------+              |
    |             |   Loot    |<------|  Combat   |<-------------+
    |             +-----------+  won  +-----------+
    |                                      | party falls
    +--------------------------------------+
```

| From          | To            | When                                  |
| ------------- | ------------- | ------------------------------------- |
| Town          | Explore       | Take the stairs down (and back up)    |
| Explore       | Reaction roll | An encounter starts                   |
| Reaction roll | Combat        | Hostile                               |
| Reaction roll | Parley        | Any other result                      |
| Parley        | Explore       | A deal: ally, rescue, quest, or trade |
| Parley        | Combat        | Talks fail                            |
| Combat        | Loot          | Won, or the foes broke                |
| Loot          | Explore       | Treasure and gear collected           |
| Combat        | Town          | The party falls                       |

The game layer is this state machine. Each box is a mode with its own command set, and the renderer only draws the current mode.

```
/
  AGENTS.md
  NOTICE
  docs/
    plan.md               # this project plan
    rules-adaptation.md   # house rules and CRPG mappings (our text)
    content-guide.md      # how to author levels, NPCs, quests
    decisions/            # short ADRs for open decisions as they close
  vendor/wwn-srd/         # untouched SRD markdown
  data/
    srd/                  # JSON extracted from the SRD
    content/              # levels, encounter tables, NPCs, quests
  src/rules/  src/game/  src/render/  src/ui/
  tools/                  # srd-extract, combat sim, level validator
  tests/
```

**Map format.** Walls sit on cell edges, not in cells, as in Wizardry and Bard's Tale. Levels are authored as a doubled ASCII grid that Claude can write, diff, and validate: cells at odd coordinates, edges between them. Glyphs mark feature positions; details live in the level JSON keyed by coordinate.

```
+-+-+-+
|. . <|
+d+-+ +
|T .sN|
+-+-+-+
```

`-` and `|` are walls, a space is open, `d` is a door, `s` is a secret door, `<` is stairs up, and `T` and `N` are a trap and an NPC.

**First-person view.** Canvas 2D draws the corridor from the grid, far to near, three to four cells deep: side walls, front walls, doors, and floor features as trapezoids. Encounters show a portrait panel. Textures are an optional later upgrade.

**Minimap.** An automap of visited cells and seen edges, with fog for the rest. Darkness, spinners, and anti-map squares can suppress or mislead it.

**Save/load.** Game state, including RNG state, serializes to versioned JSON. Characters export and import as JSON from Phase 3, before any browser storage. Character saves to browser storage start with the arena in Phase 4, and world saves start in Phase 5. Saves autosave to browser storage, plus export and import as a file. A schema version field allows migrations from the first save. Character JSON import ships in the final game; players can edit their characters, and that's a feature. From Phase 11 (Sam's call) there are three world slots: the game autosaves into the slot chosen on the start screen, and slot 1 keeps the browser key the single save always used. Export writes a full save, the world and the character roster in one file (`kind: "wastes-crawler-save"`); loading takes a full save or a plain world save, and a full save's characters join the roster, replacing any with the same id. A reloaded save plays on identically, RNG included, which the Phase 11 exit tests check.

## Rules adaptation

The rules adaptation and every house rule live in [`rules-adaptation.md`](rules-adaptation.md). Decisions that close the open questions below are recorded in [`decisions/`](decisions/).

## Content model

Every piece of content is a JSON record with a zod schema and a stable id, so Claude can generate and validate content without touching engine code. A level validator checks references, reachability, and that every quest can be completed.

| Content type    | Key fields                                                                                                                                                     | Notes                                                                                                                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| People          | Attribute modifiers, signature racial foci, racial foci pick list, size, armor rules                                                                           | Goblins, Orcs, Elves, Centaurs (four lineages), Beastmen, Gnomes                                                                                                                                                                                                                                       |
| Background      | Skills, starting gear, flavor                                                                                                                                  | Authored for the setting; the SRD has only a handful                                                                                                                                                                                                                                                   |
| Monster         | SRD stat line, Instinct behaviors, reach and flying tags, portrait, XP value, loot dice, component drops                                                       | SRD monsters imported; new ones authored in the same shape                                                                                                                                                                                                                                             |
| Encounter table | Level, weighted entries, group size dice, surprise                                                                                                             | One per dungeon level, zone, or overland region                                                                                                                                                                                                                                                        |
| Fixed encounter | Coordinate, monsters, reaction override, one-shot flag                                                                                                         | Guardians, set pieces, bosses                                                                                                                                                                                                                                                                          |
| Trap            | Notice difficulty, disarm skill and difficulty, save type, effect                                                                                              | Pits, darts, gas, alarms, teleport traps                                                                                                                                                                                                                                                               |
| Ally / hireling | Class, level, loyalty, cost, slot size (1 or 2), join conditions                                                                                               | Recruitable in town or found in the dungeon. Giants and dragons take two slots                                                                                                                                                                                                                         |
| Rescue target   | Location, captors, escort rules, reward, quest link                                                                                                            | Creatures or people to free and bring back. Occupies an NPC slot while escorted                                                                                                                                                                                                                        |
| Mission giver   | Location, quests offered, prerequisites, dialogue                                                                                                              | Town NPCs and in-dungeon NPCs. Towns themselves carry services, shop stock, spending threshold (loot threshold is half), economy state, coach routes, workshop rental, and an arena                                                                                                                    |
| Craftsman       | Location, items they build (including magical weapons), required component types and counts, crown cost, build time, loot and component buy prices, trade pool | NPCs in towns or found in dungeons. They charge crowns, and they also buy loot and components from their own trade pool: selling to them draws it down, and buying from them balances it back. Regardless of the pool, 25% of crowns spent with a craftsman count toward the town's spending threshold |
| Quest           | Objectives, triggers, state flags, rewards, failure conditions, PC slot replacements                                                                           | Driven by an event bus from the game layer                                                                                                                                                                                                                                                             |
| Special square  | Type, parameters                                                                                                                                               | Spinner, teleporter, darkness, anti-magic, anti-map, damage floor, message                                                                                                                                                                                                                             |
| Item            | SRD stats or authored, size (standard or small), barding, quality tier, installed mods, reach and range properties, encumbrance, value, magic properties       | Includes resource-die items like torches                                                                                                                                                                                                                                                               |
| Mod             | Target item kind, minimum Craft level, loot dice cost, required component types and counts, effect                                                             | Fantasy mods authored fresh, since CWN's are cyberpunk                                                                                                                                                                                                                                                 |
| Component       | Name, generic type, rarity, sources                                                                                                                            | Dragon scale, gems, mithril, and similar                                                                                                                                                                                                                                                               |
| Dialogue        | Nodes, choices, skill checks, flag effects                                                                                                                     | Kept small; reaction result picks the entry node                                                                                                                                                                                                                                                       |

## Claude Code workflow

Claude Code works best here with hard boundaries, a feedback loop it can run itself, and one phase per branch. Each phase starts in plan mode, lands as a PR, and merges only with CI green.

Project rules for coding agents are in [`AGENTS.md`](../AGENTS.md).

| Tool              | Command                                                                              | Purpose                                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRD extractor     | `pnpm srd:extract`                                                                   | Vendored markdown to validated JSON, with a diff report on re-run                                                                                                                                                                                                           |
| Combat simulator  | `pnpm sim --party dir --enemies "thug-or-militia*4/veteran-soldier*2" --fights 1000` | Headless win rates, rounds, HP loss. Main balance tool                                                                                                                                                                                                                      |
| Economy validator | `pnpm sim:economy -- --delves 50 --seeds 100`                                        | Runs sequential delves and town visits headlessly across many seeds, and fails if an economic death spiral can lock the player out of progression. Locked out means the party can't cover rations plus basic healing from crowns and loot for three consecutive town visits |
| Level validator   | `pnpm validate:levels`                                                               | Map parse, reachability, references, quest completability                                                                                                                                                                                                                   |
| Visual smoke test | `pnpm test:visual`                                                                   | Playwright screenshots of key views for Claude to inspect                                                                                                                                                                                                                   |
| Debug console     | In game, dev builds only                                                             | Teleport, reveal map, spawn encounter, give item, god mode, set seed                                                                                                                                                                                                        |
| CI                | GitHub Actions                                                                       | Typecheck, lint, test, validate, build, deploy to Pages on main                                                                                                                                                                                                             |

## Milestones

Thirteen phases, each gated by an exit criterion Claude Code can verify. The arena at Phase 4 is the first thing you can play, and the overland hex map at Phase 5 is a complete game on its own; towns come next, then dungeons, then economy and crafting.

0. **Scaffold**
   - Scope: repo, Vite + TS strict, ESLint, Prettier, Vitest, CI, Pages deploy, `AGENTS.md`, `NOTICE`, vendored SRDs
   - Exit: blank page deployed from main, CI green
1. **SRD extraction**
   - Scope: zod schemas and JSON for skills, classes, foci, weapons, armor, gear, High Magic and Elementalist spells, Arts, monsters
   - Exit: all data validates; spot-checked against the SRD by hand
2. **Rules core**
   - Scope: seeded dice, skill checks, advantage and disadvantage, saves, attacks, Shock, HP, System Strain, Push, Broken, leveling past 10th, class switching rules
   - Exit: full Vitest coverage of the core resolution rules
3. **Characters, combat engine, and simulator**, in sub-phases. Each character sub-phase ships rules, builder UI, and JSON export and import together
   - **3a. Basic characters:** Goblins only, with the fighting classes (Warrior, Expert, and their Adventurer combination); attributes, backgrounds, HP, attack bonus; browser builder; JSON export and import
     - Exit: build a Goblin Warrior in the browser, export it to JSON, reload the page, and import it
   - **3b. Peoples:** the remaining peoples with attribute modifiers, centaur lineages, and size
     - Exit: build a valid character of every people
   - **3c. Foci:** standard foci, three racial foci per people, and the fill-in pick lists
     - Exit: the builder enforces foci counts and pick lists for every people
   - **3d. Gear:** weapons, armor, shields, Goblin and Gnome small armor, centaur barding (AC averaged, rounded down), encumbrance, starting gear
     - Exit: equipped characters' AC and attack values match hand-computed fixtures
   - **3e. Magic users:** High Mage and Elementalist, spells, the shared Effort pool, strain casting
     - Exit: build casters; Effort matches the best skill plus best attribute rule across classes
   - **3f. Combat engine and simulator:** formation and shielding, reach, enemy rows, initiative, actions, spells, morale, Instinct, mortal wounds, default actions, auto-combat
     - Exit: `pnpm sim` runs 1,000 fights with exported character JSON and reports win rate and average rounds
4. **Arena**
   - Scope: playable combat UI in the browser: formation view, command menus, default actions, auto-combat toggle, character saves to browser storage, a party picker using saved and imported characters, a monster picker, and a spectator mode for monster vs monster fights. Built as a reusable module, since it becomes the town arena in Phase 6
   - Exit: fight a chosen party against chosen monsters, and watch a monster vs monster fight to the end
5. **Overland hex map**
   - Scope: hex map and renderer, foot travel, quarter days and calendar, journey activities, terrain, rations resource die, Hungry, Sleepless, and Cold, overland encounters with reaction rolls, camping, world saves, and stand-in town hexes that give a full recovery, restore resource dice, and raise the dead when entered
   - Exit: a complete game on its own. Create a party and wander the hex map fighting things, surviving encounters, hunger, and cold
6. **Towns and NPCs**
   - Scope: town hub (tavern with party roster, temple, shop) at fixed prices, loot exchange at a flat rate, class switching, coach routes, town arenas reusing the Phase 4 module, hirelings and allies, parley, rescues, mission givers, quest state
   - Exit: accept a quest in town, complete it on the hex map, collect the reward
7. **Dungeons and renderer**
   - Scope: map format and validator, hex-map entrances, movement and turning, first-person view, doors, automap and minimap
   - Exit: enter a hand-built test level from the hex map and walk it in the browser; Playwright screenshots pass
8. **Dungeon exploration**
   - Scope: exploration time and quarter-day costs, random and fixed encounters, traps, secret doors, light and resource dice, dungeon camping, special squares, dungeon quests and rescues
   - Exit: a full delve from entrance to stairs and back, with fights, a trap, a camp, and a rescue
9. **Economy**
   - Scope: spending and loot thresholds, inflation and loot curves, resets, economic climate, and an economy validator that runs automated simulations (for example, 50 sequential delves and town visits)
   - Exit: overspending in one town raises its prices, and a new town or a month later shifts the party's crowns; the validator shows no economic death spiral can lock the player out of progression
10. **Crafting**
    - Scope: workshops, quality tiers, mods, components, maintenance, craftsmen with trade pools
    - Exit: build a mod from loot dice and components, keep it maintained at camp, and commission a magical weapon from a craftsman
11. **Persistence and polish**
    - Scope: full game save, load, export, and import (characters save from Phase 4, the world from Phase 5), character JSON import in the release build, settings, key remapping, optional sound, and an in-game level editor for the ASCII format (ADR 0003)
    - Exit: save mid-dungeon, reload, identical state including RNG
12. **Content and campaign**
    - Scope: levels 1 to N, encounter tables, quest chain, boss; optional WWN faction turn between delves
    - Exit: a complete campaign is playable start to finish

## Open decisions

Each one closes as a short ADR in `docs/decisions/` before the phase that needs it.

| Decision                          | Options                                                                                                                                              | Needed by |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| ~~High-level edge cases~~         | Closed in Phase 2: see `docs/decisions/0001-high-level-progression.md`                                                                               | Phase 2   |
| ~~Coach pricing and ambush odds~~ | Fixed per route in content, fare through the town surcharge, ambush die per travel day: see docs/rules-adaptation.md, Coaches and arenas in Phase 6d | Phase 6   |
| ~~Setting details~~               | Deferred to Phase 12: see `docs/decisions/0002-placeholder-setting.md`                                                                               | Phase 6   |
| ~~Level authoring~~               | Hand-written ASCII now, in-game editor in Phase 11: see `docs/decisions/0003-level-authoring.md`                                                     | Phase 7   |
| Procedural levels                 | None, optional side dungeons, or main campaign                                                                                                       | Phase 12  |

## Risks

The biggest risk is balance: WWN is tuned for a small table party with a GM adjudicating, not an eight-slot party grinding through random encounters.

| Risk                                    | Impact                                                                   | Mitigation                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Balance drift from tabletop assumptions | Fights too lethal or too trivial                                         | Combat simulator in Phase 3; tune encounter tables against target win rates                                   |
| Economic death spiral                   | The party can't afford food, healing, or gear and can't earn its way out | Economy validator in Phase 9; tune thresholds, curves, and climate swings until no seed locks out progression |
| Claude improvises D&D-isms              | Wrong math that looks plausible                                          | `AGENTS.md` rule to cite the SRD file; tests written from SRD values                                          |
| Mirror SRD differs from official        | Subtly wrong data                                                        | Diff each mirror against the official release before Phase 1                                                  |
| Scope creep                             | Never reaches a playable loop                                            | No art or campaign content in Phases 3 to 6; new classes and traditions wait until after Phase 10             |
| Renderer rabbit hole                    | Time spent on visuals over gameplay                                      | Wireframe only until Phase 12; textures are optional                                                          |
| Save format churn                       | Broken saves between versions                                            | Versioned schema with migrations from the first character export in Phase 3                                   |
| GPL-family dependency slips in          | License violation of your own rule                                       | License check in CI, such as license-checker with an allowlist                                                |
