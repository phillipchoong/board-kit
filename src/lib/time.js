/**
 * The board's own freshness clock.
 *
 * Only used for "Updated 40s ago" in the toolbar. Card timestamps stay the
 * host app's job through `formatUpdated`, because every app already has an
 * opinion about timezones and wording and the kit should not have a second one.
 */

export function toMillis(value) {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Short and absolute-value based, so a clock a few seconds ahead of the server
 * reads "just now" rather than "in 4s", which looks broken.
 */
export function relativeAge(value, now = Date.now()) {
    const ms = toMillis(value);
    if (ms === null) return null;

    const seconds = Math.max(0, Math.round((now - ms) / 1000));
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return `${Math.round(hours / 24)}d ago`;
}
