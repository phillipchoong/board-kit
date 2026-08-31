<script setup>
/**
 * The board. One component, two views, no server knowledge.
 *
 * WHAT IT OWNS: which view is showing, what is filtered, which columns and
 * lanes are collapsed, and where a card appears to be while a save is in
 * flight. WHAT IT DOES NOT OWN: your data. It never mutates the `cards` prop -
 * a drop emits `move` and the props remain the truth.
 *
 * THE OPTIMISTIC LAYER is why a move is not just an event. The card has to
 * appear in its new column immediately, then either stay there (the server
 * agreed, and the next `cards` prop says so) or snap back. So a pending move is
 * held here and dropped again the moment the incoming props already agree with
 * it - which means a caller who reloads their data after saving never has to
 * call anything back. `revert()` is for the failure path.
 *
 * FILTERS AND ORDER ARE THE SUBTLE BIT. Sortable reports the index among the
 * cards it can see, and a filtered column is not showing all of them. Dropping
 * into slot 2 of a filtered column means "after the second visible card", not
 * "second in the stage", so the drop is translated back to a position in the
 * full list before anything is emitted. Without that translation `orderedIds`
 * would quietly tell the server to delete the order of every hidden card.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useSlots, watch } from 'vue';
import BoardToolbar from './BoardToolbar.vue';
import BoardPipeline from './BoardPipeline.vue';
import BoardListView from './BoardListView.vue';
import BoardIcon from './BoardIcon.vue';
import BoardCardDrawer from './BoardCardDrawer.vue';
import { usePersistentState } from '../composables/usePersistentState.js';
import { useChangeFlash } from '../composables/useChangeFlash.js';
import { cardValue, filterCards, groupCards, idOf, normaliseCards, normaliseColumns, normaliseLanes } from '../lib/model.js';
import { applyOrder, applyPending, isSettled, resolveDrop, resolveMenuMove } from '../lib/move.js';

const props = defineProps({
    /** `[{ id, title, tone?, limit?, collapsible?, droppable? }]` */
    columns: { type: Array, required: true },
    /** `[{ id, columnId, laneId?, position?, title, subtitle?, badges?, tags?, meta?, updatedAt?, href? }]` */
    cards: { type: Array, default: () => [] },
    /** `[{ id, title, description? }]`. Omit for a plain board with no rows. */
    lanes: { type: Array, default: null },
    /** `[{ key, label, multiple?, options: [{ value, label }] }]` */
    filters: { type: Array, default: () => [] },

    /** Remembers view, sort and collapse state per board. Omit to remember nothing. */
    storageKey: { type: String, default: null },

    draggable: { type: Boolean, default: true },
    laneDraggable: { type: Boolean, default: true },
    /** 'warn' shows an over-limit column in red; 'block' also refuses the drop. */
    limitMode: { type: String, default: 'warn' },
    /** true, false, or 'auto' - fit when there are few enough columns to read. */
    fit: { type: [Boolean, String], default: 'auto' },
    fitMaxColumns: { type: Number, default: 7 },
    /** 'auto' grows with the page; 'fill' takes the parent's height and scrolls the cards. */
    height: { type: String, default: 'auto' },
    /** Page gutter to bleed into on small screens, e.g. '1rem'. */
    bleed: { type: String, default: null },
    columnWidth: { type: String, default: null },

    optimistic: { type: Boolean, default: true },
    showToolbar: { type: Boolean, default: true },
    showSearch: { type: Boolean, default: true },
    showViewToggle: { type: Boolean, default: true },
    showCardMenu: { type: Boolean, default: true },
    showDragHandle: { type: Boolean, default: false },
    groupListByLane: { type: Boolean, default: true },
    /** Open a card into a drawer instead of only emitting `select`. */
    drawer: { type: Boolean, default: false },

    /* ---- live updates ---- */
    /** When this data was fetched. Shows a live-ticking "Updated 40s ago". */
    updatedAt: { type: [String, Number, Date], default: null },
    /** True while a refresh is in flight. Spins the refresh button. */
    refreshing: { type: Boolean, default: false },
    /** Show a refresh button that emits `refresh`. */
    showRefresh: { type: Boolean, default: false },
    /** Briefly highlight cards that changed since the last load. */
    highlightChanges: { type: Boolean, default: true },
    /** How long a highlight lasts, in ms. */
    flashDuration: { type: Number, default: 1600 },
    listColumns: { type: Array, default: null },
    formatUpdated: { type: Function, default: null },
    searchPlaceholder: { type: String, default: 'Search cards' },
    emptyText: { type: String, default: 'Nothing here' },
    /** How long a finger must rest on a card before it lifts, in ms. */
    touchDelay: { type: Number, default: 350 },
});

