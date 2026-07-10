-- FocusFlow: exact resume position
--
-- Snapshots previously only recorded which cycle you were on, not how many
-- seconds were left in it. That meant resuming a paused cycle always
-- restarted it from its full nominal duration, even if you'd been 25 minutes
-- into a 30-minute cycle. This captures the exact remaining countdown so a
-- resume can offer "continue from where you left off" as a real option.

alter table session_snapshots add column if not exists remaining_seconds integer;
