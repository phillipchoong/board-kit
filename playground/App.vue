<script setup>
/**
 * The playground.
 *
 * Three boards, plus the four things you cannot check by reading the code:
 * what the `move` payload actually contains, whether a rejected move really
 * puts the card back, what an update arriving from someone else looks like,
 * and whether the whole thing holds up in light as well as dark.
 */
import { computed, onMounted, reactive, ref } from 'vue';
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
const selected = ref(null);

/* ------------------------------------------------------------------ theme */

const theme = ref('system');

function applyTheme() {
    const root = document.documentElement;
    if (theme.value === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme.value);
}

function setTheme(value) {
    theme.value = value;
    applyTheme();
}

onMounted(applyTheme);

/* ----------------------------------------------------------- live updates */

const fetchedAt = ref(new Date().toISOString());
const refreshing = ref(false);

const formatUpdated = (iso) => {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    const h = ms / 3600000;
    if (h < 1 / 60) return 'just now';
    if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}m ago`;
    if (h < 24) return `${Math.round(h)}h ago`;
    return `${Math.round(h / 24)}d ago`;
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];
let added = 0;

/**
 * Stands in for a poll, a websocket push, or a colleague on another laptop.
 * Three kinds of change at once, so all three highlight colours show up.
 */
function simulateRemote() {
    const cards = board.value.cards;
    const columns = board.value.columns;

    const mover = pick(cards);
    const target = pick(columns.filter((c) => c.id !== mover.columnId));
    mover.columnId = target.id;
    mover.updatedAt = new Date().toISOString();

    const edited = pick(cards.filter((c) => c.id !== mover.id));
    if (edited) {
        edited.title = edited.title.replace(/ \(edited( \d+)?\)$/, '') + ` (edited ${++added})`;
        edited.updatedAt = new Date().toISOString();
    }

    cards.push({
        id: `new-${added}-${Math.floor(Math.random() * 1e6)}`,
        columnId: columns[0].id,
        laneId: board.value.lanes ? board.value.lanes[0].id : undefined,
        position: cards.length,
        title: `Arrived from somewhere else #${added}`,
        subtitle: 'pushed while you were looking at the board',
        updatedAt: new Date().toISOString(),
    });

    fetchedAt.value = new Date().toISOString();
}

function refresh() {
    refreshing.value = true;
    setTimeout(() => {
        simulateRemote();
        refreshing.value = false;
    }, 700);
}

/* ------------------------------------------------------------------ moves */

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
    fetchedAt.value = new Date().toISOString();
}
</script>

<template>
    <div class="page">
        <header class="head">
            <div class="head-text">
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

                <div class="seg" role="group" aria-label="Theme">
                    <button
                        v-for="t in ['system', 'light', 'dark']"
                        :key="t"
                        type="button"
                        :class="{ on: theme === t }"
                        :aria-pressed="theme === t"
                        @click="setTheme(t)"
                    >
                        {{ t }}
                    </button>
                </div>

                <button type="button" class="btn" @click="simulateRemote">Someone else changed a card</button>

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
            :updated-at="fetchedAt"
            :refreshing="refreshing"
            show-refresh
            drawer
            @move="onMove"
            @refresh="refresh"
            @select="(card) => (selected = card)"
        >
            <template #drawer="{ card, close }">
                <dl class="facts">
                    <div><dt>Id</dt><dd>{{ card.id }}</dd></div>
                    <div><dt>Stage</dt><dd>{{ card.columnId }}</dd></div>
                    <div v-if="card.subtitle"><dt>Detail</dt><dd>{{ card.subtitle }}</dd></div>
                    <div v-if="card.summary"><dt>Notes</dt><dd>{{ card.summary }}</dd></div>
                    <div><dt>Updated</dt><dd>{{ formatUpdated(card.updatedAt) ?? '—' }}</dd></div>
                </dl>
                <p class="note">
                    This whole panel is a slot. Move the card with the menu above and watch the header follow it,
                    then close with Escape, the scrim, or a swipe down on a phone.
                </p>
                <div class="drawer-actions">
                    <button type="button" class="btn" @click="close">Close</button>
                </div>
            </template>
        </BoardView>

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

/* Rows, not a wrapping row. Each board's description is a different length, and
   with the controls beside it a longer one used to push them down the page - so
   the tab you just clicked moved out from under the pointer. The text block also
   reserves two lines, so switching boards never shifts the row below it. */
.head {
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
}

.head-text {
    min-height: 58px;
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
    text-transform: capitalize;
    cursor: pointer;
}

.seg button.on {
    background: var(--surface-card);
    color: var(--text-strong);
    font-weight: 600;
    box-shadow: var(--shadow-xs);
}

.btn {
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-button);
    background: var(--surface-card);
    color: var(--text-body);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
}

.btn:hover {
    background: var(--surface-hover);
}

.check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
}

.drawer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border-subtle);
}

.facts {
    display: grid;
    gap: 12px;
    margin: 0 0 14px;
}

.facts dt {
    margin-bottom: 2px;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.facts dd {
    margin: 0;
    color: var(--text-body);
    font-size: 13px;
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