const emit = defineEmits(['move', 'select', 'refresh']);

const view = defineModel('view', { type: String, default: 'board' });
const query = defineModel('query', { type: String, default: '' });
const activeFilters = defineModel('activeFilters', { type: Object, default: () => ({}) });
const sort = defineModel('sort', { type: Object, default: () => ({ key: 'column', dir: 'asc' }) });

const slots = useSlots();

/* ------------------------------------------------------------ persisted UI */

const key = (suffix) => (props.storageKey ? `board-kit:${props.storageKey}:${suffix}` : null);

const storedView = usePersistentState(key('view'), null, {
    validate: (v) => v === 'board' || v === 'list',
});
const storedSort = usePersistentState(key('sort'), null, {
    validate: (v) => v && typeof v.key === 'string' && (v.dir === 'asc' || v.dir === 'desc'),
});
const collapsedColumns = usePersistentState(key('cols'), [], { validate: Array.isArray });
const collapsedLanes = usePersistentState(key('lanes'), [], { validate: Array.isArray });

// usePersistentState reads in its own onMounted, registered above this one, so
// by the time this runs the stored values are already in.
onMounted(() => {
    if (storedView.value) view.value = storedView.value;
    if (storedSort.value) sort.value = storedSort.value;
});
watch(view, (v) => {
    storedView.value = v;
});
watch(sort, (v) => {
    storedSort.value = v;
});

/* ---------------------------------------------------------------- the data */

const hasLanes = computed(() => Array.isArray(props.lanes) && props.lanes.length > 0);
const columnDefs = computed(() => normaliseColumns(props.columns));
const laneDefs = computed(() => normaliseLanes(props.lanes));
const allCards = computed(() => normaliseCards(props.cards, { hasLanes: hasLanes.value }));

/**
 * Moves the user has made that the props have not caught up with yet.
 *
 * `shallowRef` and a token, not object identity: a deep `ref` hands back a
 * PROXY of what was put in, so `entry !== theOriginal` and a revert would
 * silently filter nothing out - the card would stay in its new column forever
 * after a failed save.
 */
const pending = shallowRef([]);
let moveToken = 0;

const patched = computed(() => (props.optimistic ? applyPending(allCards.value, pending.value) : { cards: allCards.value, order: new Map() }));

const visibleCards = computed(() =>
    filterCards(patched.value.cards, { query: query.value, filters: activeFilters.value }),
);

/** Every card, grouped. The source of truth for indexes and order on a drop. */
const groupedAll = computed(() => {
    const grouped = groupCards(patched.value.cards, columnDefs.value, laneDefs.value);
    applyOrder(grouped.buckets, patched.value.order);
    return grouped;
});

/** What is on screen. Same grouping, minus whatever search and filters hide. */
const groupedVisible = computed(() => {
    const grouped = groupCards(visibleCards.value, columnDefs.value, laneDefs.value);
    applyOrder(grouped.buckets, patched.value.order);
    return grouped;
});

const columnCounts = computed(() => countBy(visibleCards.value, (card) => card.columnId));
const columnTotals = computed(() => countBy(patched.value.cards, (card) => card.columnId));
const laneCounts = computed(() => countBy(visibleCards.value, (card) => card.laneId));

function countBy(list, pick) {
    const out = {};
    for (const item of list) {
        const k = pick(item);
        out[k] = (out[k] ?? 0) + 1;
    }
    return out;
}

/**
 * Option counts, each measured with every OTHER filter applied. A count that
 * ignored the rest of the filters would promise rows that are not there.
 */
const filterCounts = computed(() => {
    const out = {};
    for (const filter of props.filters) {
        const others = { ...activeFilters.value };
        delete others[filter.key];
        const pool = filterCards(patched.value.cards, { query: query.value, filters: others });
        const counts = {};
        for (const card of pool) {
            const value = cardValue(card, filter.key);
            for (const item of Array.isArray(value) ? value : [value]) {
                const k = idOf(item);
                counts[k] = (counts[k] ?? 0) + 1;
            }
        }
        out[filter.key] = counts;
    }
    return out;
});

