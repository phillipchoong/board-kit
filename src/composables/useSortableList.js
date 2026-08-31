import Sortable from 'sortablejs';
import { onBeforeUnmount, onMounted, watch } from 'vue';

/**
 * Wire one column body up as a SortableJS list.
 *
 * TOUCH IS THE REASON FOR THE SETTINGS BELOW. On a phone the same finger both
 * scrolls the board and drags a card, so a drag must not start until the user
 * has clearly asked for one:
 *
 *   delay 350 + delayOnTouchOnly   hold to pick up; a quick swipe scrolls
 *   touchStartThreshold 8          moving 8px inside the hold cancels the drag
 *   forceFallback                  same code path on mouse and touch, and the
 *                                  dragged card is a real element we can style
 *   scroll + bubbleScroll          the board scrolls when a held card nears the
 *                                  edge, which is the only way to cross seven
 *                                  columns on a 390px screen
 *
 * VUE AND SORTABLE BOTH OWN THE DOM, so on drop we put the node back exactly
 * where Vue had it and let the state change drive the real re-render. Without
 * that, Sortable's move and Vue's next patch fight and cards duplicate.
 */
export function useSortableList(elementRef, options) {
    let instance = null;

    const read = (el, key) => (el && el.dataset ? el.dataset[key] ?? null : null);

    function restoreDom(evt) {
        const { item, from, oldIndex } = evt;
        if (!item || !from) return;
        if (item.parentElement) item.parentElement.removeChild(item);
        const anchor = from.children[oldIndex] ?? null;
        from.insertBefore(item, anchor);
    }

    function create() {
        const el = elementRef.value;
        if (!el || instance) return;

        instance = Sortable.create(el, {
            group: {
                name: options.group,
                pull: () => !options.disabled?.value,
                put: (to, from, dragEl) => {
                    if (options.disabled?.value) return false;
                    if (!options.accepts) return true;
                    return options.accepts(dragEl, from.el ?? from);
                },
            },
            disabled: Boolean(options.disabled?.value),
            draggable: '[data-bk-card]',
            handle: options.handle || undefined,
            filter: '[data-bk-nodrag]',
            preventOnFilter: false,
            animation: 150,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
            delay: options.touchDelay ?? 350,
            delayOnTouchOnly: true,
            touchStartThreshold: 8,
            forceFallback: true,
            fallbackOnBody: true,
            fallbackTolerance: 4,
            scroll: true,
            scrollSensitivity: 90,
            scrollSpeed: 14,
            bubbleScroll: true,
            ghostClass: 'bk-ghost',
            chosenClass: 'bk-chosen',
            dragClass: 'bk-dragging',
            onStart(evt) {
                document.body.classList.add('bk-drag-active');
                options.onStart?.(read(evt.item, 'bkCard'));
            },
            onEnd(evt) {
                document.body.classList.remove('bk-drag-active');
                const payload = {
                    cardId: read(evt.item, 'bkCard'),
                    from: {
                        columnId: read(evt.from, 'bkColumn'),
                        laneId: read(evt.from, 'bkLane'),
                        index: evt.oldDraggableIndex ?? evt.oldIndex,
                    },
                    to: {
                        columnId: read(evt.to, 'bkColumn'),
                        laneId: read(evt.to, 'bkLane'),
                        index: evt.newDraggableIndex ?? evt.newIndex,
                    },
                };

                restoreDom(evt);
                options.onEnd?.(payload);
            },
        });
    }

    function destroy() {
        instance?.destroy();
        instance = null;
    }

    onMounted(create);
    onBeforeUnmount(destroy);

    if (options.disabled) {
        watch(options.disabled, (value) => instance?.option('disabled', Boolean(value)));
    }

    return { destroy };
}
