import { describe, expect, it } from 'vitest';
import {
    NO_LANE,
    bucketKey,
    filterCards,
    groupCards,
    limitState,
    matchesFilters,
    matchesQuery,
    normaliseCards,
    normaliseColumns,
    normaliseLanes,
    sortCards,
} from '../src/lib/model.js';

const columns = normaliseColumns([
    { id: 'todo', title: 'To do' },
    { id: 'doing', title: 'Doing', limit: 2 },
    { id: 'done', title: 'Done' },
]);

const make = (cards, lanes = null) => normaliseCards(cards, { hasLanes: Boolean(lanes) });

describe('normalisation', () => {
    it('reads a stage from any of the four names a table might use', () => {
        const cards = make([
            { id: 1, columnId: 'todo' },
            { id: 2, column: 'todo' },
            { id: 3, stage: 'todo' },
            { id: 4, status: 'todo' },
        ]);
        expect(cards.map((c) => c.columnId)).toEqual(['todo', 'todo', 'todo', 'todo']);
    });

    it('keys on strings so a numeric id and its string match', () => {
        const [card] = make([{ id: 7, columnId: 'todo' }]);
        expect(card.id).toBe('7');
    });

    it('puts every card in one implicit lane when no lanes are given', () => {
        const cards = make([{ id: 1, columnId: 'todo', laneId: 'ignored' }]);
        expect(cards[0].laneId).toBe(NO_LANE);
        expect(normaliseLanes(null)).toHaveLength(1);
        expect(normaliseLanes([])[0].implicit).toBe(true);
    });

    it('keeps the original object on `raw` so callers get their own shape back', () => {
        const original = { id: 1, columnId: 'todo', customField: 'kept' };
        expect(make([original])[0].raw).toBe(original);
    });
});

describe('search', () => {
    const [card] = make([
        {
            id: 1,
            columnId: 'todo',
            title: 'Restore the nightly dump',
            subtitle: 'ops-console',
            meta: { owner: 'phillip' },
            tags: ['infra'],
        },
    ]);

    it('matches on the title, the subtitle, the tags and the meta', () => {
        for (const q of ['restore', 'ops-console', 'infra', 'phillip']) {
            expect(matchesQuery(card, q)).toBe(true);
        }
    });

    it('needs every word, not just one of them', () => {
        expect(matchesQuery(card, 'restore dump')).toBe(true);
        expect(matchesQuery(card, 'restore missing')).toBe(false);
    });

    it('treats an empty or whitespace query as no filter at all', () => {
        expect(matchesQuery(card, '')).toBe(true);
        expect(matchesQuery(card, '   ')).toBe(true);
        expect(matchesQuery(card, null)).toBe(true);
    });
});

describe('filters', () => {
    const cards = make([
        { id: 1, columnId: 'todo', meta: { priority: 'P1', tags: ['a', 'b'] } },
        { id: 2, columnId: 'todo', meta: { priority: 'P2', tags: ['b'] } },
    ]);

    it('an empty selection means the filter is off, never "match nothing"', () => {
        expect(filterCards(cards, { filters: { priority: [] } })).toHaveLength(2);
        expect(filterCards(cards, { filters: { priority: null } })).toHaveLength(2);
        expect(filterCards(cards, { filters: {} })).toHaveLength(2);
    });

    it('ORs within one filter and ANDs across filters', () => {
        expect(filterCards(cards, { filters: { priority: ['P1', 'P2'] } })).toHaveLength(2);
        expect(filterCards(cards, { filters: { priority: ['P1'], tags: ['b'] } })).toHaveLength(1);
        expect(filterCards(cards, { filters: { priority: ['P1'], tags: ['zzz'] } })).toHaveLength(0);
    });

    it('matches a card whose value is itself a list', () => {
        expect(matchesFilters(cards[0], { tags: ['a'] })).toBe(true);
        expect(matchesFilters(cards[1], { tags: ['a'] })).toBe(false);
    });
});

describe('grouping', () => {
    it('orders a bucket by position, and by input order where there is none', () => {
        const cards = make([
            { id: 'c', columnId: 'todo', position: 5 },
            { id: 'a', columnId: 'todo', position: 1 },
            { id: 'b', columnId: 'todo', position: 3 },
        ]);
        const { buckets } = groupCards(cards, columns, normaliseLanes(null));
        expect(buckets.get(bucketKey(NO_LANE, 'todo')).map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('reports cards in an unknown stage instead of dropping them silently', () => {
        const cards = make([
            { id: 1, columnId: 'todo' },
            { id: 2, columnId: 'archived' },
        ]);
        const { buckets, orphans } = groupCards(cards, columns, normaliseLanes(null));
        expect(orphans.map((c) => c.id)).toEqual(['2']);
        expect(buckets.get(bucketKey(NO_LANE, 'todo'))).toHaveLength(1);
    });

    it('puts a card with an unknown lane in the first lane rather than losing it', () => {
        const lanes = normaliseLanes([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }]);
        const cards = make([{ id: 1, columnId: 'todo', laneId: 'nope' }], lanes);
        const { buckets, orphans } = groupCards(cards, columns, lanes);
        expect(orphans).toHaveLength(0);
        expect(buckets.get(bucketKey('a', 'todo'))).toHaveLength(1);
    });

    it('creates an empty bucket for every lane and column pair', () => {
        const lanes = normaliseLanes([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }]);
        const { buckets } = groupCards([], columns, lanes);
        expect(buckets.size).toBe(6);
    });
});

describe('limitState', () => {
    it('is ok with no limit, whatever the count', () => {
        expect(limitState(99, null)).toBe('ok');
        expect(limitState(99, 0)).toBe('ok');
    });

    it('separates at-the-limit from over it', () => {
        expect(limitState(1, 2)).toBe('ok');
        expect(limitState(2, 2)).toBe('full');
        expect(limitState(3, 2)).toBe('over');
    });
});

describe('sortCards', () => {
    const cards = make([
        { id: 1, columnId: 'todo', title: 'Beta', updatedAt: '2026-01-02' },
        { id: 2, columnId: 'todo', title: 'alpha', updatedAt: null },
        { id: 3, columnId: 'todo', title: 'Gamma', updatedAt: '2026-01-01' },
    ]);

    it('sorts case-insensitively', () => {
        expect(sortCards(cards, 'title', 'asc', {}).map((c) => c.title)).toEqual(['alpha', 'Beta', 'Gamma']);
    });

    it('sinks empty values to the bottom in BOTH directions', () => {
        expect(sortCards(cards, 'updatedAt', 'asc', {}).map((c) => c.id)).toEqual(['3', '1', '2']);
        expect(sortCards(cards, 'updatedAt', 'desc', {}).map((c) => c.id)).toEqual(['1', '3', '2']);
    });

    it('does not mutate the array it was given', () => {
        const before = cards.map((c) => c.id);
        sortCards(cards, 'title', 'desc', {});
        expect(cards.map((c) => c.id)).toEqual(before);
    });
});
