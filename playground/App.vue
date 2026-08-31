<script setup>
/**
 * The playground. Three boards, an event log, and a switch that makes every
 * save fail - the two things you cannot check by reading the code: what the
 * `move` payload actually contains, and whether a rejected move really does
 * put the card back.
 */
import { computed, reactive, ref } from 'vue';
import { BoardView } from 'board-kit';
import {
    INTAKE_CARDS,
    INTAKE_COLUMNS,
    OPS_CARDS,
    OPS_COLUMNS,
    OPS_FILTERS,
    OPS_LANES,
    SALES_CARDS,
    SALES_COLUMNS,
    SALES_FILTERS,
} from './data.js';

const BOARDS = {
    sales: {
        label: 'Sales pipeline',
        note: '7 stages, no lanes. Scrolls sideways; one stage per screen on a phone.',
        columns: SALES_COLUMNS,
        lanes: null,
        filters: SALES_FILTERS,
        cards: reactive([...SALES_CARDS]),
    },
    ops: {
        label: 'Ops board',
        note: 'Swimlanes by owner, WIP limits on three stages, two filters.',
        columns: OPS_COLUMNS,
        lanes: OPS_LANES,
        filters: OPS_FILTERS,
        cards: reactive([...OPS_CARDS]),
    },
    intake: {
        label: 'Intake',
        note: 'Three stages, so it fits the screen instead of scrolling.',
        columns: INTAKE_COLUMNS,
        lanes: null,
        filters: [],
        cards: reactive([...INTAKE_CARDS]),
    },
};

const which = ref('sales');
const board = computed(() => BOARDS[which.value]);

const failNext = ref(false);
const limitMode = ref('warn');
const log = ref([]);

const formatUpdated = (iso) => {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    const h = ms / 3600000;
    if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}m ago`;
    if (h < 24) return `${Math.round(h)}h ago`;
    return `${Math.round(h / 24)}d ago`;
};

/**
 * Stands in for the endpoint. The real one would PATCH and then reload; here
 * the props are mutated directly, which is the same thing from the board's
 * point of view - it watches its `cards` prop and drops the override once the
 * data agrees.
 */
function onMove(event) {
    log.value = [
        {
            at: new Date().toLocaleTimeString(),
            cardId: event.cardId,
            to: `${event.to.columnId}${event.to.laneId === '__bk_all__' ? '' : ' / ' + event.to.laneId}`,
            index: event.to.index,
            position: event.position === null ? 'none' : Number(event.position.toFixed(4)),
            neighbours: `${event.beforeId ?? 'start'} -> ${event.afterId ?? 'end'}`,
            ordered: event.orderedIds.join(', '),
        },
        ...log.value,
    ].slice(0, 8);

    if (failNext.value) {
        event.revert();
        return;
    }

    const card = board.value.cards.find((c) => String(c.id) === event.cardId);
    if (!card) return;
    card.columnId = event.to.columnId;
    if (board.value.lanes) card.laneId = event.to.laneId;
    event.orderedIds.forEach((id, i) => {
        const target = board.value.cards.find((c) => String(c.id) === id);
        if (target) target.position = i;
    });
    card.updatedAt = new Date().toISOString();
}

const selected = ref(null);
</script>

<template>
    <div class="page">
        <header class="head">
            <div>
                <h1>board-kit</h1>
                <p class="note">{{ board.note }}</p>
            </div>

            <div class="controls">
                <div class="seg" role="group" aria-label="Demo board">
                    <button
                        v-for="(b, id) in BOARDS"
                        :key="id"
                        type="button"
                        :class="{ on: which === id }"
                        :aria-pressed="which === id"
                        @click="which = id"
                    >
                        {{ b.label }}
                    </button>
                </div>

                <label class="check">
                    <input v-model="failNext" type="checkbox" />
                    Make every save fail
                </label>

                <label class="check">
                    <input v-model="limitMode" type="checkbox" true-value="block" false-value="warn" />
                    Block drops over the WIP limit
                </label>
            </div>
        </header>

        <BoardView
            :key="which"
            :columns="board.columns"
            :cards="board.cards"
            :lanes="board.lanes"
            :filters="board.filters"
            :limit-mode="limitMode"
            :storage-key="`demo-${which}`"
            :format-updated="formatUpdated"
            @move="onMove"
            @select="(card) => (selected = card)"
        />

        <p v-if="selected" class="selected">
            Opened: <strong>{{ selected.title }}</strong>
            <button type="button" @click="selected = null">close</button>
        </p>

        <section class="log">
            <h2>move events</h2>
            <p v-if="!log.length" class="note">Drag a card, or use the menu on one, and the payload shows up here.</p>
            <table v-else>
                <thead>
                    <tr>
                        <th>time</th>
                        <th>card</th>
                        <th>to</th>
                        <th>index</th>
                        <th>position</th>
                        <th>between</th>
                        <th>orderedIds</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(row, i) in log" :key="i">
                        <td>{{ row.at }}</td>
                        <td>{{ row.cardId }}</td>
                        <td>{{ row.to }}</td>
                        <td>{{ row.index }}</td>
                        <td>{{ row.position }}</td>
                        <td>{{ row.neighbours }}</td>
                        <td class="ids">{{ row.ordered }}</td>
                    </tr>
                </tbody>
            </table>
        </section>
    </div>
</template>

<style scoped>
.page {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px 16px 60px;
}

.head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
}

h1 {
    margin: 0;
    font-size: 20px;
    color: var(--text-strong);
}

h2 {
    margin: 0 0 8px;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
}

.note {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-muted);
}

.controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
}

.seg {
    display: inline-flex;
    padding: 2px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-button);
    background: var(--surface-sunken);
}

.seg button {
    min-height: 30px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--radius-xs);
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
}

.seg button.on {
    background: var(--surface-card);
    color: var(--text-strong);
    font-weight: 600;
    box-shadow: var(--shadow-xs);
}

.check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
}

.selected {
    margin: 12px 0 0;
    font-size: 13px;
}

.selected button {
    margin-left: 8px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-card);
    color: inherit;
    font: inherit;
    font-size: 12px;
    padding: 2px 8px;
    cursor: pointer;
}

.log {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid var(--border-subtle);
}

.log table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.log th,
.log td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--border-subtle);
    text-align: left;
    white-space: nowrap;
}

.log th {
    color: var(--text-faint);
    font-weight: 600;
}

.ids {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
