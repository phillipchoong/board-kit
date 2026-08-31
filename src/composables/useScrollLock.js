import { onBeforeUnmount, watch } from 'vue';

/**
 * Freeze the page behind an open overlay.
 *
 * `overflow: hidden` on the body is NOT enough on iOS - Safari keeps scrolling
 * the page behind a fixed overlay regardless. Pinning the body with
 * `position: fixed` at a negative offset is the one approach that actually
 * holds, and the scroll position has to be put back by hand afterwards because
 * pinning the body throws it away.
 *
 * Reference counted: two overlays open at once must not have the first one to
 * close unpin the page under the second.
 */
let depth = 0;
let savedY = 0;
let savedStyles = null;

function lock() {
    if (typeof document === 'undefined') return;
    depth += 1;
    if (depth > 1) return;

    savedY = window.scrollY || window.pageYOffset || 0;
    const body = document.body;
    savedStyles = {
        position: body.style.position,
        top: body.style.top,
        width: body.style.width,
        overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${savedY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
}

function unlock() {
    if (typeof document === 'undefined') return;
    depth = Math.max(0, depth - 1);
    if (depth > 0 || !savedStyles) return;

    const body = document.body;
    body.style.position = savedStyles.position;
    body.style.top = savedStyles.top;
    body.style.width = savedStyles.width;
    body.style.overflow = savedStyles.overflow;
    savedStyles = null;
    window.scrollTo(0, savedY);
}

export function useScrollLock(active) {
    let held = false;

    const apply = (value) => {
        if (value && !held) {
            held = true;
            lock();
        } else if (!value && held) {
            held = false;
            unlock();
        }
    };

    watch(active, apply, { immediate: true });

    // A component torn down while the overlay is open would otherwise leave the
    // page pinned with no way to unpin it.
    onBeforeUnmount(() => apply(false));
}
