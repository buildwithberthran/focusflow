# Where things live

A map of every file that renders UI or owns a piece of behavior, grouped by what
you'd touch to change it.

## Signed-out experience

| File | What it controls |
|---|---|
| `src/components/Landing/CoverPage.tsx` | The whole cover/landing page: headline, subcopy, Google button, feature list, the "Descent" bar visual. Edit copy and structure here. |
| `src/components/Landing/cover.css` | All visual styling for the cover page only (colors, type, the bar animation). Design tokens are CSS variables at the top of `.cover-page` — change `--cv-focus`, `--cv-rest`, `--cv-bg`, etc. to retheme. |
| `index.html` | `<title>`, meta description, and the Google Fonts `<link>` tags (Sora / Inter / IBM Plex Mono) used by the cover page. |

## Signed-in app shell

| File | What it controls |
|---|---|
| `src/App.tsx` | Top-level routing: shows `CoverPage` when signed out, `AppShell` (sidebar + current page) when signed in. |
| `src/components/Layout/AppShell.tsx` | The sidebar + main-content grid wrapper and the `Page` type used for navigation. |
| `src/components/Layout/Sidebar.tsx` | Brand mark, Timer/History/Templates nav (lucide icons), and the account footer (avatar/name/sign out). |
| `src/components/Layout/StatsBar.tsx` | The 4 stat cards at the top of the dashboard (cycles today, focus minutes today, 30-day completion rate, streak). |
| `src/hooks/useDashboardStats.ts` | Computes the numbers behind `StatsBar` from recent sessions/cycle logs. |
| `src/index.css` | Global styles for the **signed-in app**: sidebar, stats cards, the two-column timer grid, panel cards, buttons, inputs, modals, history/templates tables. Root design tokens (`--ff-focus`, `--ff-rest`, `--ff-bg`, etc.) are declared under `:root` at the top — change those to retheme everything at once. |

## Timer page

| File | What it controls |
|---|---|
| `src/components/Timer/TimerPage.tsx` | The two-column dashboard layout: live timer card (left) + schedule/config card (right), all inputs, and the button row. |
| `src/components/Timer/ProgressRing.tsx` | The circular SVG progress ring around the timer digits. Takes a `progress` (0–1), a `color`, and renders children in the center. |
| `src/components/Timer/CyclePreview.tsx` | The editable list of cycles (minutes + label) shown under Target Total mode. |
| `src/components/Timer/ResumeBanner.tsx` | The green "interrupted session found" banner. |
| `src/components/Modals/ModeModal.tsx` | The Autopilot vs Manual popup shown after clicking Start. |
| `src/components/Modals/ReviewModal.tsx` | The "did you use this cycle for X?" popup shown after every cycle. |
| `src/components/Modals/TemplateNameModal.tsx` | The "name this template" popup. |

## History & Templates pages

| File | What it controls |
|---|---|
| `src/components/History/HistoryPage.tsx` | Summary cards, per-task breakdown, sessions grouped by date, inline session rename, per-cycle paused-time annotation, CSV export. |
| `src/components/Templates/TemplatesPage.tsx` | The saved-template list (Use / Delete). |

## Settings

| File | What it controls |
|---|---|
| `src/components/Settings/SettingsPage.tsx` | Startup mode (always ask / autopilot / manual), post-cycle feedback toggle, default break lengths per mode, default alert sound, transition countdown length, theme. |
| `src/components/Settings/Toggle.tsx` | The reusable on/off switch. |
| `src/context/SettingsContext.tsx` | Loads settings once signed in, applies the theme (`data-theme` attribute), exposes `update()`. |
| `src/lib/db.ts` (`dbGetSettings`/`dbUpsertSettings`) | Settings are per-user in Supabase (`user_settings` table), not just local — they follow you across devices. |

Settings feed into the engine in three places: `requestStart()` skips the Autopilot/Manual modal entirely when startup mode isn't "ask"; `openReviewModal()` skips the post-cycle question when feedback is off; and break/alert defaults re-apply every time they change in Settings (not just once), tracked per-field so an unrelated settings change doesn't stomp a break length you'd already tweaked for a not-yet-started session — but never while idle isn't the phase, so a live or paused session is untouched.

`src/lib/audio.ts`'s transition countdown (`announceBreakStart`/`announceNextCycleStart`) now takes an `onTick(remaining)` callback, called right as each number is cued — voice just before speaking it, beep just before the tone — so the on-screen "Starting in N…" text is driven by the same clock as the audio instead of being a static string. `transition_seconds` accepts any value from 0 up (0 = instant, no countdown, no dangling "beginning in…" voice line).

