<script setup>
/**
 * One card.
 *
 * The whole card is clickable for convenience, but the accessible action is the
 * title element - a real <button>, or an <a> when the card carries an href. A
 * div with role="button" would swallow the move menu nested inside it, and a
 * card that is one big <button> cannot hold a second button at all.
 *
 * Everything below the wrapper is replaceable: pass a `#card` slot to BoardView
 * and this component keeps the drag target, the menu and the keyboard handling
 * while your own markup fills the body.
 */
import { computed } from 'vue';
import BoardIcon from './BoardIcon.vue';
import BoardMoveMenu from './BoardMoveMenu.vue';
import { normaliseBadge, toneVars } from '../lib/tones.js';

const props = defineProps({
    card: { type: Object, required: true },
    columns: { type: Array, default: () => [] },
    lanes: { type: Array, default: () => [] },
    laneDraggable: { type: Boolean, default: true },
    draggable: { type: Boolean, default: true },
    showMenu: { type: Boolean, default: true },
    showHandle: { type: Boolean, default: false },
    formatUpdated: { type: Function, default: null },
});

const emit = defineEmits(['select', 'move']);

const badges = computed(() => (props.card.badges ?? []).map(normaliseBadge).filter(Boolean));
const updated = computed(() => {
    if (!props.card.updatedAt) return null;
    return props.formatUpdated ? props.formatUpdated(props.card.updatedAt) : props.card.updatedAt;
});

function onCardClick(event) {
    // A click that started on the menu, a link, or any other control belongs to
    // that control. Only bare card surface opens the card.
    if (event.target.closest('[data-bk-nodrag], a, button, input, select, textarea')) return;
    emit('select', props.card);
}
</script>

<template>
    <div
        class="bk-card"
        :class="{ 'bk-card--static': !draggable }"
        :data-bk-card="card.id"
        role="listitem"
        @click="onCardClick"
    >
        <div class="bk-card-head">
            <BoardIcon v-if="showHandle && draggable" name="grip" :size="14" class="bk-card-grip" />
            <component
                :is="card.href ? 'a' : 'button'"
                :href="card.href || undefined"
                :type="card.href ? undefined : 'button'"
                class="bk-card-title"
                @click="card.href ? null : emit('select', card)"
            >
                <slot name="title" :card="card">{{ card.title }}</slot>
            </component>
            <BoardMoveMenu
                v-if="showMenu"
                :card="card"
                :columns="columns"
                :lanes="lanes"
                :lane-draggable="laneDraggable"
                @move="(patch) => emit('move', patch)"
            />
        </div>

        <slot :card="card">
            <p v-if="card.subtitle" class="bk-card-subtitle">{{ card.subtitle }}</p>
            <p v-if="card.summary" class="bk-card-summary">{{ card.summary }}</p>

            <div v-if="badges.length || card.tags.length" class="bk-card-badges">
                <span v-for="(badge, i) in badges" :key="`b${i}`" class="bk-badge" :style="toneVars(badge.tone)">
                    {{ badge.label }}
                </span>
                <span v-for="(tag, i) in card.tags" :key="`t${i}`" class="bk-tag">{{ tag }}</span>
            </div>

            <p v-if="updated" class="bk-card-foot">{{ updated }}</p>
        </slot>
    </div>
</template>

<style scoped>
.bk-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 10px 10px 12px;
    border: 1px solid var(--border-subtle, #e4e7ec);
    border-radius: var(--radius-md, 8px);
    background: var(--surface-card, #ffffff);
    box-shadow: var(--shadow-xs, 0 1px 2px rgb(16 24 40 / 0.06));
    cursor: grab;
    /* Stops the browser turning a hold-to-drag into a text selection or a
       magnifier bubble on iOS. */
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}

.bk-card--static {
    cursor: default;
}

.bk-card:hover {
    border-color: var(--border-default, #d0d5dd);
}

.bk-card-head {
    display: flex;
    align-items: flex-start;
    gap: 6px;
}

.bk-card-grip {
    margin-block-start: 3px;
    color: var(--text-faint, #98a2b3);
}

.bk-card-title {
    flex: 1;
    min-inline-size: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-strong, #101828);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
    text-align: start;
    text-decoration: none;
    cursor: pointer;
}

.bk-card-title:hover {
    color: var(--text-link, #3538cd);
}

.bk-card-subtitle {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted, #667085);
}

.bk-card-summary {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-body, #344054);
    /* Two lines is a card, five is a document. */
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.bk-card-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-block-start: 2px;
}

.bk-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 7px;
    border: 1px solid var(--bk-tone-border);
    border-radius: var(--radius-pill, 999px);
    background: var(--bk-tone-bg);
    color: var(--bk-tone-fg);
    font-size: 11px;
    font-weight: 600;
    line-height: 1.6;
}

.bk-tag {
    display: inline-flex;
    align-items: center;
    padding: 1px 7px;
    border: 1px dashed var(--border-subtle, #e4e7ec);
    border-radius: var(--radius-pill, 999px);
    color: var(--text-muted, #667085);
    font-size: 11px;
    line-height: 1.6;
}

.bk-card-foot {
    margin: 0;
    font-size: 11px;
    color: var(--text-faint, #98a2b3);
}
</style>
