import type { World } from '../../game/world/types.ts';
import { CharacterScreen } from './CharacterScreen.tsx';
import { FormationScreen } from './FormationScreen.tsx';
import { InventoryScreen } from './InventoryScreen.tsx';
import type { PartyScreen } from './PartyButtons.tsx';

/** The character, formation, and inventory screens, each returning to where it was opened. */
export function PartyScreens(props: {
  world: World;
  screen: PartyScreen;
  from: 'map' | 'town';
  /** The member the inventory opens on, when reached from their character sheet. */
  member: string | undefined;
  onChange: () => void;
  onScreen: (screen: PartyScreen | 'map' | 'town') => void;
  onMember: (id: string) => void;
}) {
  const w = props.world;
  const backLabel =
    props.from === 'town' ? 'Back to town' : w.dungeon ? 'Back to the dungeon' : 'Back to the map';
  const onBack = () => props.onScreen(props.from);
  if (props.screen === 'character')
    return (
      <CharacterScreen
        world={w}
        backLabel={backLabel}
        onInventory={(id) => {
          props.onMember(id);
          props.onScreen('inventory');
        }}
        onBack={onBack}
      />
    );
  if (props.screen === 'formation')
    return (
      <FormationScreen world={w} backLabel={backLabel} onChange={props.onChange} onBack={onBack} />
    );
  return (
    <InventoryScreen
      world={w}
      memberId={props.member}
      backLabel={backLabel}
      onChange={props.onChange}
      onBack={onBack}
    />
  );
}
