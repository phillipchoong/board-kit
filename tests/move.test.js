import { describe, expect, it } from 'vitest';
import { NO_LANE, bucketKey, groupCards, normaliseCards, normaliseColumns, normaliseLanes } from '../src/lib/model.js';
import { applyOrder, applyPending, buildMove, isSettled, positionBetween, resolveDrop, resolveMenuMove } from '../src/lib/move.js';

const columns = normaliseColumns([
    { id: 'todo', title: 'To do' },
    { id: 'doing', title: 'Doing' },
]);
const lanes = normaliseLanes(null);

const make = (cards) => normaliseCards(cards, { hasLanes: false });
const group = (cards) => {
    const { buckets } = groupCards(cards, columns, lanes);
    return buckets;
};

describe('positionBetween', () => {
    it('returns null when neither neighbour is numbered - the board is not ordered', () => {
        expect(positionBetween(null, null).position).toBe(null);
        expect(positionBetween({ position: null }, { position: null }).position).toBe(null);
    });

    it('steps past a single neighbour', () => {
        expect(positionBetween({ position: 4 }, null).position).toBe(5);
        expect(positionBetween(null, { position: 4 }).position).toBe(3);
    });

    it('splits the gap between two', () => {
        expect(positionBetween({ position: 2 }, { position: 4 }).position).toBe(3);
    });

    it('flags a gap too small to split again', () => {
        expect(positionBetween({ position: 1 }, { position: 1 }).needsRenumber).toBe(true);
        expect(positionBetween({ position: 1 }, { position: 2 }).needsRenumber).toBe(false);
    });
});

describe('buildMove', () => {
    const cards = make([
        { id: 'a', columnId: 'doing', position: 0 },
        { id: 'b', columnId: 'doing', position: 1 },
        { id: 'c', columnId: 'doing', position: 2 },
    ]);
    const card = make([{ id: 'x', columnId: 'todo', position: 0 }])[0];
    const from = { columnId: 'todo', laneId: NO_LANE, index: 0 };
    const to = { columnId: 'doing', laneId: NO_LANE };

    it('names both neighbours and the whole new order', () => {
        const move = buildMove({ card, from, to, index: 1, destination: cards });
        expect(move.beforeId).toBe('a');
        expect(move.afterId).toBe('b');
        expect(move.orderedIds).toEqual(['a', 'x', 'b', 'c']);
        expect(move.position).toBe(0.5);
    });

    it('handles both ends of the column', () => {
        expect(buildMove({ card, from, to, index: 0, destination: cards }).orderedIds).toEqual(['x', 'a', 'b', 'c']);
        expect(buildMove({ card, from, to, index: 3, destination: cards }).orderedIds).toEqual(['a', 'b', 'c', 'x']);
        expect(buildMove({ card, from, to, index: 3, destination: cards }).afterId).toBe(null);
    });

    it('clamps an index past the end rather than leaving a hole', () => {
        const move = buildMove({ card, from, to, index: 99, destination: cards });
        expect(move.to.index).toBe(3);
    });

    it('says which of the column and the lane actually changed', () => {
        const move = buildMove({ card, from, to, index: 0, destination: cards });
        expect(move.changedColumn).toBe(true);
        expect(move.changedLane).toBe(false);
    });
});

