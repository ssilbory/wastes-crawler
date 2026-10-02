---
layout: default
title: Monster & NPC Statistics
parent: Monsters and Foes
nav_order: 1
---

## 5.1.0 Monster & NPC Statistics

The table of example stat lines has several columns, each one listing a particular statistic for the creature.

**Hit** dice are a measure of the creature’s general power, not unlike a level rating for PCs.
For each hit die a creature has, it rolls 1d8 for its hit points.
Most ordinary humans have only one hit die, while veterans of bloody struggle or ruthless court intrigue might have two, or three, or even more for the most heroic among them.

**AC** is for the creature’s Armor Class.
The higher this number, the harder it is to meaningfully hurt the thing.
Monsters and wild beasts have an Armor Class appropriate to their agility and the toughness of their hide; 12 or 13 for quick things with leathery skins, up to 15 for very well-armored beasts, or even up to 20 for things with supernatural hardihood.
Humans and other sentients usually have whatever Armor Class is granted by the armor they wear.
Some creatures have an “a” annotation with their AC; this just means that the creature wears armor and the AC given is what their usual armor is worth.

**Atk** is the creature’s usual total attack bonus for its hit rolls in combat.
For most creatures, this is equal to its hit dice, possibly with a bonus if it’s well-trained, exceptionally vicious, or supernaturally powerful.
Some creatures have more than one attack, indicated by an “x2” or “x3” notation.
This means the creature can attack two or three times with a single Main Action, directing them all at a single creature or splitting them up among nearby foes within reach.

**Dmg** is the damage done by a successful hit by the creature.
If the listing says “Wpn”, then it does whatever damage is usual for the weapon that it’s wielding.
A creature will never do less damage on a hit than it would do with its Shock score, if Shock would apply to the target.

**Shock** is the Shock damage inflicted by the creature and the maximum AC it affects.
Thus, “3/13” means that the creature inflicts a minimum of 3 points of Shock damage on a miss to any foe with an AC of 13 or less. “Wpn” means the usual Shock damage of the weapon being used is applied.
Exceptionally powerful or savage creatures might automatically apply Shock regardless of the AC of the foe; such creatures have a dash listed for the maximum AC, such as “3/-”.
Such damage is always applied unless the foe is immune to Shock.

**Move** is the distance the creature can move with a single Move action.
Some creatures may fly, others swim, or still stranger means of locomotion may apply depending on the beast’s nature.

**ML** is the creature’s Morale score.
Whenever a Morale check is forced by a situation, the creature must roll 2d6.
If the total is greater than its Morale score, it loses its taste for the fight and will retreat, surrender, or otherwise take whatever actions seem best to get it safely away.

**Inst** is the creature’s Instinct score.
When confused, infuriated, or goaded in combat, it runs the risk of behaving according to its instincts rather than martial prudence.

**Skill** is the creature’s total Skill bonus for any skill checks it makes that are in line with its talents and abilities.
If the creature ought to be good at something, it can add its Skill bonus to the base 2d6 skill check.
If not, it adds +0, or might even take a penalty if it seems like something it would be exceptionally bad at doing.

**Save** is the saving throw target used by the creature whenever it’s called upon to make a Physical, Mental, Evasion, or Luck saving throw.
Unlike PCs, creatures only have a single save target, usually equal to 15 minus half its hit dice, rounded down.
Thus, a foe with 3 hit dice usually rolls 14+ to succeed at any saving throw.
This score can’t be less than 2+, as a 1 on a saving throw always fails.

| Normal Humans            |  HD |  AC |   Atk. |  Dmg. |   Shock | Move |  ML | Inst. | Skill | Save |
| ------------------------ | --: | --: | -----: | ----: | ------: | ---: | --: | ----: | ----: | ---: |
| Peaceful Human           |   1 |  10 |     +0 |   Wpn |     Wpn |  30' |   7 |     5 |    +1 |  15+ |
| Thug or Militia          |   1 | 13a |     +1 |   Wpn |     Wpn |  30' |   8 |     4 |    +1 |  15+ |
| Barbarian Fighter        |   1 | 13a |     +2 | Wpn+1 |   Wpn+1 |  30' |   8 |     5 |    +1 |  15+ |
| Veteran Soldier          |   1 | 13a |     +2 | Wpn+1 |   Wpn+1 |  30' |   8 |     3 |    +1 |  15+ |
| Skilled Veteran          |   2 | 15a |     +3 | Wpn+1 |   Wpn+1 |  30' |   9 |     2 |    +1 |  14+ |
| Elites or Special Guards |   3 | 18a |     +4 | Wpn+2 |   Wpn+2 |  30' |  10 |     2 |    +2 |  14+ |
| Knight or Minor Hero     |   4 | 18a |     +6 | Wpn+2 |   Wpn+2 |  30' |  10 |     1 |    +2 |  13+ |
| Warrior Baron            |   6 | 18a |     +8 | Wpn+3 |   Wpn+3 |  30' |   9 |     1 |    +2 |  12+ |
| Barbarian Warlord        |   8 | 16a | +10 x2 | Wpn+4 | Wpn+4/- |  30' |  10 |     3 |    +2 |  11+ |
| Mighty General           |   8 | 18a |    +10 | Wpn+4 | Wpn+4/- |  30' |  10 |     1 |    +3 |  11+ |
| Major Hero               |  10 | 18a | +12 x2 | Wpn+5 | Wpn+5/- |  30' |  10 |     2 |    +3 |  10+ |
| Great Warrior King       |  12 | 18a | +14 x2 | Wpn+5 | Wpn+5/- |  30' |  10 |     1 |    +3 |   9+ |

