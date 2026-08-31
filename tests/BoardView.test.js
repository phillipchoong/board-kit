import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import BoardView from '../src/components/BoardView.vue';

// Sortable needs a real pointer and a real layout; happy-dom has neither, so it
// is stubbed out. What it would have produced - the raw drop payload - is fed
// straight to `resolveDrop` in move.test.js instead, which is where the logic
// that matters actually lives.
vi.mock('sortablejs', () => ({
    default: { create: () => ({ destroy() {}, option() {} }) },
}));

const COLUMNS = [
    { id: 'todo', title: 'To do' },
    { id: 'doing', title: 'Doing', limit: 2 },
    { id: 'done', title: 'Done' },
];

const CARDS = [
    { id: 1, columnId: 'todo', title: 'Restore the dump', meta: { owner: 'phillip' } },
    { id: 2, columnId: 'doing', title: 'Rotate the key', meta: { owner: 'phillip' } },
    { id: 3, columnId: 'doing', title: 'Chase the answer', meta: { owner: 'sophia' } },
    { id: 4, columnId: 'doing', title: 'Fix the sidebar', meta: { owner: 'sophia' } },
];

const mountBoard = (props = {}) =>
    mount(BoardView, {
        attachTo: document.body,
        props: { columns: COLUMNS, cards: CARDS, ...props },
    });

const textOf = (wrapper) => wrapper.text();

describe('BoardView', () => {
    it('renders one header per column and one card per card', () => {
        const board = mountBoard();
        expect(board.findAll('.bk-col-head')).toHaveLength(3);
        expect(board.findAll('[data-bk-card]')).toHaveLength(4);
        board.unmount();
    });

    it('counts what it renders, and shows the limit beside it', () => {
        const board = mountBoard();
        const counts = board.findAll('.bk-col-count').map((c) => c.text());
        expect(counts[0]).toContain('1');
        expect(counts[1]).toContain('3/2');
        board.unmount();
    });

    it('marks a column that is over its limit, in words as well as colour', () => {
        const board = mountBoard();
        const over = board.findAll('.bk-col-count')[1];
        expect(over.classes()).toContain('bk-col-count--over');
        expect(over.text()).toContain('over the limit of 2');
        board.unmount();
    });

    it('search hides cards and says how many of how many are left', async () => {
        const board = mountBoard();
        await board.find('.bk-search-input').setValue('sidebar');
        expect(board.findAll('[data-bk-card]')).toHaveLength(1);
        expect(textOf(board)).toContain('1 of 4');
        board.unmount();
    });

    it('a filter with nothing selected hides nothing', async () => {
        const board = mountBoard({
            filters: [{ key: 'owner', label: 'Owner', options: [{ value: 'phillip', label: 'Phillip' }] }],
        });
        expect(board.findAll('[data-bk-card]')).toHaveLength(4);
        await board.setProps({ activeFilters: { owner: [] } });
        expect(board.findAll('[data-bk-card]')).toHaveLength(4);
        await board.setProps({ activeFilters: { owner: ['sophia'] } });
        expect(board.findAll('[data-bk-card]')).toHaveLength(2);
        board.unmount();
    });

    it('warns about cards whose stage the board does not have', () => {
        const board = mountBoard({ cards: [...CARDS, { id: 9, columnId: 'archived', title: 'Old' }] });
        expect(textOf(board)).toContain('does not have');
        expect(textOf(board)).toContain('archived');
        board.unmount();
    });

    it('switches to the list view and back', async () => {
        const board = mountBoard();
        expect(board.find('.bk-pipeline').exists()).toBe(true);
        await board.findAll('.bk-view-btn')[1].trigger('click');
        expect(board.find('table.bk-table').exists()).toBe(true);
        expect(board.find('.bk-pipeline').exists()).toBe(false);
        board.unmount();
    });

    it('opens a card by its title', async () => {
        const board = mountBoard();
        await board.find('.bk-card-title').trigger('click');
        expect(board.emitted('select')[0][0]).toMatchObject({ id: 1, title: 'Restore the dump' });
        board.unmount();
    });
});

