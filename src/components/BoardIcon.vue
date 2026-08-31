<script setup>
/**
 * The kit's whole icon set, inline.
 *
 * Deliberately not a dependency. The consuming apps all use @lucide/vue, but a
 * UI package that pulls its own icon library in doubles the icon bundle in
 * every app that already has one. These are the same Lucide glyph paths, drawn
 * with the same 24-unit grid and 2px stroke, so they sit correctly next to the
 * host app's icons.
 */
import { computed } from 'vue';

const props = defineProps({
    name: { type: String, required: true },
    size: { type: [Number, String], default: 16 },
});

const PATHS = {
    'chevron-down': ['M6 9l6 6 6-6'],
    'chevron-right': ['M9 18l6-6-6-6'],
    'chevron-left': ['M15 18l-6-6 6-6'],
    'chevron-up': ['M18 15l-6-6-6 6'],
    search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M21 21l-4.35-4.35'],
    x: ['M18 6L6 18', 'M6 6l12 12'],
    columns: ['M3 4h5v16H3z', 'M9.5 4h5v16h-5z', 'M16 4h5v16h-5z'],
    list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
    filter: ['M3 4h18l-7 8v6l-4 2v-8z'],
    alert: ['M12 3l9 16H3z', 'M12 9v4', 'M12 17h.01'],
    grip: ['M9 5h.01', 'M9 12h.01', 'M9 19h.01', 'M15 5h.01', 'M15 12h.01', 'M15 19h.01'],
    more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
    'arrow-up': ['M12 19V5', 'M6 11l6-6 6 6'],
    'arrow-down': ['M12 5v14', 'M6 13l6 6 6-6'],
    check: ['M20 6L9 17l-5-5'],
    inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'],
    plus: ['M12 5v14', 'M5 12h14'],
};

const paths = computed(() => PATHS[props.name] ?? []);
</script>

<template>
    <svg
        :width="size"
        :height="size"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
        class="bk-icon"
    >
        <path v-for="(d, i) in paths" :key="i" :d="d" />
    </svg>
</template>

<style scoped>
.bk-icon {
    display: block;
    flex: none;
}
</style>
