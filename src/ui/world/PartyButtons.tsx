export type PartyScreen = 'character' | 'formation' | 'inventory';

/** The status-bar buttons that open the party's own screens. */
export function PartyButtons(props: { onOpen: (screen: PartyScreen) => void }) {
  return (
    <>
      <button type="button" onClick={() => props.onOpen('character')}>
        Characters
      </button>
      <button type="button" onClick={() => props.onOpen('formation')}>
        Formation
      </button>
      <button type="button" onClick={() => props.onOpen('inventory')}>
        Inventory
      </button>
    </>
  );
}
