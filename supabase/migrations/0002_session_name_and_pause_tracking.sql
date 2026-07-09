-- FocusFlow: session naming + accurate pause tracking
--
-- 1) sessions.name — an optional, user-given label for a session so History
--    can show something more useful than a timestamp ("Chapter 3 draft"
--    instead of "Session from 3:04pm").
--
-- 2) cycle_logs.paused_seconds — the actual accumulated time the timer sat
--    paused *during that specific cycle*. started_at/ended_at already span
--    the full wall-clock duration including any pauses, but paused_seconds
--    makes the split between "focused time" and "paused time" explicit and
--    queryable instead of inferred.

alter table sessions   add column if not exists name text;
alter table cycle_logs add column if not exists paused_seconds integer not null default 0;
