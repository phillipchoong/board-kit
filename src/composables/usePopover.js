import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

/**
 * A small popover positioned from its trigger and teleported to <body>.
 *
 * Fixed positioning, not absolute, because every popover in this kit opens from
 * inside a column that scrolls in both directions. An absolutely positioned
 * panel is clipped by that scroller and ends up half off-screen on exactly the
 * narrow displays where the menu matters most.
 *
 * Closing on scroll rather than following the trigger is deliberate: a panel
 * that chases its button around while the board pans is harder to hit than one
 * that gets out of the way.
 */
export function usePopover(triggerRef, panelRef, { width = 232, maxHeight = 260 } = {}) {
    const open = ref(false);
    const style = ref({});

    function place() {
        const el = triggerRef.value;
        if (!el || typeof window === 'undefined') return;
        const rect = el.getBoundingClientRect();
        const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
        const below = window.innerHeight - rect.bottom;
        style.value =
            below > maxHeight
                ? { left: `${left}px`, top: `${rect.bottom + 4}px` }
                : { left: `${left}px`, bottom: `${window.innerHeight - rect.top + 4}px` };
    }

    const close = () => {
        open.value = false;
    };
    const toggle = () => {
        open.value = !open.value;
    };

    function onPointerDown(event) {
        if (triggerRef.value?.contains(event.target)) return;
        if (panelRef.value?.contains(event.target)) return;
        close();
    }

    function onKeydown(event) {
        if (event.key !== 'Escape') return;
        close();
        triggerRef.value?.focus();
    }

    function bind() {
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeydown);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
    }

    function unbind() {
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('keydown', onKeydown);
        window.removeEventListener('resize', close);
        window.removeEventListener('scroll', close, true);
    }

    watch(open, async (value) => {
        if (!value) {
            unbind();
            return;
        }
        place();
        await nextTick();
        panelRef.value?.querySelector('button:not([disabled]), input, [tabindex="0"]')?.focus();
        bind();
    });

    onBeforeUnmount(unbind);

    return { open, style, toggle, close, place };
}
