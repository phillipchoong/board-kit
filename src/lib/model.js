/**
 * The board's data model. Pure functions only - no Vue, no DOM.
 *
 * Everything the board shows is derived here, so the same rules apply to the
 * pipeline view and the list view without either re-implementing them. That is
 * the whole reason this file exists: a card hidden by a filter must be hidden
 * in both views, and a count in a column header must be the count of the cards
 * actually rendered under it.
 */

/** Cards and columns may key on numbers or strings. Compare as strings. */
export const idOf = (value) => (value === null || value === undefined ? '' : String(value));

/** The bucket a card lives in: one lane crossed with one column. */
export const bucketKey = (laneId, columnId) => `${idOf(laneId)}::${idOf(columnId)}`;

export const NO_LANE = '__bk_all__';

function toText(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map(toText).join(' ');
    if (typeof value === 'object') return Object.values(value).map(toText).join(' ');
    return String(value);
}

/**
 * Column shape. `limit` is the WIP limit - the number of cards this stage is
 * allowed to hold at once. It is advisory by default; see the `limitMode` prop
 * on BoardView.
 */
export function normaliseColumns(columns) {
    return (columns ?? []).map((column, index) => ({
        id: idOf(column.id ?? index),
        title: column.title ?? column.label ?? String(column.id ?? index),
        description: column.description ?? null,
        tone: column.tone ?? 'neutral',
        limit: Number.isFinite(column.limit) ? column.limit : null,
        collapsible: column.collapsible !== false,
        droppable: column.droppable !== false,
        raw: column,
    }));
}

/**
 * Lanes are optional. With none, the board renders a single implicit lane and
 * never shows a lane header - the plain Trello layout.
 */
export function normaliseLanes(lanes) {
    if (!lanes || lanes.length === 0) {
        return [{ id: NO_LANE, title: null, description: null, implicit: true, collapsible: false, raw: null }];
    }
    return lanes.map((lane, index) => ({
        id: idOf(lane.id ?? index),
        title: lane.title ?? lane.label ?? String(lane.id ?? index),
        description: lane.description ?? null,
        collapsible: lane.collapsible !== false,
        implicit: false,
        raw: lane,
    }));
}

export function normaliseCards(cards, { hasLanes } = {}) {
    return (cards ?? []).map((card, index) => ({
        id: idOf(card.id ?? index),
        columnId: idOf(card.columnId ?? card.column ?? card.stage ?? card.status),
        laneId: hasLanes ? idOf(card.laneId ?? card.lane ?? '') : NO_LANE,
        position: Number.isFinite(card.position) ? card.position : null,
        title: card.title ?? '',
        subtitle: card.subtitle ?? null,
        summary: card.summary ?? null,
        badges: card.badges ?? [],
        tags: card.tags ?? [],
        meta: card.meta ?? {},
        updatedAt: card.updatedAt ?? null,
        href: card.href ?? null,
        draggable: card.draggable !== false,
        seq: index,
        raw: card,
    }));
}

/** Read a filter/sort value off a card, checking `meta` before the card itself. */
export function cardValue(card, key) {
    if (!card) return undefined;
    if (card.meta && key in card.meta) return card.meta[key];
    if (key in card) return card[key];
    return card.raw ? card.raw[key] : undefined;
}

export function matchesQuery(card, query) {
    const needle = String(query ?? '').trim().toLowerCase();
    if (!needle) return true;
    const haystack = [
        card.title,
        card.subtitle,
        card.summary,
        toText(card.tags),
        toText(card.badges),
        toText(card.meta),
        card.raw && card.raw.searchText,
    ]
        .map(toText)
        .join(' ')
        .toLowerCase();
    return needle
        .split(' ')
        .filter(Boolean)
        .every((word) => haystack.includes(word));
}

/**
 * `active` is `{ filterKey: value | value[] }`. An empty array or a nullish
 * value means the filter is off - never "match nothing", which would leave a
 * user staring at an empty board with no idea why.
 */