/* ----------------------------------------------------------- live updates */

/**
 * Cards THIS user just moved.
 *
 * When the save lands and the data comes back, that card has "changed" - but it
 * changed because they moved it, and lighting it up teaches people to ignore
 * the highlight. Entries expire on their own so a card is only exempt for as
 * long as a round trip plausibly takes.
 */
const localMoves = ref(new Set());
const localTimers = new Map();
const LOCAL_GRACE_MS = 8000;

function markLocal(id) {
    if (localTimers.has(id)) clearTimeout(localTimers.get(id));
    const next = new Set(localMoves.value);
    next.add(id);
    localMoves.value = next;
    localTimers.set(
        id,
        setTimeout(() => {
            localTimers.delete(id);
            const after = new Set(localMoves.value);
            after.delete(id);
            localMoves.value = after;
        }, LOCAL_GRACE_MS),
    );
}

onBeforeUnmount(() => {
    for (const timer of localTimers.values()) clearTimeout(timer);
    localTimers.clear();
});

// Watched against the RAW props, not the optimistic view: an override the user
// created is not a change that arrived from anywhere.
const { flashes, summary: changeSummary } = useChangeFlash(allCards, {
    duration: props.flashDuration,
    ignoreIds: localMoves,
});

const activeFlashes = computed(() => (props.highlightChanges ? flashes.value : new Map()));

/* ------------------------------------------------------------------ layout */

const resolvedFit = computed(() =>
    props.fit === 'auto' ? columnDefs.value.length <= props.fitMaxColumns : Boolean(props.fit),
);
const fill = computed(() => props.height === 'fill');

const rootStyle = computed(() => {
    const style = {};
    if (props.bleed) style['--bk-bleed'] = props.bleed;
    if (props.columnWidth) style['--bk-col-width'] = props.columnWidth;
    return style;
});

// One Sortable group per board instance, so two boards on one page cannot drag
// cards into each other.
const groupName = `bk-${Math.random().toString(36).slice(2, 9)}`;

/* ------------------------------------------------------------------- moves */

const announcement = ref('');
const columnTitle = (id) => columnDefs.value.find((c) => c.id === id)?.title ?? id;

function accepts(column, lane, dragEl, fromEl) {
    if (!props.laneDraggable && fromEl?.dataset?.bkLane !== lane.id) return false;
    if (props.limitMode !== 'block') return true;
    if (!Number.isFinite(column.limit)) return true;
    // Reordering inside a column that is already at its limit is not a new
    // arrival, so it is never blocked.
    if (fromEl?.dataset?.bkColumn === column.id) return true;
    return (columnTotals.value[column.id] ?? 0) < column.limit;
}

function onDrop(payload) {
    const move = resolveDrop({
        payload,
        cards: patched.value.cards,
        allBuckets: groupedAll.value.buckets,
        visibleBuckets: groupedVisible.value.buckets,
    });
    if (!move) return;
    commit(move, patched.value.cards.find((c) => c.id === move.cardId));
}

/** The menu path: pick a stage, land at the end of it. */
function onMenuMove({ card, patch }) {
    const move = resolveMenuMove({ card, patch, allBuckets: groupedAll.value.buckets });
    if (!move) return;
    commit(move, card);
}

function commit(move, card) {
    const token = ++moveToken;
    if (props.optimistic) {
        pending.value = [...pending.value.filter((m) => m.cardId !== move.cardId), { ...move, token }];
    }

    markLocal(move.cardId);
    announcement.value = `Moved ${card?.title || 'card'} to ${columnTitle(move.to.columnId)}`;

    const drop = () => {
        pending.value = pending.value.filter((m) => m.token !== token);
    };

    emit('move', {
        ...move,
        /** Call on failure. The card returns to where it came from. */
        revert: drop,
        /** Optional. The override also clears itself once the props agree. */
        confirm: drop,
    });
}

// Remote changes speak through the same live region as local moves, so a screen
// reader gets one running commentary rather than two competing ones.
watch(changeSummary, (value) => {
    if (props.highlightChanges && value) announcement.value = value;
});

