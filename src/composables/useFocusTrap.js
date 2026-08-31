import { nextTick, onBeforeUnmount, watch } from 'vue';

const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keep Tab inside an open overlay, and give focus back when it closes.
 *
 * Returning focus to the element that opened the dialog is the half people skip,
 * and it is the half that matters: without it a keyboard user who closes a card
 * is dropped at the top of the document and has to tab through the whole board
 * again to get back to where they were.
 */
export function useFocusTrap(panelRef, active) {
    let previous = null;

    function focusables() {
        const el = panelRef.value;
        if (!el) return [];
        return [...el.querySelectorAll(FOCUSABLE)].filter(
            (node) => node.offsetParent !== null || node === document.activeElement,
        );
    }

    function onKeydown(event) {
        if (event.key !== 'Tab' || !active.value) return;
        const items = focusables();
        if (items.length === 0) {
            event.preventDefault();
            panelRef.value?.focus();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const current = document.activeElement;

        if (event.shiftKey && (current === first || !panelRef.value?.contains(current))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && current === last) {
            event.preventDefault();
            first.focus();
        }
    }

    watch(active, async (value) => {
        if (typeof document === 'undefined') return;
        if (value) {
            previous = document.activeElement;
            document.addEventListener('keydown', onKeydown, true);
            await nextTick();
            const items = focusables();
            (items[0] ?? panelRef.value)?.focus();
        } else {
            document.removeEventListener('keydown', onKeydown, true);
            // The opener can be gone by now - a card the drawer was used to move
            // out of view, for instance - so this is deliberately best effort.
            if (previous && document.contains(previous)) previous.focus();
            previous = null;
        }
    });

    onBeforeUnmount(() => {
        if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeydown, true);
    });
}
