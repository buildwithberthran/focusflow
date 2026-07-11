-- FocusFlow: user settings
--
-- One row per user. Powers the Settings page: startup mode (autopilot/
-- manual/always ask), whether to ask for a post-cycle reflection, default
-- break lengths and alert sound, transition countdown length, and theme.

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  startup_mode text not null default 'ask',              -- 'ask' | 'autopilot' | 'manual'
  ask_feedback_after_cycle boolean not null default true,
  default_break_seconds_standard integer not null default 10,
  default_break_seconds_target integer not null default 10,
  default_alert_sound text not null default 'beep',       -- 'beep' | 'voice'
  transition_seconds integer not null default 3,          -- 3 | 5 | 10
  theme text not null default 'dark',                     -- 'dark' | 'light'
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

drop policy if exists "user_settings_select_own" on user_settings;
drop policy if exists "user_settings_insert_own" on user_settings;
drop policy if exists "user_settings_update_own" on user_settings;
create policy "user_settings_select_own" on user_settings for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on user_settings for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
