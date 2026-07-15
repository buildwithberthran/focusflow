# FocusFlow — Brand Identity (applied)

This supersedes the earlier version of this file. The source of truth is
`FocusFlow-Brand-Identity-Guidelines.html` (kept outside the repo); this doc
records exactly how those tokens got mapped into actual CSS/code, since the
guide's own ratios and shades were tuned for print/light collateral and
needed a few derived values to stay legible in a dark, dense UI.

## Core tokens (from the guide, verbatim)

| Name | Hex | Guide's stated role |
|---|---|---|
| Ink | `#14181C` | Primary text, dark surfaces, wordmark |
| Ink-soft | `#2A2E32` | Elevated dark surface |
| Paper | `#EEF1EE` | Primary background |
| Paper-card | `#FFFFFF` | Elevated light surface |
| Amber (Checkpoint) | `#E8A23D` | Accent — CTAs, the logomark's pin, checkpoints |
| Amber-deep | `#B9762A` | Amber as text/on light surfaces |
| Teal (Signal) | `#2B6F68` | Progress, completion, active state |
| Slate | `#5B6670` | Secondary text — never headlines |
| Rule | `#D8DAD6` | Dividers, light-mode borders |

Type: **Space Grotesk** (display/headlines), **IBM Plex Sans** (body),
**IBM Plex Mono** (data, timers, code-like text) — unchanged from before,
the guide kept the same mono.

## How dark/light map (per your instruction: Ink = dark mode, Paper = light mode)

| Token (`src/index.css` `:root`) | Dark (default) | Light (`[data-theme="light"]`) |
|---|---|---|
| `--ff-bg` | `#14181C` (Ink) | `#EEF1EE` (Paper) |
| `--ff-panel` | `#2A2E32` (Ink-soft) | `#FFFFFF` (Paper-card) |
| `--ff-text` | `#EEF1EE` (Paper) | `#14181C` (Ink) |
| `--ff-muted` | `#9BA3A8` *(derived)* | `#5B6670` (Slate) |
| `--ff-focus` | `#3B8A81` *(derived)* | `#2B6F68` (Teal) |
| `--ff-rest` | `#E8A23D` (Amber) | `#B9762A` (Amber-deep) |
| `--ff-green` | `#3B8A81` *(derived, aliased to Teal)* | `#2B6F68` (Teal) |
| `--ff-red` | `#D06868` *(derived)* | `#B23B3B` |

**Where "derived" values come from**: the guide's raw Teal/Slate/red are
tuned for reading as small dark-on-light text. Used as-is on FocusFlow's
very dark Ink background, several failed contrast badly (a muted-teal
`#2B6F68` button label on `#14181C` reads as almost invisible). Each derived
value is that same color lightened just enough to stay legible on Ink,
keeping the same hue family rather than introducing an unrelated color.
Light mode uses the guide's exact hexes with no adjustment — that's the
context they were actually designed for.

`--ff-green` is aliased to Teal rather than kept as a separate hue: the guide
doesn't define a separate "success" color, and Teal's own stated role
("progress, completion") already covers it — one less off-brand color in
the system.

## Logomark — Checkpoint Bars

`src/components/Brand/CheckpointBarsIcon.tsx` — variable-height bars (a
custom-built cycle schedule) with one bar carrying a pin at its exact resume
point, echoing the product's actual snapshot-resume feature. Bars always
render in `currentColor` (inherits whatever text color surrounds it); the
pin is hardcoded Amber `#E8A23D` in both themes — per the guide, it's the
only element ever allowed to carry the accent, so it doesn't theme-switch.

`public/brand/logomark.svg` — a self-contained static version (fixed Ink
bars + Amber pin) for contexts that can't inherit color: the favicon, and
anywhere an `<img>` tag is more appropriate than an inline component.

## Where it's applied

- `src/index.css` — the whole signed-in app (sidebar, dashboard, timer,
  history, settings, modals), both themes.
- `src/components/Landing/cover.css` + `CoverPage.tsx` — the landing page.
  Per your call, the cover page's own dark look is intentionally NOT tied to
  the in-app theme toggle (it's a fixed first impression), but now uses the
  same Ink/Paper/Amber/Teal tokens and Space Grotesk/IBM Plex Sans, so it's
  the same brand, just permanently in its dark variant.
- `src/hooks/useFocusTimer.ts` — the pop-out/PiP widget's inline CSS-in-JS,
  including its own Google Fonts `<link>`.
- Sidebar brand mark, cover page header mark, and the favicon all use the
  Checkpoint Bars logomark instead of the old ⏱ emoji / placeholder Vite icon.

## Rule of thumb for future changes

Don't hand-pick a hex when a token already exists — check `:root` in
`src/index.css` first. If you truly need a new derived shade (same problem
as `--ff-focus`/`--ff-green`/`--ff-red` above), keep it in the same hue
family as its source brand color and note why here, the same way this file
already explains the existing ones.