describe('moving a card through the menu', () => {
    async function openFirstMenu(board) {
        await board.findAll('.bk-card-menu-trigger')[0].trigger('click');
        await new Promise((r) => setTimeout(r, 0));
        return document.querySelector('.bk-popover');
    }

    it('emits a move naming the destination, the neighbours and the new order', async () => {
        const board = mountBoard();
        const panel = await openFirstMenu(board);
        const doing = [...panel.querySelectorAll('.bk-popover-item')].find((b) => b.textContent.includes('Doing'));
        doing.click();
        await board.vm.$nextTick();

        const move = board.emitted('move')[0][0];
        expect(move.cardId).toBe('1');
        expect(move.to.columnId).toBe('doing');
        expect(move.changedColumn).toBe(true);
        expect(move.orderedIds).toEqual(['2', '3', '4', '1']);
        board.unmount();
    });

    it('shows the card in its new column straight away, before any save', async () => {
        const board = mountBoard();
        const panel = await openFirstMenu(board);
        [...panel.querySelectorAll('.bk-popover-item')].find((b) => b.textContent.includes('Doing')).click();
        await board.vm.$nextTick();

        const counts = board.findAll('.bk-col-count').map((c) => c.text());
        expect(counts[0]).toContain('0');
        expect(counts[1]).toContain('4/2');
        board.unmount();
    });

    it('revert() puts the card back where it came from', async () => {
        const board = mountBoard();
        const panel = await openFirstMenu(board);
        [...panel.querySelectorAll('.bk-popover-item')].find((b) => b.textContent.includes('Doing')).click();
        await board.vm.$nextTick();

        board.emitted('move')[0][0].revert();
        await board.vm.$nextTick();

        expect(board.findAll('.bk-col-count')[0].text()).toContain('1');
        board.unmount();
    });

    it('drops the override on its own once the incoming cards agree', async () => {
        const board = mountBoard();
        const panel = await openFirstMenu(board);
        [...panel.querySelectorAll('.bk-popover-item')].find((b) => b.textContent.includes('Doing')).click();
        await board.vm.$nextTick();

        // The caller saved and reloaded. Nothing was confirmed by hand.
        await board.setProps({
            cards: CARDS.map((c) => (c.id === 1 ? { ...c, columnId: 'doing' } : c)),
        });
        expect(board.findAll('.bk-col-count')[1].text()).toContain('4/2');

        // ...and now a genuine server-side change still shows through.
        await board.setProps({
            cards: CARDS.map((c) => (c.id === 1 ? { ...c, columnId: 'done' } : c)),
        });
        expect(board.findAll('.bk-col-count')[2].text()).toContain('1');
        board.unmount();
    });
});

describe('swimlanes', () => {
    const LANES = [
        { id: 'phillip', title: 'Phillip' },
        { id: 'sophia', title: 'Sophia' },
    ];
    const LANE_CARDS = CARDS.map((c) => ({ ...c, laneId: c.meta.owner }));

    it('renders a heading and a body row per lane', () => {
        const board = mountBoard({ lanes: LANES, cards: LANE_CARDS });
        expect(board.findAll('.bk-lane-head')).toHaveLength(2);
        // Two lanes x three columns.
        expect(board.findAll('.bk-list')).toHaveLength(6);
        board.unmount();
    });

    it('collapsing a lane hides its cards but keeps its heading', async () => {
        const board = mountBoard({ lanes: LANES, cards: LANE_CARDS });
        await board.findAll('.bk-lane-toggle')[0].trigger('click');
        expect(board.findAll('.bk-lane-head')).toHaveLength(2);
        expect(board.findAll('.bk-list')).toHaveLength(3);
        board.unmount();
    });

    it('collapsing a column hides its cards in every lane at once', async () => {
        const board = mountBoard({ lanes: LANES, cards: LANE_CARDS });
        await board.findAll('.bk-col-toggle')[1].trigger('click');
        expect(board.findAll('.bk-col-body--collapsed')).toHaveLength(2);
        board.unmount();
    });

    it('groups the list view by lane', async () => {
        const board = mountBoard({ lanes: LANES, cards: LANE_CARDS });
        await board.findAll('.bk-view-btn')[1].trigger('click');
        const groups = board.findAll('.bk-group').map((g) => g.text());
        expect(groups[0]).toContain('Phillip');
        expect(groups[1]).toContain('Sophia');
        board.unmount();
    });
});
