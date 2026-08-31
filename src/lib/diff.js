/**
 * Working out what changed between two loads of the board.
 *
 * A board that refreshes in the background is only useful if it says WHAT moved.
 * Rows quietly rearranging themselves while you are reading them is worse than
 * no refresh at all, so every remote change gets a moment of highlight and the
 * count is announced to screen readers.
 *
 * Pure functions, no Vue: the interesting cases are all about what counts as a
 * change, and those are worth testing without a browser.
 */

/**
 * Everything a card shows, in one string.
 *
 * Deliberately NOT a deep compare of the raw object. The raw row carries fields
 * the board never renders, and flashing a card because some `sync_token` moved
 * teaches people to ignore the highlight.
 */
export function cardSignature(card) {
    return JSON.stringify([
        card.title,
        card.subtitle,
        card.summary,
        card.updatedAt,
        card.badges,
        card.tags,
        card.meta,
    ]);
}

export function snapshot(cards) {
    const map = new Map();
    for (const card of cards) {
        map.set(card.id, {
            columnId: card.columnId,
            laneId: card.laneId,
            signature: cardSignature(card),
        });
    }
    return map;
}

/**
 * Compare two snapshots.
 *
 * `ignore` is the set of cards this user just moved themselves. Their own change
 * coming back from the server is not news, and flashing it is how a highlight
 * stops meaning "someone else touched this".
 *
 * One kind per card, most significant first: a card that arrived is 'added'
 * whatever else is true of it, and a card that changed column is 'moved' even if
 * its title changed too. A card can only flash one colour.
 */
export function diffSnapshots(previous, next, ignore = null) {
    const changes = new Map();
    if (!previous) return changes;

    for (const [id, after] of next) {
        if (ignore && ignore.has(id)) continue;
        const before = previous.get(id);

        if (!before) {
            changes.set(id, 'added');
        } else if (before.columnId !== after.columnId || before.laneId !== after.laneId) {
            changes.set(id, 'moved');
        } else if (before.signature !== after.signature) {
            changes.set(id, 'updated');
        }
    }

    return changes;
}

/** "3 cards updated", for the live region. Removals are counted, not flashed. */
export function describeChanges(changes, removedCount = 0) {
    const parts = [];
    const count = (kind) => [...changes.values()].filter((k) => k === kind).length;

    const added = count('added');
    const moved = count('moved');
    const updated = count('updated');

    if (added) parts.push(`${added} new`);
    if (moved) parts.push(`${moved} moved`);
    if (updated) parts.push(`${updated} updated`);
    if (removedCount) parts.push(`${removedCount} removed`);

    if (parts.length === 0) return '';
    const total = added + moved + updated + removedCount;
    return `${total} ${total === 1 ? 'card' : 'cards'}: ${parts.join(', ')}`;
}
