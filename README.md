# board-kit

Trello-style **pipeline** and **list** views for Vue 3, built to be dropped into
any of the client-starter apps (TQK Platform, ThreeStep OS, Glampot OS, NewBond
OS, KrakenOS, client-starter itself) and used more than once per app.

- **Pipeline view by default**, list view one tap away, and the choice is remembered.
- **Swimlanes** — real horizontal rows, all sharing one grid and one scroll.
- **Drag between columns and reorder inside one**, built for a thumb first.
- **Filters, search and WIP limits**, with honest counts.
- **A card drawer** - bottom sheet on a phone, side panel on desktop.
- **Live updates**: a ticking "Updated 40s ago", and a moment of highlight on
  every card that changed while you were looking at it.
- **Light and dark**, because it ships no colours of its own - it reads your
  app's design tokens and follows whatever the app is doing.
- **It never touches your data.** A drop emits an event; the props stay the truth.

---

## Install

It is a public repo, so no token and no registry setup:

```
npm install github:phillipchoong/board-kit#v0.1.0
```

Then **one line** in the app's `vite.config.js`:

```js
export default defineConfig({
    // ...
    optimizeDeps: { exclude: ['board-kit'] },
});
```

That line is required. The package ships raw `.vue` source rather than a build
(see [Why source and not a bundle](#why-source-and-not-a-bundle)), and Vite's
dependency pre-bundler runs esbuild, which cannot parse a `.vue` file. Excluding
the package sends it to `@vitejs/plugin-vue` instead, which can.

Nothing else. No CSS import — the styles ride along with the components.

---

## Quick start

```vue
<script setup>
import { router } from '@inertiajs/vue3';
import { BoardView } from 'board-kit';

const props = defineProps({ leads: Array });

const COLUMNS = [
    { id: 'new', title: 'New', tone: 'info' },
    { id: 'contacted', title: 'Contacted' },
    { id: 'quoted', title: 'Quoted' },
    { id: 'won', title: 'Won', tone: 'success' },
    { id: 'lost', title: 'Lost', tone: 'danger' },
];

const cards = computed(() =>
    props.leads.map((lead) => ({
        id: lead.id,
        columnId: lead.stage,
        position: lead.position,
        title: lead.name,
        subtitle: lead.phone,
        updatedAt: lead.updated_at,
    })),
);

function onMove(move) {
    router.patch(`/leads/${move.cardId}/stage`, {
        stage: move.to.columnId,
        order: move.orderedIds,
    }, {
        preserveScroll: true,
        onError: move.revert,
    });
}
</script>

<template>
    <BoardView :columns="COLUMNS" :cards="cards" storage-key="sales" @move="onMove" />
</template>
```

That is a complete, working board. Everything below is optional.

---

## The `move` event

This is the whole contract with your server, so it is worth reading once.

A move carries **three different answers to "where did it land"**, because the
kit does not know how your table stores order. Use whichever fits:

| Field | Use it when |
|---|---|
| `to.columnId`, `to.laneId` | Always. This is the stage (and lane) the card is now in. |
| `orderedIds` | Your table stores order and you want it to be right. The full id order of the destination column after the move. **Cannot drift.** |
| `position` | Rows carry a sortable number already. A value that sorts strictly between the two neighbours. `null` when neither neighbour had one. |
| `to.index` | Your table stores no order at all and you only care that the stage changed. |

Full payload:

```js
{
  cardId: '42',                 // string, always
  card: { ... },                // the original object you passed in
  from: { columnId, laneId, index },
  to:   { columnId, laneId, index },
  beforeId: '41', afterId: '43',   // the neighbours it landed between, or null
  position: 41.5,                  // or null
  needsRenumber: false,            // true when the gap got too small to split
  orderedIds: ['41', '42', '43'],
  changedColumn: true,
  changedLane: false,
  revert(),                        // call on failure
  confirm(),                       // optional; see below
}
```

### The optimistic move, and when to call back

The card jumps to its new column **immediately**, before your request finishes.
Then one of two things happens:

- **It worked.** Reload your data as normal. The override clears itself the
  moment the incoming `cards` prop agrees with it. **You do not have to call
  anything.** `confirm()` exists for the rare caller who wants to be explicit.
- **It failed.** Call `move.revert()`. The card goes back where it came from.

If you neither reload nor revert, the card stays where the user put it until
something changes the props. That is deliberate — snapping a card back for no
visible reason is worse than being briefly out of date.

To turn all of this off and drive the board purely from props, pass
`:optimistic="false"`.

### `needsRenumber`

Only relevant if you store `position` as a float and keep halving the gap. After
enough moves between the same two cards the gap stops being splittable, and this
flag goes true. Renumber that column (`0, 1, 2, ...`) when you see it — or just
use `orderedIds` and never think about it.

---

## The card drawer

Tapping a card emits `select` and nothing else, until you ask for a drawer:

```vue
<BoardView :columns="COLUMNS" :cards="cards" drawer @move="onMove">
    <template #drawer="{ card, close }">
        <MyLeadDetails :lead="card.raw" @saved="close" />
    </template>
</BoardView>
```

- **Bottom sheet under 768px, side panel above it.** Not a centred modal: on a
  phone that strands a card-sized dialog in mid-air, and on a desktop it hides
  the board behind the thing you are reading about.
- Closes on Escape, on the scrim, on the close button, and on a swipe down when
  it is a sheet. The swipe handle is the header alone, so the content inside can
  still be scrolled.
- Focus moves in, Tab is trapped inside, and focus goes back to the card you
  opened when it closes.
- The page behind it is pinned, and the scroll position is restored afterwards.
- **It holds the card's id, not a copy.** Move the card from inside the drawer
  and the header follows it; if the card disappears from your data, the drawer
  closes instead of showing a stale copy.
- The header carries the move menu, so a card opened on a phone can be moved
  without ever closing the panel.

Slots: `drawer` (`{ card, close }`), `drawer-title`, `drawer-actions`,
`drawer-footer`. With no `drawer` slot you still get a sensible default panel
listing the stage, lane, summary and updated time.

There is **no back-button integration**, deliberately. Back-to-close is the
expected gesture on Android, but the way to build it - pushing a history entry -
collides with how Inertia manages history, and a `popstate` carrying no Inertia
page state makes it hard-reload the page.

---

## Live updates

A board that someone else is also using has to say two things: how old what you
are looking at is, and what just changed.

```vue
<BoardView
    :columns="COLUMNS"
    :cards="cards"
    :updated-at="fetchedAt"
    :refreshing="refreshing"
    show-refresh
    @refresh="reload"
    @move="onMove"
/>
```

**Freshness.** `updatedAt` renders as a live-ticking "Updated 40s ago" in the
toolbar. It updates itself on a shared 30-second clock that stops while the tab
is hidden - one interval for the whole page, however many boards are on it. Card
timestamps tick on the same clock, so `formatUpdated` stays honest without you
re-rendering anything.

**Highlights.** Whenever the `cards` prop changes, the board diffs it against
what it had and gives each changed card about a second and a half of highlight:

| | |
|---|---|
| green, "New" | the card was not there before |
| blue, "Moved" | it changed column or lane |
| purple, "Updated" | something it displays changed |

A card gets one kind only, most significant first, and the batch is announced to
screen readers as "3 cards: 1 new, 1 moved, 1 updated". The first render never
highlights anything - every card is technically new then, and a board that
lights up entirely on open has said nothing.

**Your own moves never flash.** The card you just dragged comes back from the
server changed, but that is not news; highlighting it is how the highlight stops
meaning "someone else touched this".

The highlight compares what the card *shows* - title, subtitle, summary, badges,
tags, meta, `updatedAt` - not the whole row. Flashing a card because some
`sync_token` moved teaches people to ignore it.

Turn it off with `:highlight-changes="false"`, or change the timing with
`:flash-duration="1600"`.

**Polling is yours, not the kit's.** The usual Inertia shape:

```js
const refreshing = ref(false);

function reload() {
    router.reload({
        only: ['leads'],
        onStart: () => (refreshing.value = true),
        onFinish: () => {
            refreshing.value = false;
            fetchedAt.value = new Date().toISOString();
        },
    });
}

useIntervalFn(reload, 30000);   // or a websocket, or nothing at all
```

Nothing about a refresh disturbs the user: scroll position, collapsed columns,
filters, an open drawer and a move still in flight all survive it.

---

## Swimlanes

Pass `lanes` and every stage repeats once per lane, in **one grid** so the
columns stay lined up and every lane shares the same sideways scroll.

```vue
<BoardView
    :columns="COLUMNS"
    :cards="cards"
    :lanes="[
        { id: 'phillip', title: 'Phillip', description: 'Platform' },
        { id: 'sophia', title: 'Sophia' },
    ]"
    @move="onMove"
/>
```

Each card needs a `laneId` (or `lane`). A card whose lane does not exist lands in
the first lane rather than disappearing.

- Dragging across lanes reassigns the card. `:lane-draggable="false"` stops that
  and keeps drags inside their own row.
- Lanes and columns both collapse, and both remember it (with a `storage-key`).
- Collapsing a **column** collapses it in every lane at once — it is one column.
- WIP limits are per column **across all lanes**: a limit of 5 means five in that
  stage, not five per row.

---

## Filters, search and WIP limits

```vue
<BoardView
    :columns="COLUMNS"
    :cards="cards"
    :filters="[
        { key: 'priority', label: 'Priority', options: [
            { value: 'P0', label: 'P0' }, { value: 'P1', label: 'P1' },
        ]},
        { key: 'owner', label: 'Owner', multiple: false, options: owners },
    ]"
/>
```

- A filter reads `card.meta[key]` first, then `card[key]`, then your original
  object. A card value that is itself an array matches if any element matches.
- **An empty selection means the filter is off**, never "match nothing".
- Option counts are measured with every *other* filter applied, so a count never
  promises rows that are not there.
- Search matches the title, subtitle, summary, tags, badges and everything in
  `meta` — all words must match, in any field.
- The toolbar always says **"N of M"** when anything is hidden. A filtered board
  that looks like an empty one is the failure this prevents.

**WIP limits** go on the column: `{ id: 'doing', title: 'Doing', limit: 3 }`.
The count chip turns amber at the limit and red with a warning triangle over it,
and the screen-reader text spells the state out — colour never carries it alone.
`limit-mode="block"` also refuses the drop; the default `"warn"` lets people go
over and tells them.

Counts show what is **rendered**; the limit is judged on the **unfiltered** total,
because the limit is a property of the stage and not of your current filter. When
those differ, the chip's tooltip says both.

---

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `columns` | Array | *required* | `{ id, title, tone?, limit?, description?, collapsible?, droppable? }` |
| `cards` | Array | `[]` | see below |
| `lanes` | Array | `null` | `{ id, title, description?, collapsible? }` |
| `filters` | Array | `[]` | `{ key, label, multiple?, options: [{ value, label }] }` |
| `storageKey` | String | `null` | remembers view, sort and collapse state |
| `draggable` | Boolean | `true` | |
| `laneDraggable` | Boolean | `true` | allow drags across lanes |
| `limitMode` | `'warn'` \| `'block'` | `'warn'` | |
| `fit` | Boolean \| `'auto'` | `'auto'` | fit all columns on screen instead of scrolling |
| `fitMaxColumns` | Number | `7` | how many columns `'auto'` will try to fit |
| `height` | `'auto'` \| `'fill'` | `'auto'` | `'fill'` scrolls the cards, not the page |
| `bleed` | String | `null` | page gutter to bleed into, e.g. `'1rem'` |
| `columnWidth` | String | `null` | overrides `--bk-col-width` |
| `optimistic` | Boolean | `true` | |
| `showToolbar` / `showSearch` / `showViewToggle` | Boolean | `true` | |
| `showCardMenu` | Boolean | `true` | **leave this on**; it is the keyboard path |
| `showDragHandle` | Boolean | `false` | draw a grip on each card |
| `groupListByLane` | Boolean | `true` | |
| `drawer` | Boolean | `false` | open cards into a drawer |
| `updatedAt` | String \| Number \| Date | `null` | shows a ticking "Updated N ago" |
| `refreshing` | Boolean | `false` | spins the refresh button |
| `showRefresh` | Boolean | `false` | show a refresh button that emits `refresh` |
| `highlightChanges` | Boolean | `true` | flash cards that changed |
| `flashDuration` | Number | `1600` | how long a flash lasts, in ms |
| `listColumns` | Array | `null` | see [List view](#list-view) |
| `formatUpdated` | Function | `null` | `(iso) => string` |
| `searchPlaceholder`, `emptyText` | String | | |
| `touchDelay` | Number | `350` | ms of hold before a card lifts on touch |

**Models** (all optional, all work uncontrolled): `v-model:view`
(`'board'`/`'list'`), `v-model:query`, `v-model:activeFilters`, `v-model:sort`
(`{ key, dir }`).

**Card shape** — everything but `id` and `columnId` is optional:

```js
{
  id, columnId,            // or `column` / `stage` / `status`
  laneId,                  // or `lane`
  position,                // number; omit if your table has no order
  title, subtitle, summary,
  badges: [{ label, tone }] | ['string'],
  tags: ['string'],
  meta: { anything },      // what filters and sorts read
  updatedAt, href,
  draggable: false,        // pin one card in place
}
```

`tone` is one of `neutral`, `brand`, `info`, `success`, `warning`, `danger`,
`special` — the same names as client-starter's `statuses.js`.

## Events

| Event | Payload |
|---|---|
| `move` | see [The `move` event](#the-move-event) |
| `select` | the **original** card object you passed in |
| `refresh` | the refresh button was used |

## Slots

| Slot | Props | |
|---|---|---|
| `card` | `{ card }` | replaces the card body; the wrapper, drag target and menu stay |
| `card-title` | `{ card }` | replaces just the title line |
| `actions` | — | your own buttons in the toolbar |
| `cell-<key>` | `{ card, column, value }` | one cell of the list view |
| `drawer` | `{ card, close }` | the drawer's body |
| `drawer-title` | `{ card }` | the drawer's heading |
| `drawer-actions` | `{ card, close }` | buttons in the drawer header |
| `drawer-footer` | `{ card, close }` | a sticky footer in the drawer |

---

## List view

The same cards, the same filters, laid out to be read. Sortable headers, columns
that drop out at their own breakpoints instead of forcing a sideways scroll, and
the move menu still on every row — it is not a read-only view.

Give it your own columns when the defaults are not right:

```js
const listColumns = [
    { key: 'column', label: 'Stage', width: '120px', sortable: true, get: (c) => stageLabel(c.columnId) },
    { key: 'title', label: 'Lead', sortable: true, get: (c) => c.title },
    { key: 'value', label: 'Value', align: 'end', hide: 'sm', sortable: true, get: (c) => money(c.meta.value) },
];
```

`hide: 'sm'` drops the column below 640px, `'md'` below 768px. Render anything
you like in a cell with the `cell-<key>` slot.

With lanes on, rows are grouped under their lane and sorted **within** it —
sorting across lanes would throw the grouping away.

---

## Theming, light and dark

The kit ships **no colours**, so light and dark are not a feature it has - they
are whatever your app is already doing. Nothing to configure and no theme prop:
switch the app to dark and the board, the cards, the drawer, the popovers and
the change highlights all go with it. It reads the variables client-starter's
`semantic.css` already defines, so in any of those apps it inherits the brand and
the dark mode with nothing to configure: `--surface-card`, `--surface-sunken`,
`--surface-hover`, `--text-strong`, `--text-body`, `--text-muted`, `--text-faint`,
`--border-subtle`, `--border-default`, `--border-focus`, `--radius-*`,
`--shadow-*`, `--surface-overlay`, `--shadow-modal`, and the status ramps (`--success-bg` / `--success-700` /
`--success-border`, and the same three for warning, danger, info, special,
neutral). Every one has a sane fallback, so it also works in a plain Vite app.

**One line for the host page.** Filtering a board can remove enough cards to
make the page short enough to lose its scrollbar, and the layout then jumps
sideways by the scrollbar's width. That is the page, not the board, and the fix
belongs in the app:

```css
html {
    scrollbar-gutter: stable;
}
```

Layout is four variables, set on the board element and overridable from outside:

| | Default | |
|---|---|---|
| `--bk-col-width` | `300px`, `78vw` under 768px | column width |
| `--bk-col-collapsed` | `48px` | a collapsed column |
| `--bk-gap` | `12px` | gap between columns |
| `--bk-bleed` | `0px` | how far to bleed past the page gutter |

---

## Mobile and accessibility

Both were the starting point, not a pass at the end.

- **Hold 350ms to pick a card up.** A quick swipe scrolls the board instead; a
  finger that moves more than 8px during the hold cancels the drag. Without
  that, every attempt to scroll a column starts a drag.
- **One column fills the phone screen** at 78vw, scroll-snapped, with the next
  stage peeking in so it is obvious there is more.
- **The board auto-scrolls** when a held card nears the edge — the only way to
  cross seven stages on a 390px screen.
- **Every card has a move menu**, so the board is fully usable with a keyboard,
  a screen reader, or one thumb, and never needs a drag. Tap targets are 40px
  and up, padded out rather than drawn that big.
- Lists are `role="list"` with real labels, sortable headers carry `aria-sort`,
  and each move is announced to a live region.
- Column state is written in colour **and** an icon **and** words, so it survives
  deuteranopia.
- The search input is 16px on small screens, because anything smaller makes iOS
  zoom the page on focus.

---

## Development

```
npm install
npm run dev     # playground on http://localhost:5173
npm test
npm run build   # compile check
```

The playground has three boards — a 7-stage sales pipeline, a swimlane ops board
with WIP limits and filters, and a 3-stage board that fits the screen — plus a
live log of every `move` payload and a switch that makes every save fail, so you
can watch a revert actually revert.

---

## Decisions

### Why source and not a bundle

The package is installed straight from git. A built `dist/` would need a
`prepare` script running on every `npm ci` in every consuming app, and it would
extract the CSS into a file each app then has to import. Shipping source costs
one line of Vite config and nothing else.

### Why SortableJS and not a hand-rolled drag

Touch. `delay` + `delayOnTouchOnly` + `touchStartThreshold` are exactly the
hold-to-drag behaviour a board needs on a phone, and auto-scrolling a container
while a card is held is the part everyone gets wrong. dnd-kit — what the NBOS
ops-console reference uses — is React-only.

Sortable moves DOM nodes and Vue owns them, so on drop the kit puts the node back
exactly where Vue had it and lets the state change drive the real re-render.
Skipping that is how cards end up duplicated.

### Why the visible index is translated before it is emitted

Sortable counts the cards it can see, and a filtered column is not showing all of
them. "Slot 2" of a filtered column means *after the second visible card*, which
may be slot 9 in the real one. The kit resolves the drop through that card's
identity in the unfiltered list before emitting anything. Without it,
`orderedIds` would quietly tell your server to forget the order of every card the
filter was hiding.

### Why your own moves do not flash

A highlight is only worth anything if it means "someone else changed this".
Flashing the card the user just dragged - which is a change, technically - is
how people learn to ignore it. Cards moved locally are exempt for eight seconds,
long enough for a round trip.

### Why no backend

The five apps that will use this store stages in five different shapes. A trait
and a migration would force one, and would be the first thing every screen worked
around. The `move` payload answers the "where did it land" question three ways
instead, and each app answers it the way its own table already works.
