import { onMounted, ref, watch } from 'vue';

/**
 * A ref that remembers itself in localStorage.
 *
 * Reading happens in `onMounted`, never in setup: these components render on
 * the server under Inertia SSR, where `window` does not exist, and a value read
 * during setup would also make the server and client markup disagree.
 *
 * A stored value that fails `validate` is thrown away rather than rendered.
 * Someone's board should not stay broken because a key changed meaning three
 * versions ago and their browser still holds the old shape.
 */
export function usePersistentState(key, fallback, { validate = () => true } = {}) {
    const state = ref(fallback);
    let ready = false;

    onMounted(() => {
        ready = true;
        if (!key || typeof window === 'undefined' || !window.localStorage) return;
        try {
            const raw = window.localStorage.getItem(key);
            if (raw === null) return;
            const parsed = JSON.parse(raw);
            if (validate(parsed)) state.value = parsed;
        } catch {
            // Private mode, a quota error, or corrupt JSON. The fallback stands.
        }
    });

    watch(
        state,
        (value) => {
            if (!ready || !key || typeof window === 'undefined' || !window.localStorage) return;
            try {
                window.localStorage.setItem(key, JSON.stringify(value));
            } catch {
                // Storage full or blocked. Losing the preference is not worth an error.
            }
        },
        { deep: true },
    );

    return state;
}