| Spellcasters     |  HD |  AC | Atk. |  Dmg. | Shock | Move |  ML | Inst. | Skill | Save |
| ---------------- | --: | --: | ---: | ----: | ----: | ---: | --: | ----: | ----: | ---: |
| Petty Mage       |   2 |  10 |   +1 |   Wpn |   Wpn |  30' |   8 |     4 |    +1 |  14+ |
| Tribal Shaman    |   4 |  10 |   +3 | Wpn+1 | Wpn+1 |  30' |   9 |     4 |    +1 |  13+ |
| Skilled Sorcerer |   5 |  10 |   +1 |   Wpn |   Wpn |  30' |   9 |     4 |    +2 |  13+ |
| Master Wizard    |   8 |  13 |   +1 |   Wpn |   Wpn |  30' |   9 |     3 |    +2 |  11+ |
| Famous Arch-Mage |  10 |  13 |   +2 |   Wpn |   Wpn |  30' |   9 |     2 |    +3 |  10+ |

Mages generally have the spellcasting and Arts of an appropriate mage tradition at a level equal to their hit dice and Effort equal to their skill bonus plus two.

| Normal animals          | HD  |  AC |  Atk. | Dmg. | Shock | Move |  ML | Inst. | Skill | Save |
| ----------------------- | --- | --: | ----: | ---: | ----: | ---: | --: | ----: | ----: | ---: |
| Small Pack Predator     | 1   |  12 |    +2 |  1d4 |  1/13 |  40' |   7 |     6 |    +1 |  15+ |
| Large Solitary Predator | 5   |  13 |    +6 |  1d8 |  2/13 |  30' |   8 |     6 |    +1 |  13+ |
| Apex Predator           | 6   |  13 | +6 x2 |  1d8 |  2/13 |  40' |   8 |     6 |    +2 |  12+ |
| Herd Beast              | 2   |  11 |    +2 |  1d4 |  None |  40' |   7 |     6 |    +1 |  14+ |
| Vicious Large Herbivore | 4   |  13 |    +5 | 1d10 |  1/13 |  40' |   9 |     6 |    +1 |  13+ |
| Elephantine Grazer      | 6   |  13 |    +5 |  2d8 |  None |  40' |   7 |     6 |    +1 |  12+ |

| Unnatural Entities        | HD  |  AC |   Atk. |   Dmg. | Shock | Move |  ML | Inst. | Skill |     |
| ------------------------- | --- | --: | -----: | -----: | ----: | ---: | --: | ----: | ----: | --: |
| Save Automaton, Humanlike | 2   |  13 |     +2 |    Wpn |   Wpn |  30' |  12 |     3 |    +1 | 14+ |
| Automaton, Laborer        | 2   |  15 |     +2 |    1d6 |  1/13 |  30' |  12 |     3 |    +1 | 14+ |
| Automaton, Military       | 4   |  18 |     +5 | 1d10+2 |  4/15 |  30' |  12 |     3 |    +1 | 13+ |
| Automaton, Warbot         | 10  |  20 | +12 x3 | 1d12+5 |   7/- |  40' |  12 |     2 |    +2 | 10+ |
| Slime or ooze             | 6   |  10 |  +6 x2 |    1d8 |   1/- |  20' |  12 |     5 |    +1 | 12+ |
| Predator, Small Vicious   | 1   |  14 |     +1 |    1d4 |  1/13 |  30' |   7 |     5 |    +1 | 15+ |
| Predator, Large Vicious   | 6   |  13 |  +7 x2 |    2d6 |  2/15 |  40' |   9 |     5 |    +2 | 13+ |
| Predator, Hulking         | 10  |  15 | +12 x2 |  2d6+3 |  6/15 |  30' |  10 |     4 |    +1 | 10+ |
| Predator, Hellbeast       | 10  |  18 | +12 x4 | 1d10+5 |   6/- |  60' |  11 |     4 |    +3 | 10+ |
| Unnatural Swarm           | 4   |  10 |  +6 x3 |    1d6 |   1/- |  30' |  10 |     5 |    +1 | 13+ |
| Terrible Warbeast         | 8   |  15 | +10 x2 |  2d6+4 |  7/15 |  40' |   9 |     4 |    +2 | 11+ |
| Legendary God-Titan       | 20  |  22 | +20 x3 | 2d10+5 |  10/- |  40' |  10 |     3 |    +3 |  2+ |

### 5.1.1 Powerful Foes

These statistics are only a bare framework for most ordinary creatures. An entity of special power, such as a heroic knight or monstrous beast, should likely have at least one special ability related to their skills or nature. Potent enemies without a significant number of special defenses and powerful attack modes can often be chewed down rapidly by a PC party. Granting major enemies multiple actions per round and a good selection of special powers is generally necessary to make them a worthy opponent for a veteran party.
