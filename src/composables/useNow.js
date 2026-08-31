import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * A clock the board can depend on, so relative times stay honest.
 *
 * "2m ago" computed once at render is a lie thirty seconds later, and a board
 * left open on a wall display or a second monitor is exactly where that shows.
 * Anything that formats a timestamp reads this ref first, so a tick re-renders
 * it.
 *
 * ONE interval for the whole page, shared by every board and card on it, and it
 * stops while the tab is hidden - a background tab does not need to recompute
 * "3h ago" twice a minute, and phones throttle it anyway.
 */
const now = ref(Date.now());
let timer = null;
let subscribers = 0;

const TICK_MS = 30000;

function tick() {
    now.value = Date.now();
}

function start() {
    if (timer !== null || typeof window === 'undefined') return;
    timer = window.setInterval(tick, TICK_MS);
}

function stop() {
    if (timer === null) return;
    window.clearInterval(timer);
    timer = null;
}

function onVisibility() {
    if (document.hidden) {
        stop();
        return;
    }
    // Catch up the moment the tab comes back, rather than showing a stale
    // number until the next tick lands.
    tick();
    if (subscribers > 0) start();
}

export function useNow() {
    onMounted(() => {
        subscribers += 1;
        if (subscribers === 1) {
            document.addEventListener('visibilitychange', onVisibility);
            if (!document.hidden) start();
        }
        tick();
    });

    onBeforeUnmount(() => {
        subscribers = Math.max(0, subscribers - 1);
        if (subscribers === 0) {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
        }
    });

    return now;
}
