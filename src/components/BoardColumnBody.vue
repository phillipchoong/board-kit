<script setup>
/**
 * One droppable cell: this column, in this lane.
 *
 * The list element holds card elements and nothing else. Sortable reports drop
 * positions as child indexes, so an empty-state paragraph or a "load more"
 * button living inside the list would silently shift every index by one. Both
 * sit outside it instead, and the list keeps a minimum height so an empty
 * column is still a target you can drop onto.
 */
import { computed, ref, useSlots } from 'vue';
import BoardCard from './BoardCard.vue';
import { useSortableList } from '../composables/useSortableList.js';

const props = defineProps({
    column: { type: Object, required: true },
    lane: { type: Object, required: true },
    cards: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    lanes: { type: Array, default: () => [] },
    group: { type: String, required: true },
    disabled: { type: Boolean, default: false },
    accepts: { type: Function, default: null },
    collapsed: { type: Boolean, default: false },
    /** True when this cell sits directly under the column header and should
        merge with it. False in a swimlane, where a lane heading comes between
        the two and the cell has to close its own top edge. */
    joined: { type: Boolean, default: true },
    laneDraggable: { type: Boolean, default: true },
    showHandle: { type: Boolean, default: false },
    showMenu: { type: Boolean, default: true },
    emptyText: { type: String, default: 'Nothing here' },
    formatUpdated: { type: Function, default: null },
    touchDelay: { type: Number, default: 350 },
    /** cardId -> 'added' | 'moved' | 'updated', for cards that just changed. */
    flashes: { type: Map, default: () => new Map() },
});

const emit = defineEmits(['drop', 'select', 'move']);

const slots = useSlots();
const list = ref(null);
const dragging = ref(null);

const dragDisabled = computed(() => props.disabled || props.collapsed || !props.column.droppable);

useSortableList(list, {
    group: props.group,
    disabled: dragDisabled,
    touchDelay: props.touchDelay,
    accepts: (dragEl, fromEl) => (props.accepts ? props.accepts(props.column, props.lane, dragEl, fromEl) : true),
    onStart: (cardId) => {
        dragging.value = cardId;
    },
    onEnd: (payload) => {
        dragging.value = null;
        emit('drop', payload);
    },
});

const label = computed(() =>
    props.lane.implicit ? props.column.title : `${props.column.title}, ${props.lane.title}`,
);
</script>

<template>
    <div class="bk-col-body" :class="{ 'bk-col-body--collapsed': collapsed, 'bk-col-body--joined': joined }">
        <template v-if="collapsed">
            <span class="bk-col-collapsed-count">{{ cards.length }}</span>
        </template>

        <template v-else>
            <div
                ref="list"
                class="bk-list"
                :data-bk-column="column.id"
                :data-bk-lane="lane.id"
                role="list"
                :aria-label="label"
            >
                <BoardCard
                    v-for="card in cards"
                    :key="card.id"
                    :card="card"
                    :columns="columns"
                    :lanes="lanes"
                    :lane-draggable="laneDraggable"
                    :draggable="!dragDisabled && card.draggable"
                    :show-menu="showMenu"
                    :show-handle="showHandle"
                    :format-updated="formatUpdated"
                    :flash="flashes.get(card.id) ?? null"
                    @select="emit('select', card)"
                    @move="(patch) => emit('move', { card, patch })"
                >
                    <template v-if="slots.card" #default="slotProps">
                        <slot name="card" v-bind="slotProps" />
                    </template>
                    <template v-if="slots['card-title']" #title="slotProps">
                        <slot name="card-title" v-bind="slotProps" />
                    </template>
                </BoardCard>
            </div>

            <p v-if="cards.length === 0" class="bk-empty">{{ emptyText }}</p>
        </template>
    </div>
</template>

<style scoped>
.bk-col-body {
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    padding: 8px;
    border: 1px solid var(--border-subtle, #e4e7ec);
    border-radius: var(--radius-md, 8px);
    background: var(--surface-sunken, #f9fafb);
    scroll-snap-align: start;
}

.bk-col-body--joined {
    border-block-start: 0;
    border-start-start-radius: 0;
    border-start-end-radius: 0;
}

.bk-col-body--collapsed {
    align-items: center;
    padding: 8px 4px;
}

.bk-col-collapsed-count {
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted, #667085);
}

.bk-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    /* A column with nothing in it still has to be a drop target. */
    min-block-size: 56px;
    overflow-y: auto;
    overscroll-behavior: contain;
}

.bk-empty {
    margin: 8px 0 4px;
    text-align: center;
    font-size: 12px;
    color: var(--text-faint, #98a2b3);
}
</style>

<style>
/* Not scoped: Sortable puts these classes on the card element, and the clone it
   drags lives on <body>, outside this component's scope entirely. */
.bk-ghost {
    opacity: 0.35;
    background: var(--surface-hover, #f2f4f7) !important;
    border-style: dashed !important;
}

.bk-chosen {
    box-shadow: var(--shadow-md, 0 2px 4px rgb(16 24 40 / 0.06), 0 4px 10px rgb(16 24 40 / 0.08));
}

.bk-dragging {
    transform: rotate(1.5deg);
    cursor: grabbing;
    box-shadow: var(--shadow-lg, 0 6px 16px rgb(16 24 40 / 0.1), 0 12px 28px rgb(16 24 40 / 0.12));
}

/* While a card is held, stop the page panning under the finger and stop the
   hold turning into a text selection. Deliberately NOT `overflow: hidden` on
   the body: on iOS that resets the scroll position when the drag ends, which
   throws the user back to the top of the board every time they move a card. */
body.bk-drag-active {
    cursor: grabbing;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
}
</style>
