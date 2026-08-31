<script setup>
/**
 * The panel a card opens into. A shell, not a screen: the fields inside are
 * your app's, passed as a slot.
 *
 * ONE COMPONENT, TWO SHAPES. Under 768px it is a bottom sheet you can swipe
 * away; above that it is a side panel. Those are the two shapes that work, and
 * a centred modal is neither - on a phone it leaves a card-sized dialog
 * stranded in the middle of the screen, and on a desktop it hides the board
 * behind the thing you are reading about.
 *
 * The swipe handle is the header alone, never the body. Attach the gesture to
 * the whole sheet and the content inside it can no longer be scrolled, which is
 * the usual way this feature ships broken.
 *
 * NO HISTORY INTEGRATION, on purpose. Back-to-close is the expected gesture on
 * Android, but the way to build it - pushing a history entry - collides with
 * how Inertia manages history, and a popstate carrying no Inertia page state
 * makes it hard-reload the page. A drawer that closes correctly is worth more
 * than one that occasionally reloads the app. Escape, the scrim, the close
 * button and the swipe all work.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import BoardIcon from './BoardIcon.vue';
import BoardMoveMenu from './BoardMoveMenu.vue';
import { useFocusTrap } from '../composables/useFocusTrap.js';
import { useScrollLock } from '../composables/useScrollLock.js';

const props = defineProps({
    title: { type: String, default: '' },
    subtitle: { type: String, default: null },
    /** Shown to screen readers as the dialog's name when there is no title. */
    label: { type: String, default: 'Card details' },
    /** Pass a card to get the move menu in the header. */
    card: { type: Object, default: null },
    columns: { type: Array, default: () => [] },
    lanes: { type: Array, default: () => [] },
    laneDraggable: { type: Boolean, default: true },
    showMenu: { type: Boolean, default: true },
    /** How far the sheet must be pulled down before letting go closes it. */
    dismissDistance: { type: Number, default: 96 },
});

const emit = defineEmits(['close', 'move']);

const open = defineModel('open', { type: Boolean, default: false });

const panel = ref(null);
const isSheet = ref(false);
let media = null;

const syncMedia = () => {
    isSheet.value = media ? media.matches : false;
};

onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    media = window.matchMedia('(max-width: 767px)');
    syncMedia();
    media.addEventListener('change', syncMedia);
});

onBeforeUnmount(() => media?.removeEventListener('change', syncMedia));

useScrollLock(open);
useFocusTrap(panel, open);

function close() {
    open.value = false;
    emit('close');
}

function onKeydown(event) {
    if (event.key === 'Escape') {
        event.stopPropagation();
        close();
    }
}

/* ------------------------------------------------------------ swipe to close */

const offset = ref(0);
const dragging = ref(false);
let startY = null;

function onGrabDown(event) {
    if (!isSheet.value || event.button > 0) return;
    startY = event.clientY;
    dragging.value = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
}

function onGrabMove(event) {
    if (!dragging.value) return;
    // Downwards only. Dragging a sheet upwards past its own top edge just makes
    // it look broken.
    offset.value = Math.max(0, event.clientY - startY);
}

function onGrabUp() {
    if (!dragging.value) return;
    dragging.value = false;
    const travelled = offset.value;
    offset.value = 0;
    startY = null;
    if (travelled > props.dismissDistance) close();
}

const panelStyle = computed(() => {
    if (!offset.value) return null;
    return { transform: `translateY(${offset.value}px)`, transition: 'none' };
});

const transitionName = computed(() => (isSheet.value ? 'bk-sheet' : 'bk-panel'));
</script>

<template>
    <Teleport to="body">
        <!-- Explicit :duration on both, so Vue unmounts on a timer rather than
             waiting for a transitionend event that may never arrive. A host app
             that kills transitions globally - a CSS reset, or a blanket
             `* { transition: none }` for reduced motion - otherwise leaves the
             panel and its scrim mounted, and a stuck scrim swallows every click
             on the page underneath it.

             This does NOT rescue a tab with no requestAnimationFrame: Vue arms
             that timer inside a rAF callback, so a hidden tab pauses the whole
             transition either way. That case resolves itself when the tab is
             looked at again, which is the only time it matters. -->
        <Transition name="bk-fade" :duration="200">
            <div v-if="open" class="bk-scrim" @click="close" />
        </Transition>

        <Transition :name="transitionName" :duration="240">
            <div
                v-if="open"
                ref="panel"
                class="bk-drawer"
                :class="{ 'bk-drawer--sheet': isSheet, 'bk-drawer--dragging': dragging }"
                :style="panelStyle"
                role="dialog"
                aria-modal="true"
                :aria-label="title || label"
                tabindex="-1"
                @keydown="onKeydown"
            >
                <div
                    class="bk-drawer-head"
                    @pointerdown="onGrabDown"
                    @pointermove="onGrabMove"
                    @pointerup="onGrabUp"
                    @pointercancel="onGrabUp"
                >
                    <div v-if="isSheet" class="bk-grab" aria-hidden="true" />

                    <div class="bk-drawer-heading">
                        <h2 class="bk-drawer-title">
                            <slot name="title">{{ title }}</slot>
                        </h2>
                        <p v-if="subtitle" class="bk-drawer-subtitle">{{ subtitle }}</p>
                    </div>

                    <div class="bk-drawer-actions">
                        <slot name="actions" />
                        <BoardMoveMenu
                            v-if="card && showMenu"
                            :card="card"
                            :columns="columns"
                            :lanes="lanes"
                            :lane-draggable="laneDraggable"
                            @move="(patch) => emit('move', patch)"
                        />
                        <button type="button" class="bk-drawer-close" aria-label="Close" @click="close">
                            <BoardIcon name="x" :size="18" />
                        </button>
                    </div>
                </div>

                <div class="bk-drawer-body">
                    <slot />
                </div>

                <div v-if="$slots.footer" class="bk-drawer-foot">
                    <slot name="footer" />
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style>
/* Not scoped: everything here is teleported to <body>, outside this
   component's scope. Every class is bk- prefixed. */
