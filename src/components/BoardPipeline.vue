<script setup>
/**
 * The pipeline (swim-lane) view.
 *
 * ONE grid, not a column of independent boards. Stage headings are the first
 * row; every lane below adds a full-width heading row and then one cell per
 * stage. That single grid is what keeps the stages lined up down the page and
 * gives every lane the same horizontal scroll - separate scrollers per lane
 * would slide out of alignment the moment you moved one of them.
 *
 * Widths, in one place:
 *   phone     78vw per column, scroll-snapped, so one stage fills the screen
 *   tablet+   300px per column, scrolling sideways
 *   `fit`     every column shares the width and nothing scrolls sideways
 * A collapsed column is 48px in all three.
 */
import { computed, useSlots } from 'vue';
import BoardColumnHeader from './BoardColumnHeader.vue';
import BoardColumnBody from './BoardColumnBody.vue';
import BoardLaneHeader from './BoardLaneHeader.vue';
import { bucketKey } from '../lib/model.js';

const props = defineProps({
    columns: { type: Array, required: true },
    lanes: { type: Array, required: true },
    buckets: { type: Map, required: true },
    columnCounts: { type: Object, default: () => ({}) },
    columnTotals: { type: Object, default: () => ({}) },
    laneCounts: { type: Object, default: () => ({}) },
    collapsedColumns: { type: Array, default: () => [] },
    collapsedLanes: { type: Array, default: () => [] },
    group: { type: String, required: true },
    dragEnabled: { type: Boolean, default: true },
    accepts: { type: Function, default: null },
    fit: { type: Boolean, default: false },
    fill: { type: Boolean, default: false },
    laneDraggable: { type: Boolean, default: true },
    showHandle: { type: Boolean, default: false },
    showMenu: { type: Boolean, default: true },
    emptyText: { type: String, default: 'Nothing here' },
    formatUpdated: { type: Function, default: null },
    touchDelay: { type: Number, default: 350 },
    flashes: { type: Map, default: () => new Map() },
});

const emit = defineEmits(['drop', 'select', 'move', 'toggle-column', 'toggle-lane']);

const slots = useSlots();

const isColumnCollapsed = (id) => props.collapsedColumns.includes(id);
const isLaneCollapsed = (id) => props.collapsedLanes.includes(id);

/**
 * Track widths are written as `var(--bk-col-width)` rather than a resolved
 * length on purpose. Whether the columns fit or scroll is a viewport question,
 * and a viewport question belongs in a media query - which an inline style
 * cannot hold. The `--fit` class redefines that one variable at the wide
 * breakpoint and the whole grid changes behaviour with it.
 */
const template = computed(() =>
    props.columns
        .map((column) => (isColumnCollapsed(column.id) ? 'var(--bk-col-collapsed, 48px)' : 'var(--bk-col-width, 300px)'))
        .join(' '),
);

/**
 * Fill mode needs explicit rows, not `grid-auto-rows`. The heading rows must
 * stay their natural height while only the card rows share what is left; one
 * `auto-rows` value cannot say both, and giving the headers a 1fr share is how
 * a board ends up with a 200px-tall row of column titles.
 */
const rowTemplate = computed(() => {
    if (!props.fill) return null;
    const rows = ['auto'];
    for (const lane of props.lanes) {
        if (!lane.implicit) rows.push('auto');
        if (!isLaneCollapsed(lane.id)) rows.push('minmax(0, 1fr)');
    }
    return rows.join(' ');
});

const gridStyle = computed(() => {
    const style = { gridTemplateColumns: template.value };
    if (rowTemplate.value) style.gridTemplateRows = rowTemplate.value;
    return style;
});

const cardsFor = (lane, column) => props.buckets.get(bucketKey(lane.id, column.id)) ?? [];
</script>

<template>
    <div class="bk-pipeline" :class="{ 'bk-pipeline--fill': fill, 'bk-pipeline--fit': fit }">
        <div class="bk-scroll">
            <div class="bk-grid" :style="gridStyle">
                <BoardColumnHeader
                    v-for="column in columns"
                    :key="`h-${column.id}`"
                    :column="column"
                    :count="columnCounts[column.id] ?? 0"
                    :total="columnTotals[column.id] ?? columnCounts[column.id] ?? 0"
                    :collapsed="isColumnCollapsed(column.id)"
                    @toggle="emit('toggle-column', column.id)"
                />

                <template v-for="lane in lanes" :key="lane.id">
                    <BoardLaneHeader
                        v-if="!lane.implicit"
                        :lane="lane"
                        :count="laneCounts[lane.id] ?? 0"
                        :collapsed="isLaneCollapsed(lane.id)"
                        @toggle="emit('toggle-lane', lane.id)"
                    />

                    <template v-if="!isLaneCollapsed(lane.id)">
                        <BoardColumnBody
                            v-for="column in columns"
                            :key="`${lane.id}-${column.id}`"
                            :column="column"
                            :lane="lane"
                            :cards="cardsFor(lane, column)"
                            :columns="columns"
                            :lanes="lanes"
                            :group="group"
                            :disabled="!dragEnabled"
                            :accepts="accepts"
                            :collapsed="isColumnCollapsed(column.id)"
                            :joined="lane.implicit"
                            :lane-draggable="laneDraggable"
                            :show-handle="showHandle"
                            :show-menu="showMenu"
                            :empty-text="emptyText"
                            :format-updated="formatUpdated"
                            :touch-delay="touchDelay"
                            :flashes="flashes"
                            @drop="(payload) => emit('drop', payload)"
                            @select="(card) => emit('select', card)"
                            @move="(payload) => emit('move', payload)"
                        >
                            <template v-if="slots.card" #card="slotProps">
                                <slot name="card" v-bind="slotProps" />
                            </template>
                            <template v-if="slots['card-title']" #card-title="slotProps">
                                <slot name="card-title" v-bind="slotProps" />
                            </template>
                        </BoardColumnBody>
                    </template>
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped>
.bk-pipeline {
    min-inline-size: 0;
}

.bk-scroll {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scroll-padding-inline-start: 2px;
    /* Bleed to the viewport edges on small screens so a column can be full
       width without the page gutter eating a third of it. */
    margin-inline: calc(var(--bk-bleed, 0px) * -1);
    padding-inline: var(--bk-bleed, 0px);
    padding-block-end: 4px;
}

.bk-grid {
    display: grid;
    grid-auto-rows: min-content;
    align-items: start;
    gap: 0 var(--bk-gap, 12px);
    inline-size: max-content;
    min-inline-size: 100%;
}

/* Fit mode, and only where there is room for it. Below this width the columns
   go back to scrolling however few of them there are - seven 1fr tracks on a
   phone is seven unreadable slivers. */
@media (min-width: 1280px) {
    .bk-pipeline--fit {
        --bk-col-width: minmax(0, 1fr);
    }

    .bk-pipeline--fit .bk-scroll {
        overflow-x: visible;
        scroll-snap-type: none;
    }

    .bk-pipeline--fit .bk-grid {
        inline-size: 100%;
    }
}

/* Fill mode: the board owns a fixed height and the CARDS scroll, not the page.
   Every ancestor in the chain needs `min-height: 0` or the grid refuses to
   shrink and the whole thing grows past the viewport instead. */
.bk-pipeline--fill {
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    block-size: 100%;
}

.bk-pipeline--fill .bk-scroll {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
}

.bk-pipeline--fill .bk-grid {
    min-block-size: 100%;
}

.bk-pipeline--fill :deep(.bk-col-body) {
    min-block-size: 0;
    overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
    .bk-scroll {
        scroll-behavior: auto;
    }
}
</style>
