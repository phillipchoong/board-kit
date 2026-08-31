<script setup>
/**
 * The list view - the same cards, the same filters, laid out to be read rather
 * than moved.
 *
 * A real table, not a stack of cards: on a phone a stage and a title is all
 * that fits, and the remaining columns drop out at their own breakpoints
 * instead of forcing everyone to scroll sideways to see a date. Each row keeps
 * the move menu, so the list is not a read-only view of the board.
 *
 * With swimlanes on, rows are grouped under their lane and sorted inside it.
 * Sorting across lanes would silently throw away the grouping the board is
 * built around.
 */
import { computed } from 'vue';
import BoardIcon from './BoardIcon.vue';
import BoardMoveMenu from './BoardMoveMenu.vue';
import { cardValue, sortCards } from '../lib/model.js';

const props = defineProps({
    cards: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    lanes: { type: Array, default: () => [] },
    listColumns: { type: Array, default: null },
    sortKey: { type: String, default: 'column' },
    sortDir: { type: String, default: 'asc' },
    groupByLane: { type: Boolean, default: true },
    showMenu: { type: Boolean, default: true },
    laneDraggable: { type: Boolean, default: true },
    formatUpdated: { type: Function, default: null },
    emptyText: { type: String, default: 'Nothing to show.' },
});

const emit = defineEmits(['update:sort', 'select', 'move']);

const columnTitle = (id) => props.columns.find((c) => c.id === id)?.title ?? id;
const laneTitle = (id) => props.lanes.find((l) => l.id === id)?.title ?? id;

const hasLanes = computed(() => props.lanes.some((lane) => !lane.implicit));

const DEFAULTS = computed(() => {
    const defs = [
        { key: 'column', label: 'Stage', width: '120px', sortable: true, get: (card) => columnTitle(card.columnId) },
        { key: 'title', label: 'Card', sortable: true, get: (card) => card.title },
        { key: 'subtitle', label: 'Detail', hide: 'sm', sortable: true, get: (card) => card.subtitle },
    ];
    if (hasLanes.value && !props.groupByLane) {
        defs.push({ key: 'lane', label: 'Lane', hide: 'md', sortable: true, get: (card) => laneTitle(card.laneId) });
    }
    defs.push({
        key: 'updatedAt',
        label: 'Updated',
        width: '110px',
        align: 'end',
        hide: 'sm',
        sortable: true,
        get: (card) => (props.formatUpdated ? props.formatUpdated(card.updatedAt) : card.updatedAt),
    });
    return defs;
});

const cols = computed(() => props.listColumns ?? DEFAULTS.value);
const colspan = computed(() => cols.value.length + (props.showMenu ? 1 : 0));

const ctx = computed(() => ({
    columnTitle,
    laneTitle,
    accessors: Object.fromEntries(cols.value.filter((c) => c.sortAccessor).map((c) => [c.key, c.sortAccessor])),
}));

const groups = computed(() => {
    if (!hasLanes.value || !props.groupByLane) {
        return [{ lane: null, rows: sortCards(props.cards, props.sortKey, props.sortDir, ctx.value) }];
    }
    return props.lanes
        .map((lane) => ({
            lane,
            rows: sortCards(
                props.cards.filter((card) => card.laneId === lane.id),
                props.sortKey,
                props.sortDir,
                ctx.value,
            ),
        }))
        .filter((group) => group.rows.length > 0);
});

const total = computed(() => groups.value.reduce((sum, group) => sum + group.rows.length, 0));

function toggleSort(col) {
    if (!col.sortable) return;
    const dir = col.key === props.sortKey && props.sortDir === 'asc' ? 'desc' : 'asc';
    emit('update:sort', { key: col.key, dir });
}

const ariaSort = (col) => {
    if (col.key !== props.sortKey) return 'none';
    return props.sortDir === 'asc' ? 'ascending' : 'descending';
};

const cellValue = (col, card) => (col.get ? col.get(card) : cardValue(card, col.key));
const hideClass = (col) => (col.hide ? `bk-hide-${col.hide}` : null);
</script>

