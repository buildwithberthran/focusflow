-- FocusFlow: add per-user ownership + Row Level Security
-- Run this in Supabase Dashboard -> SQL Editor (or via `supabase db push`).
--
-- Assumes these tables already exist from the prototype:
--   sessions(id, mode, autopilot, total_cycles, status, started_at, finished_at)
--   cycle_logs(id, session_id, cycle_number, duration_min, task_label, completed, log_note, started_at, ended_at)
--   templates(id, name, break_seconds, schedule, created_at)
--   session_snapshots(session_id, snapshot_at, app_mode, autopilot, break_seconds, alert_sound,
--                      start_min, end_min, std_task_label, schedule, schedule_index,
--                      current_cycle_min, completed_cycles, resume_point)

-- 1) Add user_id to every table, defaulting to the calling user.
alter table sessions          add column if not exists user_id uuid not null default auth.uid() references auth.users(id) on delete cascade;
alter table cycle_logs        add column if not exists user_id uuid not null default auth.uid() references auth.users(id) on delete cascade;
alter table templates         add column if not exists user_id uuid not null default auth.uid() references auth.users(id) on delete cascade;
alter table session_snapshots add column if not exists user_id uuid not null default auth.uid() references auth.users(id) on delete cascade;

create index if not exists sessions_user_id_idx          on sessions(user_id);
create index if not exists cycle_logs_user_id_idx        on cycle_logs(user_id);
create index if not exists templates_user_id_idx         on templates(user_id);
create index if not exists session_snapshots_user_id_idx on session_snapshots(user_id);

-- 2) Enable Row Level Security.
alter table sessions          enable row level security;
alter table cycle_logs        enable row level security;
alter table templates         enable row level security;
alter table session_snapshots enable row level security;

-- 3) Policies: a user may only see/modify their own rows.
drop policy if exists "sessions_select_own" on sessions;
drop policy if exists "sessions_insert_own" on sessions;
drop policy if exists "sessions_update_own" on sessions;
drop policy if exists "sessions_delete_own" on sessions;
create policy "sessions_select_own" on sessions for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on sessions for insert with check (auth.uid() = user_id);
create policy "sessions_update_own" on sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_delete_own" on sessions for delete using (auth.uid() = user_id);

drop policy if exists "cycle_logs_select_own" on cycle_logs;
drop policy if exists "cycle_logs_insert_own" on cycle_logs;
drop policy if exists "cycle_logs_update_own" on cycle_logs;
drop policy if exists "cycle_logs_delete_own" on cycle_logs;
create policy "cycle_logs_select_own" on cycle_logs for select using (auth.uid() = user_id);
create policy "cycle_logs_insert_own" on cycle_logs for insert with check (auth.uid() = user_id);
create policy "cycle_logs_update_own" on cycle_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cycle_logs_delete_own" on cycle_logs for delete using (auth.uid() = user_id);

drop policy if exists "templates_select_own" on templates;
drop policy if exists "templates_insert_own" on templates;
drop policy if exists "templates_update_own" on templates;
drop policy if exists "templates_delete_own" on templates;
create policy "templates_select_own" on templates for select using (auth.uid() = user_id);
create policy "templates_insert_own" on templates for insert with check (auth.uid() = user_id);
create policy "templates_update_own" on templates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "templates_delete_own" on templates for delete using (auth.uid() = user_id);

drop policy if exists "snapshots_select_own" on session_snapshots;
drop policy if exists "snapshots_insert_own" on session_snapshots;
drop policy if exists "snapshots_update_own" on session_snapshots;
drop policy if exists "snapshots_delete_own" on session_snapshots;
create policy "snapshots_select_own" on session_snapshots for select using (auth.uid() = user_id);
create policy "snapshots_insert_own" on session_snapshots for insert with check (auth.uid() = user_id);
create policy "snapshots_update_own" on session_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "snapshots_delete_own" on session_snapshots for delete using (auth.uid() = user_id);
