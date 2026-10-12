# 0003: Levels are hand-written ASCII, with an in-game editor in Phase 11

Status: accepted, 2026-10-03

## Context

Phase 7 needs a level format before the renderer can draw anything. The plan offered hand-written ASCII only, or ASCII plus an in-game editor later.

## Decision

- Levels are authored as the doubled ASCII grid from the plan (walls on cell edges, cells at odd coordinates), inside level JSON in `data/content/dungeons.json`, with stairs links and feature details keyed by cell.
- `pnpm validate:levels` checks every level: grid shape, glyphs, stairs links, and that every cell is reachable from the entrance.
- An in-game level editor that reads and writes the same format is built in Phase 11, Persistence and polish.

## Consequences

- Claude can write, diff, and validate levels as text from Phase 7 on.
- The editor in Phase 11 must round-trip the ASCII format exactly, so hand-written and edited levels stay interchangeable.

## Phase 11 update

The editor is at `#/editor` (Sam's calls: edit, validate, test-walk, export; game content stays file-based). It paints walls, doors, secret doors, stairs, traps, and NPC cells on the doubled grid, checks the dungeon with the same validator as `pnpm validate:levels` as you edit, walks the edited geometry in first person (secret doors open, no party, light, time, traps, or encounters), and downloads `dungeons.json` with the edited maps, row for row. Its Select tool edits a cell's details (Phase 17): whether it is a safe camping square, a trap's name, notice and disarm checks, save, and effect, and whether an NPC is a captive held by guards (an `N` cell) or a garrison post under a standing order (on plain floor, shown as G). A painted trap or NPC starts from the first of its kind in the content, and painting over a cell removes its details. Stairs links and special squares are still edited in the JSON; the validator says which ones a painted feature needs. A test checks that an unchanged level round-trips exactly.

## Saving and the map editor

Sam's calls, 2026-10-12. The level editor saves dungeons in the browser (`wastes-crawler.editor` in local storage), shows saved ones beside the shipped ones (a saved copy of a shipped dungeon stands in for it in the editors), starts new one-level dungeons, imports dungeon JSON, and saves copies under a new name. It also edits what used to need JSON: the dungeon's name and map hex, adding, renaming, ordering, and removing levels, each level's wandering check, where stairs lead (with a one-click link back), and where the party comes in.

An overland map editor at `#/maps` picks a shipped or saved map, rolls a random one with settlements and roads from a seed (`data/content/map-gen.json`), paints terrain and danger, places, renames, and resizes settlements, chooses the starting town, and puts any dungeon on a hex. Saving a map saves the dungeons placed on it. Both editors check their work with the same checks as the content tests, and export `dungeons.json` or `regions.json` to save over the content files. The game plays saved dungeons too (Sam's call): each time the Overland screen opens it adds every saved dungeon that stands on a shipped map and passes every content check, in the order they were saved; the level editor says whether a saved dungeon is in the game, or why not. Saved maps stay in the editor for now. Each way down needs a hex of its own, so a dungeon on another's or a ruin's hex is a problem. A save made inside a dungeon that has since been deleted, or redrawn so the party's level or cell is gone, loads with the party back on the surface.

## New maps and worlds on them

Sam's calls, 2026-10-12. The map editor starts a new region blank (one terrain, with a village in the middle where a party starts) as well as at random. The Overland start screen picks the world a new game is played on: the campaign, or any map saved in the map editor, and can create a new random world there, saved to the map editor. A world on a custom map keeps a copy of its map in the save, so later edits in the map editor don't change a world under way, and plays the dungeons saved on that map. It has no campaign story: no factions, raids, warlord's clock, standing orders, crafter's notes, intro, or captives bound for the campaign's towns. Its towns have shops, inns, training, and the other services that aren't tied to a named town, but no quest givers, arena, or craftsman. A map can't be a world while it fails the overland checks or reuses another map's town id.