<template>
    <div class="bk-listwrap">
        <table class="bk-table">
            <thead>
                <tr>
                    <th
                        v-for="col in cols"
                        :key="col.key"
                        scope="col"
                        :class="[hideClass(col), col.align === 'end' ? 'bk-end' : null]"
                        :style="col.width ? { width: col.width } : null"
                        :aria-sort="ariaSort(col)"
                    >
                        <button v-if="col.sortable" type="button" class="bk-sort" @click="toggleSort(col)">
                            {{ col.label }}
                            <BoardIcon
                                v-if="col.key === sortKey"
                                :name="sortDir === 'asc' ? 'arrow-up' : 'arrow-down'"
                                :size="12"
                            />
                        </button>
                        <span v-else>{{ col.label }}</span>
                    </th>
                    <th v-if="showMenu" scope="col" class="bk-end">
                        <span class="bk-sr">Actions</span>
                    </th>
                </tr>
            </thead>

            <tbody>
                <template v-for="group in groups" :key="group.lane ? group.lane.id : 'all'">
                    <tr v-if="group.lane" class="bk-group">
                        <th :colspan="colspan" scope="colgroup">
                            {{ group.lane.title }}
                            <span class="bk-group-count">{{ group.rows.length }}</span>
                        </th>
                    </tr>

                    <tr
                        v-for="card in group.rows"
                        :key="card.id"
                        class="bk-row"
                        tabindex="0"
                        @click="emit('select', card)"
                        @keydown.enter.prevent="emit('select', card)"
                        @keydown.space.prevent="emit('select', card)"
                    >
                        <td
                            v-for="col in cols"
                            :key="col.key"
                            :class="[hideClass(col), col.align === 'end' ? 'bk-end' : null]"
                        >
                            <slot :name="`cell-${col.key}`" :card="card" :column="col" :value="cellValue(col, card)">
                                {{ cellValue(col, card) ?? '—' }}
                            </slot>
                        </td>
                        <td v-if="showMenu" class="bk-end bk-actions" @click.stop>
                            <BoardMoveMenu
                                :card="card"
                                :columns="columns"
                                :lanes="lanes"
                                :lane-draggable="laneDraggable"
                                @move="(patch) => emit('move', { card, patch })"
                            />
                        </td>
                    </tr>
                </template>

                <tr v-if="total === 0">
                    <td :colspan="colspan" class="bk-list-empty">{{ emptyText }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.bk-listwrap {
    overflow-x: auto;
    border: 1px solid var(--border-subtle, #e4e7ec);
    border-radius: var(--radius-md, 8px);
    background: var(--surface-card, #ffffff);
}

.bk-table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 8px 12px;
    border-block-end: 1px solid var(--border-subtle, #e4e7ec);
    background: var(--surface-sunken, #f9fafb);
    color: var(--text-muted, #667085);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    text-align: start;
    white-space: nowrap;
}

.bk-sort {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
}

.bk-sort:hover {
    color: var(--text-body, #344054);
}

tbody td {
    padding: 10px 12px;
    border-block-end: 1px solid var(--border-subtle, #e4e7ec);
    color: var(--text-body, #344054);
    vertical-align: top;
}

.bk-row {
    cursor: pointer;
}

.bk-row:hover td {
    background: var(--surface-hover, #f2f4f7);
}

.bk-row:focus-visible {
    outline: 2px solid var(--border-focus, #6172f3);
    outline-offset: -2px;
}

.bk-group th {
    padding: 8px 12px;
    border-block-end: 1px solid var(--border-subtle, #e4e7ec);
    background: var(--surface-sunken, #f9fafb);
    color: var(--text-strong, #101828);
    font-size: 12px;
    font-weight: 700;
    text-align: start;
}

.bk-group-count {
    margin-inline-start: 6px;
    padding: 0 6px;
    border-radius: var(--radius-pill, 999px);
    background: var(--neutral-bg, #f2f4f7);
    color: var(--neutral-600, #475467);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
}

.bk-end {
    text-align: end;
}

.bk-actions {
    inline-size: 44px;
}

.bk-actions :deep(.bk-popover-root) {
    justify-content: flex-end;
}

.bk-list-empty {
    padding: 28px 12px;
    text-align: center;
    color: var(--text-faint, #98a2b3);
}

.bk-sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}

@media (max-width: 639px) {
    .bk-hide-sm {
        display: none;
    }
}

@media (max-width: 767px) {
    .bk-hide-md {
        display: none;
    }
}
</style>