## Theme

Dark is the default and everything above was designed against it first. The light theme lives entirely in a `[data-theme="light"]` override block at the bottom of `src/index.css` — it doesn't touch any dark-mode rule. The cover/landing page is deliberately exempt and always renders dark regardless of the in-app theme setting (it's a fixed first impression, not a signed-in preference).

## This round's fixes and additions

- **Finish-then-Reset corruption, fixed**: `finishAll()` never cleared `currentCycleLogId`, so clicking Reset right after a session finished re-ran the abandon logic against the *already-completed* last cycle, overwriting its `completed`/notes with `[abandoned]`. `stopAndReset()` now only touches the DB at all when something is genuinely active (`phase` isn't `idle` or `finished`).
- **Settings that weren't taking effect**: break-length/alert-sound defaults now re-apply every time they change in Settings (tracked per-field), not just once on first load.
- **The countdown text was static**: `src/lib/audio.ts`'s `announceBreakStart`/`announceNextCycleStart` now take an `onTick(remaining)` callback fired in lockstep with each beep/voice number, so the on-screen "Starting in N…" is driven by the same clock as the audio.
- **Transitions can skip breaks**: `transition_before_break` setting — cycles always get the transition countdown, breaks are optional.
- **Cycle-ending-soon alert**: `end_alert_enabled` + `end_alert_seconds`, a single distinct cue (not the countdown tones) fired once when remaining time crosses the threshold.
- **Retroactive review editing**: every cycle card in History has an edit affordance to set Yes/No/Unsure and rewrite notes after the fact — a skipped review is no longer a permanent, unchangeable "not done."
- **Long-pause reason prompt** (`src/components/Modals/PauseReasonModal.tsx`, `src/lib/resumeChoice.ts`-adjacent logic in `useFocusTimer.ts`): master-toggle setting (`long_pause_check_enabled`) plus separate thresholds for mid-cycle pauses (flat minutes) and mid-break pauses (percent-over or flat-minutes-over, user's choice). Resuming past the threshold defers the actual resume until the person answers or skips; a cycle-pause reason attaches directly to that cycle's log, a break-pause reason is stashed (`pendingBreakPauseReason`) and attached to the *next* cycle's log once it's created, since breaks don't have their own DB row.
- **History redesign**: each cycle is now an independent card (`CycleLogCard` in `HistoryPage.tsx`) — duration as a styled "N MIN" pill, task label, a start–end time line pulled straight from `started_at`/`ended_at`, pause/reason lines only when relevant, and a status pill + edit control at the bottom. Session headers show both start and end time.
- **End-alert voice sync, fixed**: the old version spoke one full sentence ("5 seconds left") a single time, and by the time speech synthesis finished saying it, real seconds had already ticked past. `cueEndingSoon` in `src/lib/audio.ts` now fires once *per second* across the whole window — each cue is a single short word or tone, non-blocking, so it never falls behind the real countdown. `end_alert_use_task_label` setting controls whether it says "Cycle N" or the cycle's task label.
- **Standard mode: direction + step**: `direction: 'decreasing' | 'increasing'` and `stepMin` on `EngineState`, persisted on snapshots (`standard_direction`/`standard_step_min` — migration `0006`) so resuming a Standard session keeps counting the right way. Target mode is unaffected — direction/step is Standard-only, since Target's schedule is already fully custom per-cycle.
- **Target mode: extend or restart a cycle** (migration `0007`) — one log entry per work block, always. `duration_min` never changes (it's the original plan); extensions accumulate in `extension_log` (a plain list of added minutes) so History can show "20m → +15m → +12m = 47m total" without ever hiding the original estimate. Restarting resets progress and clears `extension_log` (a restart is a fresh attempt — earlier overruns don't carry over) but increments `restart_count`, shown as a small "Restarted N×" badge. `dbAppendCycleExtension`/`dbRegisterCycleRestart` in `db.ts` do read-then-write so concurrent calls don't clobber each other.

  The choice is presented exactly once, right when a Target-mode cycle's countdown hits zero — not as ambient buttons sitting there during the whole countdown (that was the original design; moved deliberately, since the decision to extend almost never happens mid-focus, it happens the moment the buzzer goes off). `tick()` detects `remaining === 0` in Target mode, stashes `{completedNum, isLast}` in `cycleEndInfoRef`, and opens `CycleEndChoiceModal` instead of proceeding — phase stays `'countdown'` the whole time (so `canExtendOrRestart()`'s existing guard needs no changes), the interval is just stopped until a choice resolves. `resolveCycleEndChoice()` in the engine either calls `extendCurrentCycle`/`restartCurrentCycle` (which now restart the interval themselves whenever they find it stopped, not just when resuming from an explicit pause) or, for "I'm done," calls `proceedAfterCycleEnd()` — the extracted version of the normal completion flow (review → break/finish), unchanged from before this refactor. Standard mode never sees this modal; it goes straight to `proceedAfterCycleEnd()` like it always did.

## Resuming precisely

| File | What it controls |
|---|---|
| `src/lib/resumeChoice.ts` | Works out, in plain language, the two sensible ways to resume a given snapshot (continue exact time vs restart the cycle; or move to the next cycle vs redo the one that just finished). |
| `src/components/Modals/ResumeChoiceModal.tsx` | Presents those two options before actually resuming — only shown when there's a real choice to make. |

The previous "always restarts from cycle 1" bug was `doResume` never advancing the cycle index when the interruption happened *between* cycles (i.e. the previous cycle had already completed) — it kept reusing the same, already-finished index. Fixed in `useFocusTimer.ts`. Exact mid-cycle resume needed a new `remaining_seconds` column on `session_snapshots` (migration `0003`), since the old snapshot never recorded anything more precise than "which cycle."

## Recovering interrupted sessions

| File | What it controls |
|---|---|
| `src/components/Recover/RecoverPage.tsx` | Dedicated page listing every session that didn't finish cleanly. Resume (if a snapshot exists), Restart (same config, fresh run), or End each one. Replaces the old behavior of the resume banner popping up unpredictably. |
| `src/hooks/useRecoverableCount.ts` | Small badge count shown on the sidebar's "Recover" nav item. |

## Cross-tab safety

`src/hooks/useFocusTimer.ts` writes a lightweight lock to `localStorage` (`focusflow:active-lock`) whenever a session starts or resumes, and clears it when that session ends. Other tabs pick this up instantly via the browser's `storage` event and refuse to start a second, conflicting session — this fixes the "two tabs show inconsistent state" bug. It does **not** mirror the live countdown between tabs second-by-second (that would need a shared timer authority broadcasting ticks — a bigger change than a lock); each tab still ticks its own view of whichever session it owns.

## Time formatting

`src/lib/time.ts` — the single source of truth for exact, non-rounding time display (`formatClock` for the live MM:SS/HH:MM:SS timer, `formatDurationExact` for History's paused-time annotations). If a duration anywhere in the app ever looks rounded, it's not using this.

## Branding

| File | What it controls |
|---|---|
| `BRANDING.md` | The brand system as actually implemented — exact token mapping from the guide, dark/light values, and which derived shades exist and why. Read this before making visual changes anywhere. |
| `src/components/Brand/CheckpointBarsIcon.tsx` | The logomark as an inline, theme-aware React component (bars inherit `currentColor`, pin is always Amber). Used in the sidebar and cover page. |
| `public/brand/logomark.svg` | Self-contained static version (fixed colors) — the favicon, and anywhere an `<img>` fits better than the component. |

## Logic (no UI, but drives everything above)

| File | What it controls |
|---|---|
| `src/hooks/useFocusTimer.ts` | The entire timer state machine — countdown, break, review, autopilot vs manual, pause/resume, snapshot-based resume-after-refresh. If a *behavior* is wrong (not just a color), it's in here. |
| `src/hooks/useTemplates.ts` | Fetches/refreshes the saved templates list. |
| `src/context/AuthContext.tsx` | Google sign-in/sign-out, current session/user. |
| `src/context/TimerEngineContext.tsx` | Makes `useFocusTimer` available to every timer/history/template component without prop-drilling. |
| `src/lib/supabaseClient.ts` | The Supabase client, reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. |
| `src/lib/db.ts` | Every database read/write (sessions, cycle_logs, templates, snapshots). |
| `src/lib/audio.ts` | Beep tones + voice announcements between cycles. |
| `src/types.ts` | Shared TypeScript types for all of the above. |

## Rule of thumb

- **Want to change how something looks** → find it in the tables above, edit the
  matching `.tsx` for structure/copy or the matching `.css` for style.
- **Want to change how something behaves** (timing, what counts as "done", what
  gets saved) → `src/hooks/useFocusTimer.ts` or `src/lib/db.ts`.
- **Want to change the database schema or permissions** →
  `supabase/migrations/`.
