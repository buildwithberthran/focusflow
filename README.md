# FocusFlow

A decreasing-cycle focus timer (React + TypeScript + Vite) with session history,
reusable schedule templates, and interrupted-session resume — synced per-user to
Supabase via Google sign-in.

Converted from the original single-file HTML prototype into a proper React app.

## Stack

- React 19 + TypeScript + Vite
- Supabase (Postgres + Auth + Row Level Security)
- Google OAuth (via Supabase Auth)
- Deploy target: Vercel

## 1. Local setup

```bash
npm install
cp .env.example .env.local
# edit .env.local with your Supabase project URL + anon key
npm run dev
```

## 2. Supabase setup

### 2.1 Tables

You said the tables already exist (`sessions`, `cycle_logs`, `templates`,
`session_snapshots`). If you ever need to recreate them, they need these
columns (types matter for the code in `src/lib/db.ts` and `src/types.ts`):

- `sessions`: id (uuid, pk, default gen_random_uuid()), mode (text), autopilot (bool),
  total_cycles (int), status (text), started_at (timestamptz, default now()), finished_at (timestamptz)
- `cycle_logs`: id (uuid pk), session_id (uuid, fk -> sessions.id), cycle_number (int),
  duration_min (int), task_label (text), completed (bool, nullable), log_note (text),
  started_at (timestamptz), ended_at (timestamptz)
- `templates`: id (uuid pk), name (text), break_seconds (int), schedule (jsonb),
  created_at (timestamptz, default now())
- `session_snapshots`: session_id (uuid, pk, fk -> sessions.id), snapshot_at (timestamptz),
  app_mode (text), autopilot (bool), break_seconds (int), alert_sound (text),
  start_min (int, nullable), end_min (int, nullable), std_task_label (text, nullable),
  schedule (jsonb, nullable), schedule_index (int), current_cycle_min (int),
  completed_cycles (int), resume_point (text)

### 2.2 Add per-user ownership + enable RLS

Run `supabase/migrations/0001_add_user_id_and_rls.sql` in the Supabase Dashboard
SQL Editor (Project -> SQL Editor -> paste -> Run). This adds a `user_id` column
to every table (defaulting to `auth.uid()`) and turns on Row Level Security so
each signed-in user only ever sees their own sessions, logs, templates, and
snapshots.

### 2.3 Enable Google sign-in

1. Google Cloud Console -> APIs & Services -> Credentials -> **Create OAuth client ID**
   (type: Web application).
2. Authorized redirect URI: `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
   (find your project ref in Supabase Dashboard -> Project Settings -> API).
3. Copy the generated Client ID and Client Secret.
4. Supabase Dashboard -> Authentication -> Providers -> **Google** -> paste
   Client ID + Secret -> Save.
5. Supabase Dashboard -> Authentication -> URL Configuration -> add your app's
   URL (e.g. `http://localhost:5173` for dev, and your Vercel URL once deployed)
   to **Site URL** and **Redirect URLs**.

### 2.4 Get your API keys

Project Settings -> API -> copy the **Project URL** and **anon public key**
into `.env.local` (dev) and later into your Vercel project's environment
variables (production).

## 3. Push to GitHub

From inside the unzipped `focusflow` folder:

```bash
git init
git add .
git commit -m "Initial commit: FocusFlow React app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(If the repo already has a README/license from GitHub's UI, do
`git pull origin main --allow-unrelated-histories` before pushing, or just
delete those files on GitHub first.)

## 4. Deploy to Vercel

1. Go to https://vercel.com/new and import your GitHub repo.
2. Framework preset: **Vite** (auto-detected).
3. Build command: `npm run build` (default). Output directory: `dist` (default).
4. Add environment variables (Project Settings -> Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. Vercel gives you a URL like `https://focusflow-yourname.vercel.app`.
6. Go back to Supabase Authentication -> URL Configuration and add that Vercel
   URL to **Site URL** / **Redirect URLs** (step 2.3.5) — Google sign-in will
   fail with a redirect mismatch until you do this.
7. Every future `git push` to `main` auto-redeploys.

`vercel.json` in this repo already configures the SPA rewrite so client-side
routes and the OAuth redirect work correctly on refresh.

## Notes on the conversion

- The original prototype let you paste a Supabase URL/anon key into the page
  itself and had no login — anyone with the link could read/write all rows.
  This version moves the Supabase URL/anon key into build-time env vars and
  requires Google sign-in; every row is scoped to `auth.uid()` via RLS, so
  users can only ever see their own data.
- The state machine (countdown -> break -> review -> next cycle, pause/resume,
  autopilot vs manual, snapshot-based resume-after-refresh) was ported as-is
  from the original vanilla JS into `src/hooks/useFocusTimer.ts`.
- Pop-out window and Document Picture-in-Picture live-mirroring of the timer
  are preserved (`openPopout` in the same hook).
