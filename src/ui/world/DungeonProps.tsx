import { darkness, type LightView } from '../../render/dungeon-light.ts';
import type { Panel } from '../../render/dungeon-view.ts';
import { CHEST } from '../../render/dungeon-occupants.ts';
import type { Part } from '../../render/figure-art.ts';
import { FigureParts, ReliefBands } from '../arena/Figure.tsx';

// What stands in the cells of the first-person view: furniture (docs/presentation-plan.md, V4),
// and the people, foes, and quest items in them (dungeon-occupants.ts).

/** Parts in the stone's shade; flames and water keep their own colours. */
function Shaded(props: { parts: Part[]; fill: string }) {
  return (
    <>
      {props.parts.map((part, i) =>
        part.kind === 'fill' ? (
          <path
            key={i}
            class={part.tone ?? 'body'}
            d={part.d}
            fill={part.tone ? undefined : props.fill}
          />
        ) : (
          <path
            key={i}
            class={`${part.kind} ${part.tone ?? ''}`}
            d={part.d}
            stroke-width={part.width}
            stroke={part.tone || part.kind === 'cut' ? undefined : props.fill}
          />
        ),
      )}
    </>
  );
}

/**
 * A piece of furniture standing in its cell, in the stone's shade and dimmed with distance like
 * the trap marks; flames and water keep their own colours.
 */
export function FurnitureShape(props: { panel: Panel; light: LightView | null }) {
  const { panel, light } = props;
  const art = panel.furniture as NonNullable<Panel['furniture']>;
  const box = { x: art.x, y: art.y, width: art.size, height: art.size, viewBox: '0 0 48 48' };
  // Fire makes its own light, so the dark doesn't dim it.
  const flames = art.parts.filter((p) => p.tone === 'flame');
  return (
    <>
      <svg
        class={`furniture ${art.kind}`}
        {...box}
        opacity={light ? 1 - darkness(light, panel.span.near) : undefined}
      >
        <title>{art.kind}</title>
        {art.parts
          .filter((p) => p.tone !== 'flame')
          .map((part, i) =>
            part.kind === 'fill' ? (
              <path
                key={i}
                class={part.tone ?? 'body'}
                d={part.d}
                fill={part.tone ? undefined : panel.fill}
              />
            ) : (
              <path
                key={i}
                class={`${part.kind} ${part.tone ?? ''}`}
                d={part.d}
                stroke-width={part.width}
                stroke={part.tone || part.kind === 'cut' ? undefined : panel.fill}
              />
            ),
          )}
        <ReliefBands parts={art.parts} by={art.light} />
      </svg>
      {flames.length > 0 && (
        <svg class="furniture" {...box}>
          {flames.map((part, i) => (
            <path key={i} class="flame" d={part.d} />
          ))}
        </svg>
      )}
    </>
  );
}

/**
 * Who or what stands in a cell: a captive among their guards, a garrison's troops, a quest's
 * guardians as dark shapes caught by the light, or a quest item's chest. Dimmed with distance.
 */
export function OccupantShape(props: { panel: Panel; light: LightView | null }) {
  const { panel, light } = props;
  const o = panel.occupant as NonNullable<Panel['occupant']>;
  return (
    <g
      class={`occupant ${o.kind}`}
      opacity={light ? 1 - darkness(light, panel.span.near) : undefined}
    >
      <title>{o.title}</title>
      {o.pieces.map((p, i) => (
        <svg
          key={i}
          class={p.figure ? (p.foe ? 'foe' : 'captive') : 'furniture'}
          x={p.x}
          y={p.y}
          width={p.size}
          height={p.size}
          viewBox="0 0 48 48"
        >
          {p.figure ? (
            <FigureParts figure={p.figure} down={false} light={p.light} />
          ) : (
            <>
              <Shaded parts={CHEST} fill={panel.fill} />
              <ReliefBands parts={CHEST} by={p.light} />
            </>
          )}
        </svg>
      ))}
    </g>
  );
}
