import { describe, expect, it } from 'vitest';
import { normaliseCards } from '../src/lib/model.js';
import { cardSignature, describeChanges, diffSnapshots, snapshot } from '../src/lib/diff.js';
import { relativeAge, toMillis } from '../src/lib/time.js';

const make = (cards) => normaliseCards(cards, { hasLanes: false });

describe('cardSignature', () => {
    it('changes when something the card shows changes', () => {
        const [a] = make([{ id: 1, columnId: 'todo', title: 'One' }]);
        const [b] = make([{ id: 1, columnId: 'todo', title: 'Two' }]);
        expect(cardSignature(a)).not.toBe(cardSignature(b));
    });

    it('ignores fields the board never renders', () => {
        const [a] = make([{ id: 1, columnId: 'todo', title: 'One', sync_token: 'aaa' }]);
        const [b] = make([{ id: 1, columnId: 'todo', title: 'One', sync_token: 'zzz' }]);
        expect(cardSignature(a)).toBe(cardSignature(b));
    });

    it('does not treat a stage change as a content change', () => {
        const [a] = make([{ id: 1, columnId: 'todo', title: 'One' }]);
        const [b] = make([{ id: 1, columnId: 'doing', title: 'One' }]);
        expect(cardSignature(a)).toBe(cardSignature(b));
    });
});

describe('diffSnapshots', () => {
    const before = snapshot(make([
        { id: 1, columnId: 'todo', title: 'One' },
        { id: 2, columnId: 'todo', title: 'Two' },
        { id: 3, columnId: 'todo', title: 'Three' },
    ]));

    it('reports nothing at all on the first load', () => {
        expect(diffSnapshots(null, before).size).toBe(0);
    });

    it('separates added, moved and updated', () => {
        const after = snapshot(make([
            { id: 1, columnId: 'doing', title: 'One' },
            { id: 2, columnId: 'todo', title: 'Two, edited' },
            { id: 3, columnId: 'todo', title: 'Three' },
            { id: 4, columnId: 'todo', title: 'Four' },
        ]));
        const changes = diffSnapshots(before, after);
        expect(changes.get('1')).toBe('moved');
        expect(changes.get('2')).toBe('updated');
        expect(changes.has('3')).toBe(false);
        expect(changes.get('4')).toBe('added');
    });

    it('gives a card one kind only, most significant first', () => {
        const after = snapshot(make([
            { id: 1, columnId: 'doing', title: 'One, also renamed' },
            { id: 2, columnId: 'todo', title: 'Two' },
            { id: 3, columnId: 'todo', title: 'Three' },
        ]));
        expect(diffSnapshots(before, after).get('1')).toBe('moved');
    });

    it('skips the cards this user moved themselves', () => {
        const after = snapshot(make([
            { id: 1, columnId: 'doing', title: 'One' },
            { id: 2, columnId: 'todo', title: 'Two' },
            { id: 3, columnId: 'todo', title: 'Three' },
        ]));
        expect(diffSnapshots(before, after, new Set(['1'])).size).toBe(0);
    });

    it('counts a lane change as a move', () => {
        const withLanes = (cards) => snapshot(normaliseCards(cards, { hasLanes: true }));
        const a = withLanes([{ id: 1, columnId: 'todo', laneId: 'x' }]);
        const b = withLanes([{ id: 1, columnId: 'todo', laneId: 'y' }]);
        expect(diffSnapshots(a, b).get('1')).toBe('moved');
    });
});

describe('describeChanges', () => {
    it('is empty when nothing happened', () => {
        expect(describeChanges(new Map())).toBe('');
    });

    it('reads as a sentence, and counts removals it cannot highlight', () => {
        const changes = new Map([
            ['1', 'added'],
            ['2', 'moved'],
            ['3', 'updated'],
        ]);
        expect(describeChanges(changes, 1)).toBe('4 cards: 1 new, 1 moved, 1 updated, 1 removed');
    });

    it('says card, not cards, for one', () => {
        expect(describeChanges(new Map([['1', 'added']]))).toBe('1 card: 1 new');
    });
});

describe('relativeAge', () => {
    const now = Date.parse('2026-08-31T10:00:00Z');

    it('handles the shapes a prop might arrive as', () => {
        expect(toMillis('2026-08-31T10:00:00Z')).toBe(now);
        expect(toMillis(new Date(now))).toBe(now);
        expect(toMillis(now)).toBe(now);
        expect(toMillis(null)).toBe(null);
        expect(toMillis('not a date')).toBe(null);
    });

    it('steps through the units', () => {
        expect(relativeAge(now - 3000, now)).toBe('just now');
        expect(relativeAge(now - 42000, now)).toBe('42s ago');
        expect(relativeAge(now - 5 * 60000, now)).toBe('5m ago');
        expect(relativeAge(now - 3 * 3600000, now)).toBe('3h ago');
        expect(relativeAge(now - 4 * 86400000, now)).toBe('4d ago');
    });

    it('never reads as being in the future when a clock runs fast', () => {
        expect(relativeAge(now + 4000, now)).toBe('just now');
    });

    it('is null for no timestamp, so the toolbar can hide the line', () => {
        expect(relativeAge(null, now)).toBe(null);
    });
});