export function matchesFilters(card, active) {
    if (!active) return true;
    return Object.entries(active).every(([key, wanted]) => {
        const list = Array.isArray(wanted) ? wanted : [wanted];
        const chosen = list.filter((v) => v !== null && v !== undefined && v !== '');
        if (chosen.length === 0) return true;
        const value = cardValue(card, key);
        const has = Array.isArray(value) ? value.map(idOf) : [idOf(value)];
        return chosen.some((want) => has.includes(idOf(want)));
    });
}

export function filterCards(cards, { query = '', filters = null } = {}) {
    return cards.filter((card) => matchesQuery(card, query) && matchesFilters(card, filters));
}

/** Position first, then original array order. Stable and total. */
export function byPosition(a, b) {
    const ap = a.position;
    const bp = b.position;
    if (ap !== null && bp !== null && ap !== bp) return ap - bp;
    if (ap !== null && bp === null) return -1;
    if (ap === null && bp !== null) return 1;
    return a.seq - b.seq;
}

/**
 * Group cards into lane-by-column buckets, each internally ordered.
 *
 * Cards whose columnId matches no column are returned separately rather than
 * silently vanishing - an unknown stage is a data bug worth surfacing, not
 * something to hide. A card whose laneId matches no lane falls into the first
 * lane, because losing it entirely is worse than putting it in the wrong row.
 */
export function groupCards(cards, columns, lanes) {
    const buckets = new Map();
    const columnIds = new Set(columns.map((c) => c.id));
    const laneIds = new Set(lanes.map((l) => l.id));
    const orphans = [];

    for (const lane of lanes) {
        for (const column of columns) {
            buckets.set(bucketKey(lane.id, column.id), []);
        }
    }

    for (const card of cards) {
        if (!columnIds.has(card.columnId)) {
            orphans.push(card);
            continue;
        }
        const laneId = laneIds.has(card.laneId) ? card.laneId : lanes[0].id;
        buckets.get(bucketKey(laneId, card.columnId)).push(card);
    }

    for (const list of buckets.values()) list.sort(byPosition);

    return { buckets, orphans };
}

/** How a column stands against its WIP limit. A null limit is always 'ok'. */
export function limitState(count, limit) {
    if (!Number.isFinite(limit) || limit <= 0) return 'ok';
    if (count > limit) return 'over';
    if (count === limit) return 'full';
    return 'ok';
}

/* ---------------------------------------------------------------- list view */

export const DEFAULT_SORT_ACCESSORS = {
    column: (card, ctx) => (ctx && ctx.columnTitle ? ctx.columnTitle(card.columnId) : card.columnId),
    lane: (card, ctx) => (ctx && ctx.laneTitle ? ctx.laneTitle(card.laneId) : card.laneId),
    title: (card) => card.title,
    subtitle: (card) => card.subtitle,
    updatedAt: (card) => card.updatedAt,
    position: (card) => card.position,
};

const isEmpty = (value) => value === null || value === undefined || value === '';

function compareValues(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Sort for the list view. Empty values always sink to the bottom whichever way
 * the arrow points - flipping it should reorder the rows that have a value, not
 * fill the top of the table with blanks.
 */
export function sortCards(cards, key, dir, ctx) {
    const accessors = (ctx && ctx.accessors) || {};
    const get = accessors[key] || DEFAULT_SORT_ACCESSORS[key] || ((card) => cardValue(card, key));
    const sign = dir === 'asc' ? 1 : -1;
    return [...cards].sort((a, b) => {
        const av = get(a, ctx);
        const bv = get(b, ctx);
        // Outside the sign, deliberately. Multiplying this by the direction is
        // what floats every blank row to the top the moment you flip the arrow.
        if (isEmpty(av) || isEmpty(bv)) {
            if (isEmpty(av) && isEmpty(bv)) return a.seq - b.seq;
            return isEmpty(av) ? 1 : -1;
        }
        const result = compareValues(av, bv);
        if (result !== 0) return result * sign;
        return a.seq - b.seq;
    });
}
