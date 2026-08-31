<script setup>
/**
 * The card's non-drag path: move it with a tap, a click or the keyboard.
 *
 * This is not a nicety. Drag-and-drop is unusable with a screen reader, awkward
 * one-handed on a phone, and impossible from a keyboard, so every card carries
 * this menu and the board stays fully operable without ever dragging anything.
 */
import { computed } from 'vue';
import BoardIcon from './BoardIcon.vue';
import BoardPopover from './BoardPopover.vue';

const props = defineProps({
    card: { type: Object, required: true },
    columns: { type: Array, default: () => [] },
    lanes: { type: Array, default: () => [] },
    laneDraggable: { type: Boolean, default: true },
});

const emit = defineEmits(['move']);

const laneChoices = computed(() => (props.laneDraggable ? props.lanes.filter((lane) => !lane.implicit) : []));

function choose(close, patch) {
    close();
    emit('move', patch);
}
</script>

<template>
    <BoardPopover :width="232" :label="`Move ${card.title || 'card'}`">
        <template #trigger="{ open, toggle }">
            <button
                type="button"
                class="bk-card-menu-trigger"
                :aria-expanded="open"
                aria-haspopup="menu"
                :aria-label="`Move ${card.title || 'card'}`"
                @click.stop="toggle"
            >
                <BoardIcon name="more" :size="16" />
            </button>
        </template>

        <template #default="{ close }">
            <p class="bk-popover-label">Move to stage</p>
            <button
                v-for="column in columns"
                :key="column.id"
                type="button"
                role="menuitem"
                class="bk-popover-item"
                :disabled="column.id === card.columnId || !column.droppable"
                @click="choose(close, { columnId: column.id })"
            >
                <span class="bk-popover-item-text">{{ column.title }}</span>
                <BoardIcon v-if="column.id === card.columnId" name="check" :size="14" />
            </button>

            <template v-if="laneChoices.length">
                <div class="bk-popover-sep" />
                <p class="bk-popover-label">Move to lane</p>
                <button
                    v-for="lane in laneChoices"
                    :key="lane.id"
                    type="button"
                    role="menuitem"
                    class="bk-popover-item"
                    :disabled="lane.id === card.laneId"
                    @click="choose(close, { laneId: lane.id })"
                >
                    <span class="bk-popover-item-text">{{ lane.title }}</span>
                    <BoardIcon v-if="lane.id === card.laneId" name="check" :size="14" />
                </button>
            </template>
        </template>
    </BoardPopover>
</template>

<style scoped>
.bk-card-menu-trigger {
    display: grid;
    place-items: center;
    position: relative;
    /* 28px drawn, 44px touchable via the ::before below - the accessible target
       size without punching a 44px hole in a 13px card. */
    inline-size: 28px;
    block-size: 28px;
    border: 0;
    border-radius: var(--radius-sm, 5px);
    background: transparent;
    color: var(--text-faint, #98a2b3);
    cursor: pointer;
}

.bk-card-menu-trigger::before {
    content: '';
    position: absolute;
    inset: -8px;
}

.bk-card-menu-trigger:hover,
.bk-card-menu-trigger:focus-visible {
    background: var(--surface-hover, #f2f4f7);
    color: var(--text-body, #344054);
}
</style>
