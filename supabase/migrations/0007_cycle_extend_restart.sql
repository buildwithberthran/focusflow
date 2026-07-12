-- FocusFlow: Target-mode extend/restart tracking
--
-- One entry per work block, always. Extensions accumulate as a simple list of
-- added minutes (so History can show "20m → +15m → +12m = 47m total") without
-- ever touching duration_min, which stays the original planned length.
-- Restarting a cycle resets progress and any extensions (a restart is a
-- fresh attempt), but increments restart_count so the do-over itself is
-- still visible as a small "Restarted N×" indicator.

alter table cycle_logs add column if not exists extension_log jsonb not null default '[]'::jsonb;
alter table cycle_logs add column if not exists restart_count integer not null default 0;
