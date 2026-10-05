import type { KnownFoe } from '../../render/bestiary-view.ts';

/** The statistics of monsters the party has named with Know. */
export function KnownFoes(props: { foes: KnownFoe[] }) {
  if (props.foes.length === 0) return null;
  return (
    <section class="known-foes" aria-label="Known foes">
      <h3>Known foes</h3>
      <dl>
        {props.foes.map((f) => (
          <div key={f.id}>
            <dt>{f.name}</dt>
            <dd>{f.stats}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