// An override outlives its usefulness the moment the incoming data agrees with
// it. Pruning here is what lets a caller just refetch and never call back.
watch(
    allCards,
    (cards) => {
        if (pending.value.length === 0) return;
        const kept = pending.value.filter((move) => !isSettled(move, cards));
        if (kept.length !== pending.value.length) pending.value = kept;
    },
    { deep: false },
);

/* ------------------------------------------------------------------- misc. */

function toggleColumn(id) {
    collapsedColumns.value = collapsedColumns.value.includes(id)
        ? collapsedColumns.value.filter((c) => c !== id)
        : [...collapsedColumns.value, id];
}

function toggleLane(id) {
    collapsedLanes.value = collapsedLanes.value.includes(id)
        ? collapsedLanes.value.filter((l) => l !== id)
        : [...collapsedLanes.value, id];
}

/**
 * The drawer follows the card, it does not copy it.
 *
 * Holding the id and looking the card up again on every render is what keeps an
 * open drawer correct while the board moves underneath it: move the card from
 * inside the drawer and the header updates, and a card that disappears from the
 * data closes the drawer instead of leaving a stale copy on screen.
 */
const activeCardId = ref(null);
const activeCard = computed(() =>
    activeCardId.value === null ? null : (patched.value.cards.find((c) => c.id === activeCardId.value) ?? null),
);
const drawerOpen = computed({
    get: () => props.drawer && activeCard.value !== null,
    set: (value) => {
        if (!value) activeCardId.value = null;
    },
});

function onSelect(card) {
    if (props.drawer) activeCardId.value = card.id;
    emit('select', card.raw ?? card);
}

const listCellSlots = computed(() => Object.keys(slots).filter((name) => name.startsWith('cell-')));

const orphans = computed(() => groupedAll.value.orphans);
const orphanStages = computed(() => [...new Set(orphans.value.map((c) => c.columnId || '(empty)'))].join(', '));
</script>

