### Added

- `BoardCardDrawer`, and a `drawer` prop on `BoardView` that opens a card into
  it. Bottom sheet under 768px, side panel above; focus trap, scroll lock,
  swipe-down to dismiss, and the move menu in its header. The drawer holds the
  card's id rather than a copy, so it follows the card and closes itself if the
  card disappears.
- Live updates: `updatedAt` renders a ticking "Updated 40s ago", `refreshing`
  and `showRefresh` add a refresh button that emits `refresh`, and cards that
  changed since the last load get about a second and a half of highlight -
  green for new, blue for moved, purple for edited, each with a word as well as
  a colour, and the batch announced to screen readers.
- One shared 30-second clock behind every relative timestamp, paused while the
  tab is hidden, so "2m ago" stops being a lie on a board left open.

### Changed

- The playground gained a light/dark/system switch, a button that simulates
  someone else changing a card, and a drawer, so all three can be seen rather
  than taken on trust.

### Fixed

- The change-highlight chip was painted with a translucent status tint, so the
  card's own border showed through the middle of the word and read as a
  strikethrough. It now composites that tint over an opaque card surface and
  sits above the highlight ring.
- Choosing a filter grew its button from "Source" to "Source: Facebook", which
  reflowed the toolbar and shifted the view switch out from under the pointer.
  Filter buttons now reserve a fixed width and truncate, and the toolbar's right
  hand group no longer moves when the left one grows.
- The drawer's move and close buttons were 2px apart and crowded against the
  title. They now have a real gap, a right inset, and separation from the body.
