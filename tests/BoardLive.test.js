import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import BoardView from '../src/components/BoardView.vue';

vi.mock('sortablejs', () => ({
    default: { create: () => ({ destroy() {}, option() {} }) },
}));

const COLUMNS = [
    { id: 'todo', title: 'To do' },
    { id: 'doing', title: 'Doing' },
];

const CARDS = [
    { id: 1, columnId: 'todo', title: 'One' },
    { id: 2, columnId: 'todo', title: 'Two' },
];

const mountBoard = (props = {}) =>
    mount(BoardView, {
        attachTo: document.body,
        props: { columns: COLUMNS, cards: CARDS, ...props },
    });

const flashOf = (board, id) => {
    const card = board.find(`[data-bk-card="${id}"]`);
    return card.exists() ? card.classes().find((c) => c.startsWith('bk-card--flash-')) ?? null : null;
};

describe('highlighting changes that arrive from elsewhere', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('does not light up the whole board on the first render', () => {
        const board = mountBoard();
        expect(board.findAll('.bk-card--flash')).toHaveLength(0);
        board.unmount();
        vi.useRealTimers();
    });

    it('marks a card that arrived, one that moved and one that was edited', async () => {
        const board = mountBoard();
        await board.setProps({
            cards: [
                { id: 1, columnId: 'doing', title: 'One' },
                { id: 2, columnId: 'todo', title: 'Two, edited' },
                { id: 3, columnId: 'todo', title: 'Three' },
            ],
        });

        expect(flashOf(board, '1')).toBe('bk-card--flash-moved');
        expect(flashOf(board, '2')).toBe('bk-card--flash-updated');
        expect(flashOf(board, '3')).toBe('bk-card--flash-added');
        board.unmount();
        vi.useRealTimers();
    });

    it('says in words which kind of change it was, not just in colour', async () => {
        const board = mountBoard();
        await board.setProps({ cards: [...CARDS, { id: 3, columnId: 'todo', title: 'Three' }] });
        expect(board.find('[data-bk-card="3"] .bk-flash-chip').text()).toContain('New');
        board.unmount();
        vi.useRealTimers();
    });

    it('announces the batch to a screen reader', async () => {
        const board = mountBoard();
        await board.setProps({
            cards: [{ id: 1, columnId: 'doing', title: 'One' }, { id: 2, columnId: 'todo', title: 'Two' }],
        });
        expect(board.find('.bk-live').text()).toBe('1 card: 1 moved');
        board.unmount();
        vi.useRealTimers();
    });

    it('stops highlighting after the flash duration', async () => {
        const board = mountBoard({ flashDuration: 500 });
        await board.setProps({ cards: [...CARDS, { id: 3, columnId: 'todo', title: 'Three' }] });
        expect(flashOf(board, '3')).toBe('bk-card--flash-added');

        vi.advanceTimersByTime(600);
        await board.vm.$nextTick();
        expect(flashOf(board, '3')).toBe(null);
        board.unmount();
        vi.useRealTimers();
    });

    it('never highlights the move this user just made', async () => {
        const board = mountBoard();
        await board.findAll('.bk-card-menu-trigger')[0].trigger('click');
        await board.vm.$nextTick();
        const panel = document.querySelector('.bk-popover');
        [...panel.querySelectorAll('.bk-popover-item')].find((b) => b.textContent.includes('Doing')).click();
        await board.vm.$nextTick();

        // The save landed and the data came back agreeing with it.
        await board.setProps({
            cards: [{ id: 1, columnId: 'doing', title: 'One' }, { id: 2, columnId: 'todo', title: 'Two' }],
        });

        expect(flashOf(board, '1')).toBe(null);
        board.unmount();
        vi.useRealTimers();
    });

    it('can be turned off entirely', async () => {
        const board = mountBoard({ highlightChanges: false });
        await board.setProps({ cards: [...CARDS, { id: 3, columnId: 'todo', title: 'Three' }] });
        expect(board.findAll('.bk-card--flash')).toHaveLength(0);
        board.unmount();
        vi.useRealTimers();
    });
});

describe('freshness', () => {
    it('shows nothing when no timestamp is given', () => {
        const board = mountBoard();
        expect(board.find('.bk-age').exists()).toBe(false);
        board.unmount();
    });

    it('shows how old the data is', () => {
        const board = mountBoard({ updatedAt: new Date(Date.now() - 120000).toISOString() });
        expect(board.find('.bk-age').text()).toBe('Updated 2m ago');
        board.unmount();
    });

    it('says it is refreshing instead, and disables the button while it does', () => {
        const board = mountBoard({ updatedAt: new Date().toISOString(), refreshing: true, showRefresh: true });
        expect(board.find('.bk-age').text()).toBe('Refreshing');
        expect(board.find('.bk-refresh').attributes('disabled')).toBeDefined();
        board.unmount();
    });

    it('emits refresh when the button is used', async () => {
        const board = mountBoard({ showRefresh: true });
        await board.find('.bk-refresh').trigger('click');
        expect(board.emitted('refresh')).toHaveLength(1);
        board.unmount();
    });
});

describe('the card drawer', () => {
    it('stays shut unless the board is told to use one', async () => {
        const board = mountBoard();
        await board.find('.bk-card-title').trigger('click');
        expect(document.querySelector('.bk-drawer')).toBe(null);
        expect(board.emitted('select')).toHaveLength(1);
        board.unmount();
    });

    it('opens on a card, as a labelled modal dialog', async () => {
        const board = mountBoard({ drawer: true });
        await board.find('.bk-card-title').trigger('click');
        const drawer = document.querySelector('.bk-drawer');
        expect(drawer).not.toBe(null);
        expect(drawer.getAttribute('role')).toBe('dialog');
        expect(drawer.getAttribute('aria-modal')).toBe('true');
        expect(drawer.querySelector('.bk-drawer-title').textContent.trim()).toBe('One');
        board.unmount();
    });

    it('closes on the close button', async () => {
        const board = mountBoard({ drawer: true });
        await board.find('.bk-card-title').trigger('click');
        document.querySelector('.bk-drawer-close').click();
        await board.vm.$nextTick();
        expect(document.querySelector('.bk-drawer-title')).toBe(null);
        board.unmount();
    });

    /**
     * The drawer holds an id, not a copy of the card. Moving the card from
     * inside the drawer has to update the drawer's own header, and this is the
     * test that says so.
     */
    it('follows the card when the card changes underneath it', async () => {
        const board = mountBoard({ drawer: true });
        await board.find('.bk-card-title').trigger('click');
        await board.setProps({ cards: [{ id: 1, columnId: 'todo', title: 'One, renamed' }, CARDS[1]] });
        expect(document.querySelector('.bk-drawer-title').textContent.trim()).toBe('One, renamed');
        board.unmount();
    });

    it('closes itself if the card it was showing disappears', async () => {
        const board = mountBoard({ drawer: true });
        await board.find('.bk-card-title').trigger('click');
        expect(document.querySelector('.bk-drawer')).not.toBe(null);
        await board.setProps({ cards: [CARDS[1]] });
        expect(document.querySelector('.bk-drawer-title')).toBe(null);
        board.unmount();
    });
});
