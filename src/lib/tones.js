/**
 * Tone names, and the design-system variables each one resolves to.
 *
 * The names and variables match client-starter's `statuses.js` on purpose, so a
 * board rendered inside one of those apps inherits the app's own palette,
 * including its dark mode, without the kit shipping a single colour of its own.
 * The fallbacks after each `var()` are only for a host that has no token layer -
 * a plain Vite app, or the playground.
 *
 * Colour never carries meaning alone here: a column's tone is an accent beside
 * a written label, and an over-limit column gets an icon and a word as well as
 * a red count.
 */
export const TONES = {
    neutral: {
        bg: 'var(--neutral-bg, #f2f4f7)',
        fg: 'var(--neutral-600, #475467)',
        border: 'var(--neutral-border, #e4e7ec)',
    },
    brand: {
        bg: 'var(--color-brand-50, #eef2ff)',
        fg: 'var(--color-brand-700, #3538cd)',
        border: 'var(--color-brand-200, #c7d7fe)',
    },
    info: {
        bg: 'var(--info-bg, #eff8ff)',
        fg: 'var(--info-700, #175cd3)',
        border: 'var(--info-border, #b2ddff)',
    },
    success: {
        bg: 'var(--success-bg, #ecfdf3)',
        fg: 'var(--success-700, #027a48)',
        border: 'var(--success-border, #abefc6)',
    },
    warning: {
        bg: 'var(--warning-bg, #fffaeb)',
        fg: 'var(--warning-700, #b54708)',
        border: 'var(--warning-border, #fedf89)',
    },
    danger: {
        bg: 'var(--danger-bg, #fef3f2)',
        fg: 'var(--danger-700, #b42318)',
        border: 'var(--danger-border, #fecdca)',
    },
    special: {
        bg: 'var(--special-bg, #f4f3ff)',
        fg: 'var(--special-700, #5925dc)',
        border: 'var(--special-border, #d9d6fe)',
    },
};

export function toneVars(tone) {
    const t = TONES[tone] ?? TONES.neutral;
    return {
        '--bk-tone-bg': t.bg,
        '--bk-tone-fg': t.fg,
        '--bk-tone-border': t.border,
    };
}

/** Badges accept a plain string as shorthand for a neutral badge. */
export function normaliseBadge(badge) {
    if (badge === null || badge === undefined) return null;
    if (typeof badge === 'string' || typeof badge === 'number') {
        return { label: String(badge), tone: 'neutral' };
    }
    return { label: badge.label ?? badge.text ?? '', tone: badge.tone ?? 'neutral' };
}
