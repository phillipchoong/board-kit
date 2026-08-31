/**
 * Turning a drop into something a server can store.
 *
 * The kit deliberately does not know how your table orders rows, so a move
 * event carries three different answers to "where did it land" and lets the
 * endpoint use whichever one fits:
 *
 *   to.index    the 0-based slot in the destination column
 *   position    a number that sorts between the two neighbours
 *   orderedIds  the full id order of the destination column after the move
 *
 * `orderedIds` is the one that cannot drift. `position` is the cheap one when
 * rows carry a sortable number already. `index` is for tables that store no
 * order at all and just want to know the stage changed.
 */

import { bucketKey, idOf } from './model.js';

/** Positions this close together cannot be split again without rounding. */
const MIN_GAP = 1e-6;

/**
 * A number that sorts strictly between two neighbours.
 *
 * Returns `null` when neither neighbour carries a position - that board is not
 * using numeric ordering, and inventing a number for it would be a lie the
 * server then has to store.
 */
export function positionBetween(before, after) {
    const a = before && Number.isFinite(before.position) ? before.position : null;
    const b = after && Number.isFinite(after.position) ? after.position : null;

    if (a === null && b === null) return { position: null, needsRenumber: false };
    if (a === null) return { position: b - 1, needsRenumber: false };
    if (b === null) return { position: a + 1, needsRenumber: false };

    const gap = b - a;
    return { position: a + gap / 2, needsRenumber: gap < MIN_GAP };
}

/**
 * Build the payload for one drop.
 *
 * `destination` is the destination bucket in its current order, WITHOUT the
 * moved card in it. Callers strip the card first so the index maths does not
 * have to care whether the move crossed columns or stayed inside one.
 */
export function buildMove({ card, from, to, index, destination }) {
    const list = destination ?? [];
    const clamped = Math.max(0, Math.min(index, list.length));
    const before = clamped > 0 ? list[clamped - 1] : null;
    const after = clamped < list.length ? list[clamped] : null;
    const { position, needsRenumber } = positionBetween(before, after);

    const orderedIds = [...list.slice(0, clamped).map((c) => c.id), card.id, ...list.slice(clamped).map((c) => c.id)];

    return {
        cardId: card.id,
        card: card.raw,
        from: { columnId: from.columnId, laneId: from.laneId, index: from.index },
        to: { columnId: to.columnId, laneId: to.laneId, index: clamped },
        beforeId: before ? before.id : null,
        afterId: after ? after.id : null,
        position,
        needsRenumber,
        orderedIds,
        changedColumn: from.columnId !== to.columnId,
        changedLane: from.laneId !== to.laneId,
    };
}

/**
 * Turn a raw Sortable drop into a move.
 *
 * THE TRANSLATION THIS EXISTS FOR: Sortable counts the cards it can see, and a
 * filtered column is not showing all of them. "Slot 2" in a filtered column
 * means "after the second VISIBLE card", which can be slot 9 in the real one.
 * Resolving that through the visible card's identity - rather than trusting the
 * raw index - is what stops `orderedIds` from quietly dropping every card the
 * filter is hiding.
 *
 * Returns `null` for a drop that changed nothing, so the caller does not emit a
 * move or fire a request for a card put back where it started.
 */
export function resolveDrop({ payload, cards, allBuckets, visibleBuckets }) {
    const card = cards.find((c) => c.id === idOf(payload.cardId));
    if (!card) return null;

    const toKey = bucketKey(payload.to.laneId, payload.to.columnId);
    const fromKey = bucketKey(payload.from.laneId, payload.from.columnId);

    const without = (list) => (list ?? []).filter((c) => c.id !== card.id);
    const visibleDestination = without(visibleBuckets.get(toKey));
    const destination = without(allBuckets.get(toKey));
    const source = allBuckets.get(fromKey) ?? [];

    const previous = payload.to.index > 0 ? visibleDestination[payload.to.index - 1] : null;
    let index;
    if (!previous) {
        index = 0;
    } else {
        const found = destination.findIndex((c) => c.id === previous.id);
        index = found === -1 ? payload.to.index : found + 1;
    }

    const fromIndex = source.findIndex((c) => c.id === card.id);

    const move = buildMove({
        card,
        from: { columnId: payload.from.columnId, laneId: payload.from.laneId, index: fromIndex },
        to: { columnId: payload.to.columnId, laneId: payload.to.laneId },
        index,
        destination,
    });

    if (!move.changedColumn && !move.changedLane && move.to.index === fromIndex) return null;
    return move;
}

/**
 * The menu path. A card sent to another stage lands at the end of it: the menu
 * offers a stage, not a slot, so inserting it anywhere else would be a guess.
 */
export function resolveMenuMove({ card, patch, allBuckets }) {
    const toColumnId = patch.columnId ?? card.columnId;
    const toLaneId = patch.laneId ?? card.laneId;
    if (toColumnId === card.columnId && toLaneId === card.laneId) return null;

    const destination = (allBuckets.get(bucketKey(toLaneId, toColumnId)) ?? []).filter((c) => c.id !== card.id);
    const source = allBuckets.get(bucketKey(card.laneId, card.columnId)) ?? [];

    return buildMove({
        card,
        from: { columnId: card.columnId, laneId: card.laneId, index: source.findIndex((c) => c.id === card.id) },
        to: { columnId: toColumnId, laneId: toLaneId },
        index: destination.length,
        destination,
    });
}

/**
 * Apply the optimistic moves on top of the props, so the card sits where the
 * user dropped it while the request is still in flight.
 *
 * Column and lane come from the move; ORDER does not - it is handed back as a
 * separate map keyed by bucket, because a position number invented here would
 * collide with the real numbers on every other card in that column.
 */
export function applyPending(cards, pending) {
    if (!pending || pending.length === 0) return { cards, order: new Map() };

    const moveByCard = new Map();
    for (const move of pending) moveByCard.set(move.cardId, move);

    const next = cards.map((card) => {
        const move = moveByCard.get(card.id);
        if (!move) return card;
        return { ...card, columnId: move.to.columnId, laneId: move.to.laneId };
    });

    const order = new Map();
    for (const move of pending) {
        order.set(bucketKey(move.to.laneId, move.to.columnId), move.orderedIds);
    }

    return { cards: next, order };
}

/**
 * Reorder buckets in place to honour the optimistic order overrides.
 *
 * Ids the override does not mention keep their relative order and sit after the
 * ones it does - a card that arrived from the server mid-drag appears at the
 * bottom rather than shuffling the user's own move out from under them.
 */
export function applyOrder(buckets, order) {
    for (const [key, ids] of order) {
        const list = buckets.get(key);
        if (!list) continue;
        const rank = new Map(ids.map((id, index) => [idOf(id), index]));
        list.sort((a, b) => {
            const ar = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER;
            const br = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER;
            if (ar !== br) return ar - br;
            return a.seq - b.seq;
        });
    }
    return buckets;
}

/**
 * Has the server caught up with this optimistic move?
 *
 * Checked against the raw props on every update. When the incoming data already
 * puts the card where the user dropped it, the override is dropped so the props
 * become the truth again. A move the caller neither confirms nor reverts still
 * clears itself this way.
 */
export function isSettled(move, cards) {
    const card = cards.find((c) => c.id === move.cardId);
    if (!card) return true; // the card is gone; keeping an override for it is pointless
    return card.columnId === move.to.columnId && card.laneId === move.to.laneId;
}