.bk-scrim {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: var(--surface-overlay, rgb(16 24 40 / 0.55));
}

.bk-drawer {
    position: fixed;
    z-index: 71;
    display: flex;
    flex-direction: column;
    background: var(--surface-card, #ffffff);
    color: var(--text-body, #344054);
    box-shadow: var(--shadow-modal, 0 18px 50px rgb(16 24 40 / 0.28));
    outline: none;

    /* Side panel: the default, from 768px up. */
    inset-block: 0;
    inset-inline-end: 0;
    inline-size: min(440px, 100vw);
    border-inline-start: 1px solid var(--border-subtle, #e4e7ec);
}

.bk-drawer--sheet {
    /* Bottom sheet. Never full height: leaving the top of the board visible is
       what stops it reading as a page you navigated to. */
    inset-block: auto 0;
    inset-inline: 0;
    inline-size: 100%;
    max-block-size: 88dvh;
    border-inline-start: 0;
    border-start-start-radius: var(--radius-lg, 12px);
    border-start-end-radius: var(--radius-lg, 12px);
    padding-block-end: env(safe-area-inset-bottom, 0px);
}

.bk-drawer--dragging {
    user-select: none;
}

.bk-drawer-head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
    padding: 14px 12px 12px 16px;
    border-block-end: 1px solid var(--border-subtle, #e4e7ec);
}

.bk-drawer--sheet .bk-drawer-head {
    /* The grab bar is the gesture surface, so it must not scroll away. */
    padding-block-start: 8px;
    cursor: grab;
    touch-action: none;
}

.bk-grab {
    flex-basis: 100%;
    inline-size: 36px;
    block-size: 4px;
    margin: 0 auto 8px;
    border-radius: var(--radius-pill, 999px);
    background: var(--border-default, #d0d5dd);
}

.bk-drawer-heading {
    flex: 1;
    min-inline-size: 0;
}

.bk-drawer-title {
    margin: 0;
    color: var(--text-strong, #101828);
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
}

.bk-drawer-subtitle {
    margin: 2px 0 0;
    color: var(--text-muted, #667085);
    font-size: 12px;
}

/* Its own gap, and a real one. At 2px the move menu and the close button read
   as a single smudged control, and both are 32px targets that need to be
   separately hittable with a thumb. `flex: none` keeps them off the title. */
.bk-drawer-actions {
    display: flex;
    align-items: center;
    flex: none;
    gap: 6px;
    /* Nudge up so the buttons optically align with the title's cap height
       rather than sitting a couple of pixels below it. */
    margin-block-start: -3px;
}

.bk-drawer-close {
    display: grid;
    place-items: center;
    position: relative;
    inline-size: 32px;
    block-size: 32px;
    border: 0;
    border-radius: var(--radius-sm, 5px);
    background: transparent;
    color: var(--text-muted, #667085);
    cursor: pointer;
}

.bk-drawer-close::before {
    content: '';
    position: absolute;
    inset: -6px;
}

.bk-drawer-close:hover,
.bk-drawer-close:focus-visible {
    background: var(--surface-hover, #f2f4f7);
    color: var(--text-strong, #101828);
}

.bk-drawer-body {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: 16px;
    font-size: 13px;
}

.bk-drawer-foot {
    padding: 12px 14px;
    border-block-start: 1px solid var(--border-subtle, #e4e7ec);
    background: var(--surface-sunken, #f9fafb);
}

/* ---------------------------------------------------------------- motion */

.bk-fade-enter-active,
.bk-fade-leave-active {
    transition: opacity 180ms ease;
}

.bk-fade-enter-from,
.bk-fade-leave-to {
    opacity: 0;
}

.bk-panel-enter-active,
.bk-panel-leave-active,
.bk-sheet-enter-active,
.bk-sheet-leave-active {
    transition: transform 220ms cubic-bezier(0.2, 0, 0, 1);
}

.bk-panel-enter-from,
.bk-panel-leave-to {
    transform: translateX(100%);
}

.bk-sheet-enter-from,
.bk-sheet-leave-to {
    transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
    .bk-panel-enter-active,
    .bk-panel-leave-active,
    .bk-sheet-enter-active,
    .bk-sheet-leave-active {
        transition: opacity 120ms linear;
    }

    .bk-panel-enter-from,
    .bk-panel-leave-to,
    .bk-sheet-enter-from,
    .bk-sheet-leave-to {
        transform: none;
        opacity: 0;
    }
}
</style>