describe('resolveDrop', () => {
    const cards = make([
        { id: 'a', columnId: 'todo', position: 0 },
        { id: 'b', columnId: 'todo', position: 1 },
        { id: 'x', columnId: 'doing', position: 0 },
    ]);
    const allBuckets = group(cards);

    it('returns null for a drop that put the card back where it was', () => {
        const move = resolveDrop({
            payload: {
                cardId: 'a',
                from: { columnId: 'todo', laneId: NO_LANE, index: 0 },
                to: { columnId: 'todo', laneId: NO_LANE, index: 0 },
            },
            cards,
            allBuckets,
            visibleBuckets: allBuckets,
        });
        expect(move).toBe(null);
    });

    it('resolves a cross-column drop against the destination', () => {
        const move = resolveDrop({
            payload: {
                cardId: 'x',
                from: { columnId: 'doing', laneId: NO_LANE, index: 0 },
                to: { columnId: 'todo', laneId: NO_LANE, index: 1 },
            },
            cards,
            allBuckets,
            visibleBuckets: allBuckets,
        });
        expect(move.orderedIds).toEqual(['a', 'x', 'b']);
        expect(move.changedColumn).toBe(true);
    });

    /**
     * The whole reason resolveDrop exists. With `b` filtered out, dropping into
     * the second visible slot means "after `a`" - and `a` is followed by the
     * hidden `b` in the real column, so the card belongs at real index 1 with
     * `b` still in the order behind it.
     */
    it('translates a visible slot into a real one when a filter is hiding cards', () => {
        const visibleBuckets = group(cards.filter((c) => c.id !== 'b'));
        const move = resolveDrop({
            payload: {
                cardId: 'x',
                from: { columnId: 'doing', laneId: NO_LANE, index: 0 },
                to: { columnId: 'todo', laneId: NO_LANE, index: 1 },
            },
            cards,
            allBuckets,
            visibleBuckets,
        });
        expect(move.to.index).toBe(1);
        expect(move.orderedIds).toEqual(['a', 'x', 'b']);
    });

    it('keeps hidden cards in orderedIds when dropping at the visible top', () => {
        const visibleBuckets = group(cards.filter((c) => c.id !== 'a'));
        const move = resolveDrop({
            payload: {
                cardId: 'x',
                from: { columnId: 'doing', laneId: NO_LANE, index: 0 },
                to: { columnId: 'todo', laneId: NO_LANE, index: 0 },
            },
            cards,
            allBuckets,
            visibleBuckets,
        });
        expect(move.orderedIds).toEqual(['x', 'a', 'b']);
    });

    it('returns null for a card it cannot find', () => {
        const move = resolveDrop({
            payload: {
                cardId: 'ghost',
                from: { columnId: 'todo', laneId: NO_LANE, index: 0 },
                to: { columnId: 'doing', laneId: NO_LANE, index: 0 },
            },
            cards,
            allBuckets,
            visibleBuckets: allBuckets,
        });
        expect(move).toBe(null);
    });
});

describe('resolveMenuMove', () => {
    const cards = make([
        { id: 'a', columnId: 'todo', position: 0 },
        { id: 'x', columnId: 'doing', position: 0 },
    ]);
    const allBuckets = group(cards);

    it('appends to the end of the chosen stage', () => {
        const move = resolveMenuMove({ card: cards[1], patch: { columnId: 'todo' }, allBuckets });
        expect(move.orderedIds).toEqual(['a', 'x']);
        expect(move.beforeId).toBe('a');
    });

    it('returns null when the chosen stage is the one it is already in', () => {
        expect(resolveMenuMove({ card: cards[0], patch: { columnId: 'todo' }, allBuckets })).toBe(null);
    });
});

describe('the optimistic layer', () => {
    const cards = make([
        { id: 'a', columnId: 'todo', position: 0 },
        { id: 'b', columnId: 'todo', position: 1 },
    ]);
    const move = {
        cardId: 'a',
        to: { columnId: 'doing', laneId: NO_LANE, index: 0 },
        orderedIds: ['a'],
    };

    it('moves the card without touching the array it was given', () => {
        const { cards: next } = applyPending(cards, [move]);
        expect(next.find((c) => c.id === 'a').columnId).toBe('doing');
        expect(cards.find((c) => c.id === 'a').columnId).toBe('todo');
    });

    it('is a no-op with nothing pending', () => {
        expect(applyPending(cards, []).cards).toBe(cards);
    });

    it('settles once the incoming data agrees, and not before', () => {
        expect(isSettled(move, cards)).toBe(false);
        const server = make([{ id: 'a', columnId: 'doing' }, { id: 'b', columnId: 'todo' }]);
        expect(isSettled(move, server)).toBe(true);
    });

    it('settles a card that has been deleted, rather than holding the override forever', () => {
        expect(isSettled(move, make([{ id: 'b', columnId: 'todo' }]))).toBe(true);
    });

    it('applyOrder puts the named ids first and leaves the rest behind them', () => {
        const buckets = group(make([
            { id: 'a', columnId: 'todo', position: 0 },
            { id: 'b', columnId: 'todo', position: 1 },
            { id: 'c', columnId: 'todo', position: 2 },
        ]));
        applyOrder(buckets, new Map([[bucketKey(NO_LANE, 'todo'), ['c', 'a']]]));
        expect(buckets.get(bucketKey(NO_LANE, 'todo')).map((x) => x.id)).toEqual(['c', 'a', 'b']);
    });
});
