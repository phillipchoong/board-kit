<script setup>
/**
 * Search, filters, and the board/list switch.
 *
 * The row wraps rather than scrolls, and the view switch is icon-plus-label so
 * it survives being the only thing left on a 360px line. When a filter or a
 * search is hiding cards, the count on the right says how many of how many are
 * showing - the answer to "where did everything go".
 */
import { computed } from 'vue';
import BoardIcon from './BoardIcon.vue';
import BoardFilterMenu from './BoardFilterMenu.vue';
import { useNow } from '../composables/useNow.js';
import { relativeAge } from '../lib/time.js';

const props = defineProps({
    view: { type: String, default: 'board' },
    query: { type: String, default: '' },
    filters: { type: Array, default: () => [] },
    activeFilters: { type: Object, default: () => ({}) },
    filterCounts: { type: Object, default: () => ({}) },
    showSearch: { type: Boolean, default: true },
    showViewToggle: { type: Boolean, default: true },
    searchPlaceholder: { type: String, default: 'Search cards' },
    visibleCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    /** When this data was fetched. Shown as a live-ticking "Updated 40s ago". */
    updatedAt: { type: [String, Number, Date], default: null },
    refreshing: { type: Boolean, default: false },
    showRefresh: { type: Boolean, default: false },
});

const emit = defineEmits(['update:view', 'update:query', 'update:activeFilters', 'refresh']);

const now = useNow();
const age = computed(() => relativeAge(props.updatedAt, now.value));

const activeCount = computed(() =>
    Object.values(props.activeFilters).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : value ? 1 : 0), 0),
);

const isFiltered = computed(() => activeCount.value > 0 || props.query.trim().length > 0);

function setFilter(key, values) {
    emit('update:activeFilters', { ...props.activeFilters, [key]: values });
}

function clearAll() {
    emit('update:query', '');
    emit('update:activeFilters', {});
}
</script>

<template>
    <div class="bk-toolbar">
        <div class="bk-toolbar-main">
            <div v-if="showSearch" class="bk-search">
                <BoardIcon name="search" :size="15" class="bk-search-icon" />
                <input
                    class="bk-search-input"
                    type="search"
                    :value="query"
                    :placeholder="searchPlaceholder"
                    :aria-label="searchPlaceholder"
                    @input="emit('update:query', $event.target.value)"
                />
            </div>

            <BoardFilterMenu
                v-for="filter in filters"
                :key="filter.key"
                :filter="filter"
                :selected="activeFilters[filter.key] ?? []"
                :counts="filterCounts[filter.key] ?? {}"
                @update="(values) => setFilter(filter.key, values)"
            />

            <button v-if="isFiltered" type="button" class="bk-clear" @click="clearAll">
                <BoardIcon name="x" :size="14" />
                Clear
            </button>
        </div>

        <div class="bk-toolbar-end">
            <p v-if="age" class="bk-age" :class="{ 'bk-age--busy': refreshing }">
                <span v-if="refreshing">Refreshing</span>
                <span v-else>Updated {{ age }}</span>
            </p>

            <button
                v-if="showRefresh"
                type="button"
                class="bk-refresh"
                :class="{ 'bk-refresh--busy': refreshing }"
                :disabled="refreshing"
                aria-label="Refresh the board"
                @click="emit('refresh')"
            >
                <BoardIcon name="refresh" :size="15" />
            </button>

            <p class="bk-count" aria-live="polite">
                <template v-if="isFiltered">{{ visibleCount }} of {{ totalCount }}</template>
                <template v-else>{{ totalCount }} {{ totalCount === 1 ? 'card' : 'cards' }}</template>
            </p>

            <slot name="actions" />

            <div v-if="showViewToggle" class="bk-view" role="group" aria-label="Board or list view">
                <button
                    type="button"
                    class="bk-view-btn"
                    :class="{ 'bk-view-btn--on': view === 'board' }"
                    :aria-pressed="view === 'board'"
                    @click="emit('update:view', 'board')"
                >
                    <BoardIcon name="columns" :size="14" />
                    <span class="bk-view-text">Board</span>
                </button>
                <button
                    type="button"
                    class="bk-view-btn"
                    :class="{ 'bk-view-btn--on': view === 'list' }"
                    :aria-pressed="view === 'list'"
                    @click="emit('update:view', 'list')"
                >
                    <BoardIcon name="list" :size="14" />
                    <span class="bk-view-text">List</span>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.bk-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-block-end: 12px;
}

