-- FocusFlow: Target-mode "extend time" and "restart cycle"
--
-- One log entry per work block, no splitting. extension_log records each
-- extension in minutes, in order, so History can render the full chain
-- ("20m → +15m → +12m = 47m total"). restart_count just counts do-overs;
-- only the *final* attempt's started_at/ended_at/paused_seconds are kept —
-- a restart re-stamps started_at so timing reflects just the last attempt.

alter table cycle_logs add column if not exists extension_log jsonb not null default '[]'::jsonb;
alter table cycle_logs add column if not exists restart_count integer not null default 0;
