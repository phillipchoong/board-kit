<script setup>
/**
 * One filter, as a button that says what it is filtering by.
 *
 * The button shows the chosen value rather than just the field name, so a board
 * that is hiding half its cards says so on the face of the control. That is the
 * failure this replaces: a filtered board that looks identical to an empty one.
 */
import { computed } from 'vue';
import BoardIcon from './BoardIcon.vue';
import BoardPopover from './BoardPopover.vue';
import { idOf } from '../lib/model.js';

const props = defineProps({
    filter: { type: Object, required: true },
    selected: { type: Array, default: () => [] },
    counts: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['update']);

const multiple = computed(() => props.filter.multiple !== false);
const chosen = computed(() => props.selected.map(idOf));

const label = computed(() => {
    if (chosen.value.length === 0) return props.filter.label;
    if (chosen.value.length === 1) {
        const option = props.filter.options.find((o) => idOf(o.value) === chosen.value[0]);
        return `${props.filter.label}: ${option ? option.label : chosen.value[0]}`;
    }
    return `${props.filter.label}: ${chosen.value.length}`;
});

function pick(close, value) {
    const id = idOf(value);
    if (!multiple.value) {
        close();
        emit('update', chosen.value.includes(id) ? [] : [value]);
        return;
    }
    const next = chosen.value.includes(id)
        ? props.selected.filter((v) => idOf(v) !== id)
        : [...props.selected, value];
    emit('update', next);
}
</script>

<template>
    <BoardPopover :width="240" :max-height="300" :label="filter.label">
        <template #trigger="{ open, toggle }">
            <button
                type="button"
                class="bk-filter-trigger"
                :class="{ 'bk-filter-trigger--on': chosen.length > 0 }"
                :aria-expanded="open"
                aria-haspopup="menu"
                @click="toggle"
            >
                <BoardIcon name="filter" :size="14" />
                <span class="bk-filter-trigger-text">{{ label }}</span>
                <BoardIcon name="chevron-down" :size="14" />
            </button>
        </template>

        <template #default="{ close }">
            <button
                v-for="option in filter.options"
                :key="idOf(option.value)"
                type="button"
                role="menuitemcheckbox"
                :aria-checked="chosen.includes(idOf(option.value))"
                class="bk-popover-item"
                @click="pick(close, option.value)"
            >
                <span class="bk-popover-item-text">{{ option.label }}</span>
                <span class="bk-filter-right">
                    <span v-if="counts[idOf(option.value)] !== undefined" class="bk-filter-count">
                        {{ counts[idOf(option.value)] }}
                    </span>
                    <BoardIcon v-if="chosen.includes(idOf(option.value))" name="check" :size="14" />
                </span>
            </button>

            <template v-if="chosen.length">
                <div class="bk-popover-sep" />
                <button type="button" class="bk-popover-item" @click="emit('update', []); close();">
                    <span class="bk-popover-item-text">Clear {{ filter.label.toLowerCase() }}</span>
                    <BoardIcon name="x" :size="14" />
                </button>
            </template>
        </template>
    </BoardPopover>
</template>

<style scoped>
.bk-filter-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 34px;
    /* A FIXED width, not a max. The label grows from "Source" to
       "Source: Facebook" the moment you choose something, and a button that
       resizes under the pointer shoves every control after it sideways. The
       width is reserved up front and long values truncate instead. */
    flex: 0 0 auto;
    inline-size: 152px;
    padding: 0 10px;
    border: 1px solid var(--border-default, #d0d5dd);
    border-radius: var(--radius-button, 5px);
    background: var(--surface-card, #ffffff);
    color: var(--text-body, #344054);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
}

.bk-filter-trigger:hover {
    background: var(--surface-hover, #f2f4f7);
}

.bk-filter-trigger--on {
    border-color: var(--border-focus, #6172f3);
    background: var(--info-bg, #eff8ff);
    color: var(--info-700, #175cd3);
    font-weight: 600;
}

.bk-filter-trigger-text {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bk-filter-right {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.bk-filter-count {
    color: var(--text-faint, #98a2b3);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
}
</style>
