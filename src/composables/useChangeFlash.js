import { onBeforeUnmount, ref, watch } from 'vue';
import { diffSnapshots, describeChanges, snapshot } from '../lib/diff.js';

/**
 * Highlight cards that changed underneath the user, and say how many.
 *
 * THE FIRST LOAD NEVER FLASHES. Every card is technically new the first time
 * the board renders, and a board that lights up entirely on open has told the
 * user nothing.
 *
 * `ignoreIds` is the cards this user just moved. Their own move coming back
 * from the server is not news; flashing it is how the highlight stops meaning
 * "someone else changed this".
 *
 * Timers are per card, not one for the batch, so a second update landing while
 * the first is still glowing restarts only that card.
 */
export function useChangeFlash(cardsRef, { duration = 1600, ignoreIds = null } = {}) {
    /** cardId -> 'added' | 'moved' | 'updated' */
    const flashes = ref(new Map());
    const summary = ref('');

    let previous = null;
    const timers = new Map();

    function clearTimer(id) {
        const timer = timers.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.delete(id);
        }
    }

    function flash(id, kind) {
        clearTimer(id);
        const next = new Map(flashes.value);
        next.set(id, kind);
        flashes.value = next;

        timers.set(
            id,
            setTimeout(() => {
                timers.delete(id);
                const after = new Map(flashes.value);
                after.delete(id);
                flashes.value = after;
            }, duration),
        );
    }

    watch(
        cardsRef,
        (cards) => {
            const current = snapshot(cards);

            if (previous === null) {
                previous = current;
                return;
            }

            const ignore = ignoreIds ? ignoreIds.value : null;
            const changes = diffSnapshots(previous, current, ignore);

            let removed = 0;
            for (const id of previous.keys()) {
                if (!current.has(id)) removed += 1;
            }

            for (const [id, kind] of changes) flash(id, kind);
            summary.value = describeChanges(changes, removed);

            previous = current;
        },
        { immediate: true },
    );

    onBeforeUnmount(() => {
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
    });

    return { flashes, summary };
}
