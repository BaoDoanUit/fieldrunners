# FieldRunner — Design rationale

> The visual system for the front-end. Lives alongside [`AGENTS.md`](./AGENTS.md) and
> the static code map in [`.codegraph/CODEGRAPH.md`](./.codegraph/CODEGRAPH.md).

## Direction

**"Tactical Field Manual"** — a worn military topographical manual that happens to
contain a tower-defense game. Counter to the original Fieldrunners sci-fi neon,
and to the default AI "near-black + accent + glassmorphism" look. Built for the
PRD's promise: "small decisions per round, deliberate reading."

The 3D battlefield is the hero. The chrome around it is reduced to hairline
technical marks (corner brackets, double-ruled borders, mono numbers), and
overlay screens (menu, tutorial, victory, defeat) become **folded cardstock
sheets** laid over the battlefield.

## Tokens

```
/* paper & ink */
--parchment  #F2EBDC   page background, light surfaces
--parchment-2 #E8DFCA  alt paper (cards, hover, debug strip)
--ink        #14202E   body type, primary stroke
--ink-2      #2A3A52   secondary body
--muted      #6B6553   helper, captions
--rule       #1D2A3A   hairline dividers

/* dark chrome (battle HUD) */
--topo       #0E1B2C   HUD bar, debug strip
--topo-2     #14223A   debug strip inner
--topo-rule  #2C3E5C   dark hairline

/* accents */
--flare      #E15A1C   range, primary CTA, "fire"     (PRD: yellow/orange affordance)
--flare-2    #F4A13A   hover, highlight              (PRD: yellow)
--verdigris  #2C7A6A   valid, currency, "go" state   (PRD: green/blue)
--rust       #8E2B12   damage, invalid, "blocked"    (PRD: red)
--path-line  #6A4F33   sepia enemy path lines (overview)
```

These map directly to the PRD's color rules:
- green/blue for valid placement → `verdigris`
- red for invalid → `rust`
- yellow/orange for upgrade affordances → `flare` / `flare-2`

## Type system

| Role    | Family           | Use |
|---------|------------------|-----|
| Display | Bungee SC        | "ROUND 03" / victory / defeat / titles. Condensed, all-caps, military-stencil feel. |
| Body    | Spectral         | Body copy, instructions, panel text. Contemporary editorial serif. |
| Mono    | JetBrains Mono   | Stats, currency, timer, telemetry, debug. |

Loaded via Google Fonts `@import` at the top of `src/styles.css`. No build
tooling changes.

Type scale follows a 4 px rhythm: `t-xxs 10 / t-xs 12 / t-sm 14 / t-md 16 /
t-lg 20 / t-xl 24 / t-2xl 32 / t-3xl 40`.

## Layout (portrait-first, 360×780 base)

```
┌─────────────────────────────┐  ← safe area
│ ⌐  ROUND 03 / 20   ♥ 12  ¤ 240  ⌐ │  ← topbar (dark topo, mono numbers, flare brackets)
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│                             │
│        [3D scene]           │  ← stage-card, hairline-framed, grid backdrop
│                             │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│ ⌐[C][R][S][L]   [↑][⏸][↻]  ⌐ │  ← bottom command strip (mobile) / side panel (wide)
└─────────────────────────────┘
```

- **Portrait-first**: default layout is a vertical stack (stage on top, command
  strip below). On widths ≥ 1100 px the command strip moves to a right column.
- **Stage is hero**: takes the majority of the viewport. The HUD overlays float
  on the stage, not next to it.
- **Hairline chrome**: 1 px borders, 4 px corner brackets, no shadows on the
  HUD bar (the sheet overlay gets the shadow).

## Signature element: the **cardstock sheet**

Every overlay (Tutorial, Victory, Defeat, Settings, Pause) is rendered as a
folded paper page laid over the battlefield:

- **Double-ruled border** — outer 1 px ink + inner 4 px parchment + 1 px ink ring.
- **Corner brackets** — `[ ]` in `--flare` at TL/BR; small ink brackets at TR/BL.
- **Stamped eyebrow** — `FIELD MANUAL · ORDER {n} · COMPLETE` in mono, framed
  by an ink box, sitting above the title.
- **Soft paper shadow** — 12 px 28 px shadow, no glow.
- **Folio** — small `P. 03 / 13` mono label in the bottom right corner.
- **Sheet-rise animation** — 8 px translate + 0.6° rotate → 0/0, 280 ms.

The cardstock metaphor also extends to the **panel folio** in the top-right
corner of the side panel (`P. 03`) — a small detail that ties the chrome to
the overlay system.

## Signature element: **tower card silhouettes**

Each tower card has a small printed top-down silhouette of that tower's
coverage shape. The card is honest — tap a card, you see exactly the printed
silhouette, and the in-game range preview uses the same shape.

- `cannon`  — concentric rings + a single burst spike
- `rapid`   — dashed rings + cardinal tick marks
- `splash`  — three filled dots (blast marks)
- `slow`    — dotted ring + half-arc (a current)

Cards are 2-column on tablet, stack on narrow mobile. Active state inverts
(ink background, parchment text) and adds a 2 px `--flare-2` inset glow.

## Motion

- **Sheet rise** — overlays ease up from 8 px below with a slight rotation.
- **Ink press** — buttons translate +1 px on `:active`.
- **Stage grid** — a 32 px grid drawn with 5 % alpha `--flare-2` so the
  battlefield reads as "drafting paper" even before the Three.js scene paints.
- **No ambient HUD animation** — it would read as noise on a mobile screen.
- Respects `prefers-reduced-motion`.

## Color-language mapping (PRD ↔ design)

| PRD rule                              | Token       | Hex       |
|---------------------------------------|-------------|-----------|
| Valid placement (green/blue)          | verdigris   | `#2C7A6A` |
| Invalid placement (red)               | rust        | `#8E2B12` |
| Upgrade affordance (yellow/orange)    | flare       | `#E15A1C` |
| Currency / "go" state                 | verdigris   | `#2C7A6A` |
| Damage, enemy-killed                  | rust        | `#8E2B12` |
| Range preview                         | flare       | `#E15A1C` |

## Responsive behavior

| Width        | Layout                                                              |
|--------------|---------------------------------------------------------------------|
| < 700 px     | Topbar stacks. Stage top, command strip bottom. 2-col button grid.  |
| 700–1100 px  | Topbar inline. Stage top, command strip bottom. 3-col button grid.  |
| ≥ 1100 px    | Stage left, command strip right (1.7 fr / 0.9 fr).                  |

All breakpoints honour `env(safe-area-inset-*)`.

## Accessibility

- `prefers-reduced-motion: reduce` cuts all animation/transition duration to
  ~0 ms.
- Visible keyboard focus on every button (default browser ring is reinforced
  by the ink-press 1 px translate).
- `role="dialog" aria-modal="true"` on every overlay.
- Tower card glyphs are `aria-hidden` — the tower `name` carries the label.
- Colour is never the only signal: range rings include dashes or solid lines
  as a shape, not just hue; place-zone "valid/invalid" indicators are
  reinforced with shape (filled ring vs. cross).

## File map

- [`src/styles.css`](./src/styles.css) — tokens, all class rules, animation,
  responsive. Drop-in replacement for the previous dark-glass stylesheet.
- [`src/ui/App.tsx`](./src/ui/App.tsx) — `Overlay` now renders the cardstock
  sheet; `TowerSilhouette` is the new top-down ink-stamp component; the
  `.tower-card` button uses a `.glyph` cell.
- [`index.html`](./index.html) — `theme-color` updated to `--parchment`.
