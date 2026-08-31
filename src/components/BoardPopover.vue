<script setup>
/**
 * Trigger plus panel. Owns the open state, the placement and the panel styling
 * so the move menu and the filter menus cannot drift apart.
 */
import { ref } from 'vue';
import { usePopover } from '../composables/usePopover.js';

const props = defineProps({
    width: { type: Number, default: 232 },
    maxHeight: { type: Number, default: 260 },
    label: { type: String, default: 'Options' },
});

const trigger = ref(null);
const panel = ref(null);
const { open, style, toggle, close } = usePopover(trigger, panel, {
    width: props.width,
    maxHeight: props.maxHeight,
});

defineExpose({ close });
</script>

<template>
    <div class="bk-popover-root" data-bk-nodrag>
        <div ref="trigger" class="bk-popover-trigger-wrap">
            <slot name="trigger" :open="open" :toggle="toggle" :label="label" />
        </div>

        <Teleport to="body">
            <div
                v-if="open"
                ref="panel"
                class="bk-popover"
                :style="[style, { inlineSize: `${width}px` }]"
                role="menu"
                :aria-label="label"
                @click.stop
            >
                <slot :close="close" />
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
/* `flex: none` on both: these sit inside flex rows (the toolbar, a card head)
   that would otherwise shrink the trigger below the width it reserved for
   itself, which puts the reflow straight back. */
.bk-popover-root,
.bk-popover-trigger-wrap {
    display: flex;
    flex: none;
    min-inline-size: 0;
}
</style>

<style>
/* Not scoped: the panel is teleported to <body>, outside this component's
   scope. Every class here is prefixed, so it cannot collide with a host app. */
.bk-popover {
    position: fixed;
    z-index: 60;
    max-block-size: min(60vh, 340px);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px;
    border: 1px solid var(--border-subtle, #e4e7ec);
    border-radius: var(--radius-md, 8px);
    background: var(--surface-raised, #ffffff);
    box-shadow: var(--shadow-lg, 0 6px 16px rgb(16 24 40 / 0.1), 0 12px 28px rgb(16 24 40 / 0.12));
    color: var(--text-body, #344054);
    font-size: 13px;
}

.bk-popover-label {
    margin: 6px 8px 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-faint, #98a2b3);
}

.bk-popover-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    inline-size: 100%;
    /* 40px minimum: a thumb target, not a mouse target. */
    min-block-size: 40px;
    padding: 8px 10px;
    border: 0;
    border-radius: var(--radius-sm, 5px);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
}

.bk-popover-item:hover:not(:disabled),
.bk-popover-item:focus-visible:not(:disabled) {
    background: var(--surface-hover, #f2f4f7);
}

.bk-popover-item:disabled {
    color: var(--text-faint, #98a2b3);
    cursor: default;
}

.bk-popover-item-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bk-popover-sep {
    block-size: 1px;
    margin: 4px 6px;
    background: var(--border-subtle, #e4e7ec);
}
</style>
