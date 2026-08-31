/**
 * Demo data for the playground. Three boards, chosen to cover the three shapes
 * a real screen turns out to be:
 *
 *   sales     many stages, no lanes, scrolls sideways   (the NBOS reference)
 *   ops       swimlanes, WIP limits, filters            (the hard one)
 *   intake    three stages, fits the screen, no lanes   (the easy one)
 */

export const SALES_COLUMNS = [
    { id: 'new', title: 'New', tone: 'info' },
    { id: 'enquired', title: 'Enquired', tone: 'info' },
    { id: 'brochure_sent', title: 'Brochure sent', tone: 'neutral' },
    { id: 'viewing_scheduled', title: 'Viewing booked', tone: 'neutral' },
    { id: 'viewed', title: 'Viewed', tone: 'neutral' },
    { id: 'booked', title: 'Booked', tone: 'success' },
    { id: 'lost', title: 'Lost', tone: 'danger' },
];

const NAMES = [
    'Tan Wei Ling', 'Nurul Aisyah', 'Chong Mei Yee', 'Priya Raman', 'Lim Xiu Hui',
    'Farah Hanim', 'Ng Sze Ting', 'Anisa Rahim', 'Kavitha Devi', 'Yap Hui Xin',
    'Siti Zulaikha', 'Chan Li Fen', 'Ho Jia Wen', 'Devi Shanmugam', 'Wong Pei Shan',
    'Amira Zainal', 'Teoh Kai Xin', 'Rani Kumari', 'Loo Wen Qi', 'Zarina Ismail',
];

const SOURCES = ['Facebook', 'Walk-in', 'Referral', 'Instagram', 'Google'];

const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();

export const SALES_CARDS = NAMES.map((name, i) => {
    const stage = SALES_COLUMNS[i % SALES_COLUMNS.length].id;
    return {
        id: 1000 + i,
        columnId: stage,
        position: i,
        title: name,
        subtitle: `EDD ${['Mar', 'Apr', 'May', 'Jun'][i % 4]} 2026 - ${SOURCES[i % SOURCES.length]}`,
        summary: i % 3 === 0 ? 'Asked about the 28-day package and whether the room has an attached bathroom.' : null,
        badges: [
            i % 4 === 0 ? { label: 'Hot', tone: 'danger' } : null,
            i % 5 === 0 ? { label: 'AI drip on', tone: 'special' } : null,
        ].filter(Boolean),
        tags: i % 6 === 0 ? ['duplicate?'] : [],
        meta: { source: SOURCES[i % SOURCES.length], owner: i % 2 === 0 ? 'phillip' : 'sophia' },
        updatedAt: hoursAgo(i * 7 + 1),
    };
});

export const SALES_FILTERS = [
    {
        key: 'source',
        label: 'Source',
        options: SOURCES.map((s) => ({ value: s, label: s })),
    },
    {
        key: 'owner',
        label: 'Owner',
        multiple: false,
        options: [
            { value: 'phillip', label: 'Phillip' },
            { value: 'sophia', label: 'Sophia' },
        ],
    },
];

/* ------------------------------------------------------------------ ops */

export const OPS_COLUMNS = [
    { id: 'backlog', title: 'Backlog', tone: 'neutral' },
    { id: 'ready', title: 'Ready', tone: 'info', limit: 6 },
    { id: 'doing', title: 'Doing', tone: 'warning', limit: 3 },
    { id: 'review', title: 'Review', tone: 'special', limit: 4 },
    { id: 'done', title: 'Done', tone: 'success' },
];

export const OPS_LANES = [
    { id: 'phillip', title: 'Phillip', description: 'Platform and infra' },
    { id: 'sophia', title: 'Sophia', description: 'Client operations' },
    { id: 'unassigned', title: 'Unassigned' },
];

const TASKS = [
    ['Restore the nightly ops-db dump', 'doing', 'phillip', 'P1'],
    ['Sweep runner keeps dying on ENOSPC', 'doing', 'phillip', 'P0'],
    ['Wire the WhatsApp LID fallback', 'ready', 'phillip', 'P1'],
    ['Rotate the staging APP_KEY', 'backlog', 'phillip', 'P2'],
    ['Move the audit cron behind n8n', 'backlog', 'phillip', 'P3'],
    ['Chase the Glampot voided-docs answer', 'review', 'sophia', 'P1'],
    ['Reconcile the March AR mirror', 'doing', 'sophia', 'P1'],
    ['Draft the ThreeStep onboarding pack', 'ready', 'sophia', 'P2'],
    ['Update the quotation numbering ledger', 'ready', 'sophia', 'P2'],
    ['Archive the 2025 consultation forms', 'done', 'sophia', 'P3'],
    ['Fix the mobile sidebar overlap', 'ready', 'unassigned', 'P2'],
    ['Add a health check to board-poller', 'backlog', 'unassigned', 'P2'],
    ['Document the COMPOSER_AUTH setup', 'review', 'unassigned', 'P2'],
    ['Retire the legacy /api/opsstack routes', 'backlog', 'unassigned', 'P3'],
    ['Check the Kingston NVMe write latency', 'done', 'phillip', 'P3'],
];

const PRIORITY_TONE = { P0: 'danger', P1: 'warning', P2: 'info', P3: 'neutral' };

export const OPS_CARDS = TASKS.map(([title, columnId, laneId, priority], i) => ({
    id: `T-${200 + i}`,
    columnId,
    laneId,
    position: i,
    title,
    subtitle: ['ops-console', 'newbond-os', 'tqk-platform', 'cms'][i % 4],
    badges: [{ label: priority, tone: PRIORITY_TONE[priority] }],
    meta: { priority, repo: ['ops-console', 'newbond-os', 'tqk-platform', 'cms'][i % 4] },
    updatedAt: hoursAgo(i * 5 + 2),
}));

export const OPS_FILTERS = [
    {
        key: 'priority',
        label: 'Priority',
        options: ['P0', 'P1', 'P2', 'P3'].map((p) => ({ value: p, label: p })),
    },
    {
        key: 'repo',
        label: 'Repo',
        options: ['ops-console', 'newbond-os', 'tqk-platform', 'cms'].map((r) => ({ value: r, label: r })),
    },
];

/* --------------------------------------------------------------- intake */

export const INTAKE_COLUMNS = [
    { id: 'todo', title: 'To do', tone: 'neutral' },
    { id: 'doing', title: 'In progress', tone: 'info', limit: 2 },
    { id: 'done', title: 'Done', tone: 'success' },
];

export const INTAKE_CARDS = [
    { id: 'a', columnId: 'todo', position: 0, title: 'Collect the deposit slip' },
    { id: 'b', columnId: 'todo', position: 1, title: 'Confirm the room allocation' },
    { id: 'c', columnId: 'doing', position: 0, title: 'Sign the service agreement', subtitle: 'Waiting on the guarantor' },
    { id: 'd', columnId: 'done', position: 0, title: 'Book the consultation' },
];
