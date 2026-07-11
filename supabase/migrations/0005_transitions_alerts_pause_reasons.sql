-- FocusFlow: transition control, end-of-cycle alert, long-pause reasons

-- Settings: whether the transition countdown plays before breaks too (cycles
-- always get it), an optional "cycle ending soon" alert, and the long-pause
-- reason prompt (master toggle + thresholds for cycles and breaks).
alter table user_settings add column if not exists transition_before_break boolean not null default true;
alter table user_settings add column if not exists end_alert_enabled boolean not null default false;
alter table user_settings add column if not exists end_alert_seconds integer not null default 10;
alter table user_settings add column if not exists long_pause_check_enabled boolean not null default false;
alter table user_settings add column if not exists long_pause_cycle_minutes integer not null default 15;
alter table user_settings add column if not exists long_pause_break_mode text not null default 'percent'; -- 'percent' | 'minutes'
alter table user_settings add column if not exists long_pause_break_percent integer not null default 50;
alter table user_settings add column if not exists long_pause_break_minutes integer not null default 5;

-- cycle_logs: a reason for a long pause (mid-cycle, or the break right before
-- this cycle started), plus retroactively-editable completion/notes so a
-- skipped review isn't a permanent "not done" assumption.
alter table cycle_logs add column if not exists pause_reason text;
alter table cycle_logs add column if not exists break_pause_reason text;
