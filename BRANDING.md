# FocusFlow — Brand Guide

## Positioning

**What it is:** a decreasing-cycle focus timer. Not another 25-minute Pomodoro
clone — sessions start long and taper as attention naturally fades.

**Tagline:** "Cycles that shrink as your focus does."
**Alt/shorter:** "Focus that tapers, not repeats."

**Voice:** direct, quietly confident, a little wry. Talks to people doing real
work, not to "hustle culture." Never shouty, never cutesy. Think: a sharp
colleague, not a motivational poster.

- ✅ "Start long. Taper as you go."
- ❌ "Unleash your inner productivity ninja!! 🚀🔥"

## Color

Two accent colors, each tied to a real product state — not decoration:

| Token | Hex | Meaning | Usage |
|---|---|---|---|
| `--ff-focus` | `#5B8CFF` | Focus cycles | active countdown, primary actions, links |
| `--ff-rest` | `#FFB86B` | Break/rest | break countdown, secondary accents |
| `--ff-green` | `#4CAF50` | Completion / positive | Start button, "done" states |
| `--ff-red` | `#E05656` | Stop / destructive | Reset, delete |
| `--ff-bg` | `#0B0F17` | Base canvas | app background |
| `--ff-panel` | `#161D2B` | Surface | cards |
| `--ff-muted` | `#8A93A6` | Secondary text | labels, captions |

Rule of thumb: **blue = doing, amber = resting.** If you're ever unsure what
color something should be, ask which of those two states it belongs to.

A light theme (for the Settings toggle we're about to build) inverts this
onto a warm off-white (`#F7F5F1`) base with the same two accents darkened
~10% for contrast — not a separate palette, the same one.

## Typography

| Role | Font | Why |
|---|---|---|
| Display / headlines | **Sora** (700/800) | geometric, technical, confident — reads as a tool, not a lifestyle brand |
| Body | **Inter** (400/500/600) | the most legible UI sans available, disappears into the background |
| Numerals / data / timer digits | **IBM Plex Mono** | tabular figures so the countdown never jitters in width; also used for the eyebrow tags and stat labels to signal "this is a measurement" |

Never use a serif anywhere. Never use more than these three families.

## Logomark

The mark is literally the product's mechanic: a descending staircase inside
a circular timer frame — not a generic clock or a generic checkmark. It's
the same "Descent" motif already on the landing page, distilled to an icon.

See `public/brand/logomark.svg` (included in the zip) — a single-color mark
that works at 16px (favicon) up to a hero-sized 200px, in one color so it
can be recolored to `--ff-focus` or plain white as needed.

## Imagery

No stock photography, no generic "person typing on laptop in a bright
office" imagery — it undercuts the "quietly serious tool" positioning.
When a visual is needed, it should be:
- an actual data/timer visualization (bars, rings, sequences), never a photo of a person
- dark-background, high-contrast, two-tone (focus blue / rest amber)
- geometric, not organic/hand-drawn

## Applying this

- `src/index.css` and `src/components/Landing/cover.css` already carry the
  color tokens above — retheme by editing the `:root { --ff-* }` block and
  the `.cover-page { --cv-* }` block, not by hunting for hex codes elsewhere.
- Any new UI (Settings page, sharing cards, etc.) should pull from these same
  tokens rather than introducing new colors.
