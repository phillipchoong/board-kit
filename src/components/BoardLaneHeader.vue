<script setup>
/**
 * A swimlane's heading row. It spans the whole grid, so the label is pinned to
 * the left edge of the scroller: on a phone you scroll sideways through seven
 * stages and the row still tells you whose lane you are in.
 */
import BoardIcon from './BoardIcon.vue';

defineProps({
    lane: { type: Object, required: true },
    count: { type: Number, default: 0 },
    collapsed: { type: Boolean, default: false },
});

const emit = defineEmits(['toggle']);
</script>

<template>
    <div class="bk-lane-head">
        <div class="bk-lane-head-inner">
            <button
                v-if="lane.collapsible"
                type="button"
                class="bk-lane-toggle"
                :aria-expanded="!collapsed"
                :aria-label="collapsed ? `Expand ${lane.title}` : `Collapse ${lane.title}`"
                @click="emit('toggle')"
            >
                <BoardIcon :name="collapsed ? 'chevron-right' : 'chevron-down'" :size="14" />
            </button>
            <h3 class="bk-lane-title">{{ lane.title }}</h3>
            <span class="bk-lane-count">{{ count }}</span>
            <span v-if="lane.description" class="bk-lane-desc">{{ lane.description }}</span>
        </div>
    </div>
</template>

<style scoped>
.bk-lane-head {
    grid-column: 1 / -1;
    position: sticky;
    top: var(--bk-lane-head-top, 0);
    z-index: 1;
    padding-block: 10px 4px;
    background: var(--bk-board-bg, transparent);
}

.bk-lane-head-inner {
    position: sticky;
    left: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    /* The row is as wide as every column put together; the label must not be. */
    inline-size: max-content;
    max-inline-size: 100%;
    padding: 4px 2px;
}

.bk-lane-toggle {
    display: grid;
    place-items: center;
    inline-size: 22px;
    block-size: 22px;
    position: relative;
    flex: none;
    border: 0;
    border-radius: var(--radius-xs, 3px);
    background: transparent;
    color: var(--text-muted, #667085);
    cursor: pointer;
}

.bk-lane-toggle::before {
    content: '';
    position: absolute;
    inset: -10px;
}

.bk-lane-toggle:hover,
.bk-lane-toggle:focus-visible {
    background: var(--surface-hover, #f2f4f7);
}

.bk-lane-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-strong, #101828);
    white-space: nowrap;
}

.bk-lane-count {
    padding: 0 7px;
    border-radius: var(--radius-pill, 999px);
    background: var(--neutral-bg, #f2f4f7);
    color: var(--neutral-600, #475467);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

.bk-lane-desc {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--text-muted, #667085);
}
</style>
