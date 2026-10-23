/** The game's main loops in plain words; the rules themselves are in docs/rules-adaptation.md. */
export function HelpGameplay() {
  return (
    <details class="panel">
      <summary>
        <h2>Gameplay</h2>
      </summary>

      <h3>Strain (stress)</h3>
      <p>
        System Strain is the game's stress. Each character can take strain up to their Constitution.
        It comes from casting without a spell slot (the spell's level), magical healing, first aid,
        potions, and the healer (1 each), being Hungry, Sleepless, or Cold, and poison, disease, or
        carrying too much. At the limit a character is Broken: disadvantage on attacks, saves, and
        skill checks until a full rest in town, and death at twice the limit. Resting or sleeping
        eases 1 strain a quarter, but not while Hungry, Sleepless, or Cold. A night at the Inn
        clears it all.
      </p>

      <h3>Hiking and camping</h3>
      <p>
        A day has four quarters: morning, day, evening, and night. Hiking covers 2 hexes a quarter
        on open ground or a road, and 1 on difficult ground. Two hikes a day are free; a third or
        fourth needs a Strength or Constitution check, and failing ends the march. One character
        leads the way through unexplored hexes, and one keeps watch for trouble.
      </p>
      <p>
        Camping, each character picks a job: Rest, Sleep, Make camp (shelter), Keep watch, Forage,
        Hunt or fish, Gather firewood, or Craft. To recover overnight a character must have slept
        that day, be sheltered (a good camp or a town), and be free of Hungry, Sleepless, and Cold.
        On a harsh night, out in harsh land or any winter night, a party with no good camp needs a
        fire, or it ends up Cold. Every quarter outside town can bring an encounter: fight, slip
        away, or talk.
      </p>

      <h3>Spells per day</h3>
      <p>
        Casters have spell slots for the day. With no slot left, a known spell can still be cast for
        strain equal to its level. Slots, Effort committed for the day, and arts uses come back
        after a night of recovery (slept, sheltered, no conditions), or a night at the Inn. Effort
        committed for the scene comes back after the fight. Armor stops casting unless the caster
        has Armored Magic.
      </p>

      <h3>Food</h3>
      <p>
        The party's rations are one die: d12, d10, d8, d6, d4, then gone. It is rolled at the end of
        each day, and a 1 or 2 drops it a size. With no rations left, everyone is Hungry. Forage (+1
        size), hunt or fish (+2), butcher beasts after a fight, or stay at the Inn to restock to
        d12. Meals in town are free.
      </p>

      <h3>Loot</h3>
      <p>
        Treasure is carried as loot dice (the Loot: readout, such as 2d6 + 1d10), rolled into crowns
        when you sell. Sell it in town under Shop, or the traders on the Inn and healer tab. Each
        town pays less once you've sold past what it can afford, and that resets monthly. Each die
        weighs one item: porters, pack beasts, and mounts carry it first. If nobody can carry it,
        the smallest dice are left behind. Hirelings take a share of loot instead of wages.
      </p>

      <h3>Riding</h3>
      <p>
        Buy a mount on a town's Stable tab, then pick its rider in the Mounts panel, in town or on
        the map. Each PC rides one mount; a Riding Goat carries only Goblins and Gnomes, and
        centaurs never ride. A mount carries less gear with a rider, and can't take one while it
        carries more than that. Mounts don't travel faster, but a party that all rides gets +2 to
        slip away from a group it spots. Mounts wait at a dungeon's entrance. A War Boar fights from
        its rider's slot once the rider calms it (Cha/Ride against 8); the Rider focus skips the
        roll.
      </p>
      <p>
        A Beastmaster can ride a big enough companion (Ride in the Companions panel). It then fights
        from its master's slot without a check and frees its NPC slot, but carries no gear and
        counts as that PC's mount. Underground it steps down into a slot of its own, or waits at the
        entrance if there is no room, and is ridden again back on the surface.
      </p>
    </details>
  );
}
