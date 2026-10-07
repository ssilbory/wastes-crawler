/** Tells the player the party has just picked up a quest item. */
export function QuestItemNotice(props: {
  found: { quest: string; item: string }[];
  onDismiss: () => void;
}) {
  if (props.found.length === 0) return null;
  return (
    <div class="quest-found" role="status" aria-label="Quest item found">
      <div>
        <h3>Quest item found</h3>
        {props.found.map((f) => (
          <p key={f.quest}>
            {f.quest}: the party takes {f.item}.
          </p>
        ))}
      </div>
      <button type="button" onClick={props.onDismiss}>
        OK
      </button>
    </div>
  );
}
