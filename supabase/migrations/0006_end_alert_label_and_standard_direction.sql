alter table user_settings add column if not exists end_alert_use_task_label boolean not null default false;

-- Standard mode: direction (decreasing/increasing) + custom step, persisted on
-- the snapshot so a resumed session knows which way to keep counting.
alter table session_snapshots add column if not exists standard_direction text not null default 'decreasing';
alter table session_snapshots add column if not exists standard_step_min integer not null default 1;
