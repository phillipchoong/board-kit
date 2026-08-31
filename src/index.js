/**
 * board-kit - Trello-style pipeline and list views for Vue 3.
 *
 * BoardView is the one import most screens need. The rest are exported because
 * a screen occasionally wants a piece on its own - a list view with no board
 * next to it, or a card rendered inside a drawer.
 */
export { default as BoardView } from './components/BoardView.vue';
export { default as BoardPipeline } from './components/BoardPipeline.vue';
export { default as BoardListView } from './components/BoardListView.vue';
export { default as BoardCard } from './components/BoardCard.vue';
export { default as BoardColumnHeader } from './components/BoardColumnHeader.vue';
export { default as BoardColumnBody } from './components/BoardColumnBody.vue';
export { default as BoardLaneHeader } from './components/BoardLaneHeader.vue';
export { default as BoardToolbar } from './components/BoardToolbar.vue';
export { default as BoardFilterMenu } from './components/BoardFilterMenu.vue';
export { default as BoardMoveMenu } from './components/BoardMoveMenu.vue';
export { default as BoardPopover } from './components/BoardPopover.vue';
export { default as BoardIcon } from './components/BoardIcon.vue';

export {
    NO_LANE,
    bucketKey,
    byPosition,
    cardValue,
    filterCards,
    groupCards,
    idOf,
    limitState,
    matchesFilters,
    matchesQuery,
    normaliseCards,
    normaliseColumns,
    normaliseLanes,
    sortCards,
} from './lib/model.js';

export { applyOrder, applyPending, buildMove, isSettled, positionBetween } from './lib/move.js';
export { TONES, normaliseBadge, toneVars } from './lib/tones.js';

export { usePersistentState } from './composables/usePersistentState.js';
export { usePopover } from './composables/usePopover.js';
export { useSortableList } from './composables/useSortableList.js';
