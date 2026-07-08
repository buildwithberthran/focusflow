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
| `src/App.tsx` | Top-level routing: shows `CoverPage` when signed out, the app shell (`AccountBar` + `PageTabs` + current page) when signed in. |
| `src/components/Layout/AccountBar.tsx` | The small bar showing your Google avatar/name + Sign out button. |
| `src/components/Layout/PageTabs.tsx` | The Timer / History / Templates tab switcher. |
| `src/index.css` | Global styles for the **signed-in app** (the `.card` shell, buttons, inputs, modals, history/templates tables). This is a separate design system from `cover.css` on purpose — the cover page can evolve its own look without touching the working app. |

## Timer page

| File | What it controls |
|---|---|
| `src/components/Timer/TimerPage.tsx` | Standard vs Target Total panels, all the input fields, the live countdown display, and the button row (Start/Pause/Resume/Reset/Continue). |
| `src/components/Timer/CyclePreview.tsx` | The editable list of cycles (minutes + label) shown under Target Total mode. |
| `src/components/Timer/ResumeBanner.tsx` | The green "interrupted session found" banner. |
| `src/components/Modals/ModeModal.tsx` | The Autopilot vs Manual popup shown after clicking Start. |
| `src/components/Modals/ReviewModal.tsx` | The "did you use this cycle for X?" popup shown after every cycle. |
| `src/components/Modals/TemplateNameModal.tsx` | The "name this template" popup. |

## History & Templates pages

| File | What it controls |
|---|---|
| `src/components/History/HistoryPage.tsx` | Summary cards, per-task breakdown table, session list, CSV export. |
| `src/components/Templates/TemplatesPage.tsx` | The saved-template list (Use / Delete). |

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