<template>
    <section class="bk-board" :class="{ 'bk-board--fill': fill }" :style="rootStyle">
        <BoardToolbar
            v-if="showToolbar"
            v-model:view="view"
            v-model:query="query"
            v-model:activeFilters="activeFilters"
            :filters="filters"
            :filter-counts="filterCounts"
            :show-search="showSearch"
            :show-view-toggle="showViewToggle"
            :search-placeholder="searchPlaceholder"
            :visible-count="visibleCards.length"
            :total-count="patched.cards.length"
            :updated-at="updatedAt"
            :refreshing="refreshing"
            :show-refresh="showRefresh"
            @refresh="emit('refresh')"
        >
            <template v-if="slots.actions" #actions><slot name="actions" /></template>
        </BoardToolbar>

        <p v-if="orphans.length" class="bk-orphans">
            <BoardIcon name="alert" :size="14" />
            {{ orphans.length }} {{ orphans.length === 1 ? 'card is' : 'cards are' }} in a stage this board does not
            have ({{ orphanStages }}), so {{ orphans.length === 1 ? 'it is' : 'they are' }} not shown.
        </p>

        <BoardPipeline
            v-if="view === 'board'"
            :columns="columnDefs"
            :lanes="laneDefs"
            :buckets="groupedVisible.buckets"
            :column-counts="columnCounts"
            :column-totals="columnTotals"
            :lane-counts="laneCounts"
            :collapsed-columns="collapsedColumns"
            :collapsed-lanes="collapsedLanes"
            :group="groupName"
            :drag-enabled="draggable"
            :accepts="accepts"
            :fit="resolvedFit"
            :fill="fill"
            :lane-draggable="laneDraggable"
            :show-handle="showDragHandle"
            :show-menu="showCardMenu"
            :empty-text="emptyText"
            :format-updated="formatUpdated"
            :touch-delay="touchDelay"
            :flashes="activeFlashes"
            @drop="onDrop"
            @select="onSelect"
            @move="onMenuMove"
            @toggle-column="toggleColumn"
            @toggle-lane="toggleLane"
        >
            <template v-if="slots.card" #card="slotProps"><slot name="card" v-bind="slotProps" /></template>
            <template v-if="slots['card-title']" #card-title="slotProps">
                <slot name="card-title" v-bind="slotProps" />
            </template>
        </BoardPipeline>

        <BoardListView
            v-else
            :cards="visibleCards"
            :columns="columnDefs"
            :lanes="laneDefs"
            :list-columns="listColumns"
            :sort-key="sort.key"
            :sort-dir="sort.dir"
            :group-by-lane="groupListByLane"
            :show-menu="showCardMenu"
            :lane-draggable="laneDraggable"
            :format-updated="formatUpdated"
            :flashes="activeFlashes"
            @update:sort="(next) => (sort = next)"
            @select="onSelect"
            @move="onMenuMove"
        >
            <!-- Only the per-cell slots travel through. Forwarding every slot
                 would hand the table a `card` slot it has no cell to put. -->
            <template v-for="name in listCellSlots" #[name]="slotProps">
                <slot :name="name" v-bind="slotProps" />
            </template>
        </BoardListView>

        <BoardCardDrawer
            v-if="drawer"
            v-model:open="drawerOpen"
            :card="activeCard"
            :title="activeCard?.title ?? ''"
            :subtitle="activeCard?.subtitle ?? null"
            :columns="columnDefs"
            :lanes="laneDefs"
            :lane-draggable="laneDraggable"
            :show-menu="showCardMenu"
            @move="(patch) => activeCard && onMenuMove({ card: activeCard, patch })"
        >
            <template v-if="slots['drawer-title']" #title>
                <slot name="drawer-title" :card="activeCard" />
            </template>
            <template v-if="slots['drawer-actions']" #actions>
                <slot name="drawer-actions" :card="activeCard" :close="() => (activeCardId = null)" />
            </template>
            <template v-if="slots['drawer-footer']" #footer>
                <slot name="drawer-footer" :card="activeCard" :close="() => (activeCardId = null)" />
            </template>

            <slot v-if="activeCard" name="drawer" :card="activeCard" :close="() => (activeCardId = null)">
                <!-- A useful default, so `drawer` on its own already shows
                     something rather than an empty panel. -->
                <dl class="bk-drawer-facts">
                    <div>
                        <dt>Stage</dt>
                        <dd>{{ columnTitle(activeCard.columnId) }}</dd>
                    </div>
                    <div v-if="!laneDefs[0].implicit">
                        <dt>Lane</dt>
                        <dd>{{ laneDefs.find((l) => l.id === activeCard.laneId)?.title ?? '—' }}</dd>
                    </div>
                    <div v-if="activeCard.summary">
                        <dt>Summary</dt>
                        <dd>{{ activeCard.summary }}</dd>
                    </div>
                    <div v-if="activeCard.updatedAt">
                        <dt>Updated</dt>
                        <dd>{{ formatUpdated ? formatUpdated(activeCard.updatedAt) : activeCard.updatedAt }}</dd>
                    </div>
                </dl>
            </slot>
        </BoardCardDrawer>

        <p class="bk-live" role="status" aria-live="polite">{{ announcement }}</p>
    </section>
</template>

<style scoped>
.bk-board {
    /* The whole layout contract, in one place. Override any of them from the
       host app - they are ordinary custom properties on this element. */
    --bk-col-width: 300px;
    --bk-col-collapsed: 48px;
    --bk-gap: 12px;
    --bk-bleed: 0px;
    --bk-board-bg: var(--surface-app, transparent);

    display: flex;
    flex-direction: column;
    min-inline-size: 0;
}

.bk-board--fill {
    min-block-size: 0;
    block-size: 100%;
}

.bk-board--fill > :deep(.bk-pipeline) {
    flex: 1;
    min-block-size: 0;
}

@media (max-width: 767px) {
    .bk-board {
        /* Just under a full screen, so the next stage peeks in and the board
           reads as scrollable without anyone having to guess. */
        --bk-col-width: 78vw;
        --bk-gap: 10px;
    }
}

.bk-drawer-facts {
    display: grid;
    gap: 12px;
    margin: 0;
}

.bk-drawer-facts dt {
    margin-block-end: 2px;
    color: var(--text-faint, #98a2b3);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.bk-drawer-facts dd {
    margin: 0;
    color: var(--text-body, #344054);
}

.bk-orphans {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 10px;
    padding: 8px 10px;
    border: 1px solid var(--warning-border, #fedf89);
    border-radius: var(--radius-md, 8px);
    background: var(--warning-bg, #fffaeb);
    color: var(--warning-700, #b54708);
    font-size: 12px;
}

/* Announcements are for screen readers; showing them would be a second, silent
   status line nobody asked for. */
.bk-live {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}
</style>
