<script setup>
/**
 * A stage heading, rendered once per column no matter how many lanes are below
 * it. With swimlanes on, the count and the WIP limit are the column's totals
 * across every lane - a limit of 5 means five in that stage, not five per row.
 */
import { computed } from 'vue';
import BoardIcon from './BoardIcon.vue';
import { toneVars } from '../lib/tones.js';
import { limitState } from '../lib/model.js';

const props = defineProps({
    column: { type: Object, required: true },
    /** Cards actually rendered here, after search and filters. */
    count: { type: Number, default: 0 },
    /** Cards in this stage before filtering. The WIP limit is judged on this. */
    total: { type: Number, default: null },
    collapsed: { type: Boolean, default: false },
});

const emit = defineEmits(['toggle']);

/**
 * The limit is a property of the stage, not of your current filter, so it is
 * measured against the unfiltered total. The number shown is what you can see.
 * When those differ the title says both, because "3/5" over three visible cards
 * out of seven is a lie either way round.
 */
const real = computed(() => (props.total === null ? props.count : props.total));
const filtered = computed(() => real.value !== props.count);
const state = computed(() => limitState(real.value, props.column.limit));

const limitLabel = computed(() => (props.column.limit ? `${props.count}/${props.column.limit}` : String(props.count)));

const limitTitle = computed(() => {
    const head = filtered.value
        ? `${props.count} shown of ${real.value} in this stage`
        : `${props.count} ${props.count === 1 ? 'card' : 'cards'}`;
    if (!props.column.limit) return head;
    if (state.value === 'over') return `${head}, over the limit of ${props.column.limit}`;
    if (state.value === 'full') return `${head}, at the limit of ${props.column.limit}`;
    return `${head}, limit ${props.column.limit}`;
});
</script>

<template>
    <div class="bk-col-head" :class="{ 'bk-col-head--collapsed': collapsed }" :style="toneVars(column.tone)">
        <button
            v-if="column.collapsible"
            type="button"
            class="bk-col-toggle"
            :aria-expanded="!collapsed"
            :aria-label="collapsed ? `Expand ${column.title}` : `Collapse ${column.title}`"
            @click="emit('toggle')"
        >
            <BoardIcon :name="collapsed ? 'chevron-right' : 'chevron-down'" :size="14" />
        </button>

        <span class="bk-col-title" :title="column.description || column.title">{{ column.title }}</span>

        <span class="bk-col-count" :class="`bk-col-count--${state}`" :title="limitTitle">
            <BoardIcon v-if="state === 'over'" name="alert" :size="12" />
            <span aria-hidden="true">{{ limitLabel }}</span>
            <span class="bk-sr">{{ limitTitle }}</span>
        </span>
    </div>
</template>

<style scoped>
.bk-col-head {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid var(--bk-tone-border);
    border-radius: var(--radius-md, 8px) var(--radius-md, 8px) 0 0;
    background: var(--bk-tone-bg);
    scroll-snap-align: start;
}

.bk-col-head--collapsed {
    /* Sideways, so a collapsed column is still readable at 48px wide. */
    justify-content: flex-start;
}

.bk-col-head--collapsed .bk-col-title,
.bk-col-head--collapsed .bk-col-count {
    display: none;
}

.bk-col-toggle {
    display: grid;
    place-items: center;
    inline-size: 22px;
    block-size: 22px;
    position: relative;
    flex: none;
    border: 0;
    border-radius: var(--radius-xs, 3px);
    background: transparent;
    color: var(--bk-tone-fg);
    cursor: pointer;
}

.bk-col-toggle::before {
    content: '';
    position: absolute;
    inset: -10px;
}

.bk-col-toggle:hover,
.bk-col-toggle:focus-visible {
    background: color-mix(in srgb, var(--bk-tone-fg) 12%, transparent);
}

.bk-col-title {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--bk-tone-fg);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
}

.bk-col-count {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: none;
    padding: 1px 7px;
    border-radius: var(--radius-pill, 999px);
    background: color-mix(in srgb, var(--bk-tone-fg) 12%, transparent);
    color: var(--bk-tone-fg);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

/* Over the limit is not colour alone: the chip also gains the warning triangle
   and the screen-reader text spells the state out. */
.bk-col-count--full {
    background: var(--warning-bg, #fffaeb);
    color: var(--warning-700, #b54708);
}

.bk-col-count--over {
    background: var(--danger-bg, #fef3f2);
    color: var(--danger-700, #b42318);
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
    border: 0;
}
</style>