/* The main group wraps INSIDE itself; the end group never moves.
   Without the flex basis below, adding a filter value or the Clear button grows
   the left side just enough to bump the view switch onto its own line, and the
   control you were about to press has moved. */
.bk-toolbar-main,
.bk-toolbar-end {
    display: flex;
    align-items: center;
    gap: 8px;
    min-inline-size: 0;
}

.bk-toolbar-main {
    flex: 1 1 260px;
    flex-wrap: wrap;
}

.bk-toolbar-end {
    flex: 0 0 auto;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.bk-search {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1 1 200px;
    max-inline-size: 320px;
    min-block-size: 34px;
    padding: 0 10px;
    border: 1px solid var(--border-default, #d0d5dd);
    border-radius: var(--radius-button, 5px);
    background: var(--surface-card, #ffffff);
}

.bk-search:focus-within {
    border-color: var(--border-focus, #6172f3);
}

.bk-search-icon {
    color: var(--text-faint, #98a2b3);
}

.bk-search-input {
    flex: 1;
    min-inline-size: 0;
    border: 0;
    background: none;
    color: var(--text-body, #344054);
    /* 16px: anything smaller and iOS zooms the page on focus. */
    font-size: 16px;
    outline: none;
}

@media (min-width: 768px) {
    .bk-search-input {
        font-size: 13px;
    }
}

.bk-search-input::-webkit-search-cancel-button {
    cursor: pointer;
}

.bk-clear {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-block-size: 34px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: var(--radius-button, 5px);
    background: transparent;
    color: var(--text-muted, #667085);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
}

.bk-clear:hover {
    background: var(--surface-hover, #f2f4f7);
    color: var(--text-body, #344054);
}

.bk-age {
    display: inline-flex;
    align-items: center;
    margin: 0;
    color: var(--text-faint, #98a2b3);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

.bk-age--busy {
    color: var(--text-muted, #667085);
}

.bk-refresh {
    display: grid;
    place-items: center;
    position: relative;
    inline-size: 34px;
    block-size: 34px;
    border: 1px solid var(--border-default, #d0d5dd);
    border-radius: var(--radius-button, 5px);
    background: var(--surface-card, #ffffff);
    color: var(--text-muted, #667085);
    cursor: pointer;
}

.bk-refresh:hover:not(:disabled) {
    background: var(--surface-hover, #f2f4f7);
    color: var(--text-body, #344054);
}

.bk-refresh:disabled {
    cursor: default;
}

.bk-refresh--busy :deep(.bk-icon) {
    animation: bk-spin 900ms linear infinite;
}

@keyframes bk-spin {
    to {
        transform: rotate(360deg);
    }
}

@media (prefers-reduced-motion: reduce) {
    .bk-refresh--busy :deep(.bk-icon) {
        animation: none;
        opacity: 0.5;
    }
}

.bk-count {
    margin: 0;
    color: var(--text-muted, #667085);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

.bk-view {
    display: inline-flex;
    padding: 2px;
    border: 1px solid var(--border-default, #d0d5dd);
    border-radius: var(--radius-button, 5px);
    background: var(--surface-sunken, #f9fafb);
}

.bk-view-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-block-size: 30px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--radius-xs, 3px);
    background: transparent;
    color: var(--text-muted, #667085);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
}

.bk-view-btn--on {
    background: var(--surface-card, #ffffff);
    color: var(--text-strong, #101828);
    font-weight: 600;
    box-shadow: var(--shadow-xs, 0 1px 2px rgb(16 24 40 / 0.06));
}

@media (max-width: 479px) {
    .bk-view-text {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }
}
</style>
