import { buyMount, load, mountPrice, mountSellPrice, sellMount } from '../../game/world/mounts.ts';
import { monsterOf } from '../../game/world/npcs.ts';
import type { World } from '../../game/world/types.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import { cue } from '../sound.ts';
import type { Act } from './TownScreen.tsx';

const ROLES = {
  riding: 'Riding mount: carries gear, stays out of fights',
  war: 'War mount: fights beside its rider in overland fights',
  pack: 'Pack beast: takes an NPC slot and goes underground',
} as const;

/** The market's mounts (docs/rules-adaptation.md, Mounts): buy, and sell back. */
export function StableTab(props: { world: World; act: Act }) {
  const w = props.world;
  const owned = [...w.mounts, ...w.npcs.filter((n) => n.kind === 'pack')];
  return (
    <>
      <section class="panel" aria-label="Mounts for sale">
        <h2>Mounts for sale</h2>
        <p class="hint">
          Mounts carry gear and help the party slip away, but don't travel faster. They wait at a
          dungeon's entrance.
        </p>
        <ul class="tavern-list">
          {data.content.mountRules.mounts.map((t) => (
            <li key={t.id}>
              <span>
                <strong>{monsterOf(data, t.monster).name}</strong> · {ROLES[t.role]} ·{' '}
                {t.role === 'pack'
                  ? `carries ${t.loadUnridden}`
                  : `carries ${t.loadRidden} ridden, ${t.loadUnridden} unridden`}
                {t.role !== 'pack' && !t.riderSizes.includes('standard') && ' · small riders only'}
              </span>{' '}
              <button
                type="button"
                onClick={() => props.act(() => cue(buyMount(w, data, t.id), 'coin'))}
              >
                Buy ({crowns(mountPrice(w, data, t.id))})
              </button>
            </li>
          ))}
        </ul>
      </section>
      {owned.length > 0 && (
        <section class="panel" aria-label="Sell mounts">
          <h2>The party's mounts</h2>
          <ul class="tavern-list">
            {owned.map((m) => (
              <li key={m.id}>
                <span>
                  <strong>{m.name}</strong> · HP {m.hp}/{m.maxHp} · load {load(data, m)}
                </span>{' '}
                <button type="button" onClick={() => props.act(() => sellMount(w, data, m.id))}>
                  Sell ({crowns(mountSellPrice(w, data, m.type))})
                </button>
              </li>
            ))}
          </ul>
          <p class="hint">Hand gear to a mount, or take it back, in the shop.</p>
        </section>
      )}
    </>
  );
}
