export type Phase =
  | 'idle'
  | 'countdown'
  | 'break'
  | 'waiting'
  | 'paused'
  | 'announcing-break'
  | 'announcing-next'
  | 'reviewing'
  | 'finished';

export type AppMode = 'standard' | 'target';
export type SubMode = 'auto' | 'manual';
export type AlertSound = 'beep' | 'voice';
export type ResumePoint = 'this_cycle' | 'next_cycle';

export interface CycleItem {
  min: number;
  label: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  name: string | null;
  mode: AppMode;
  autopilot: boolean;
  total_cycles: number;
  status: 'active' | 'completed' | 'interrupted' | 'abandoned';
  started_at: string;
  finished_at: string | null;
}

export interface CycleLogRow {
  id: string;
  user_id: string;
  session_id: string;
  cycle_number: number;
  duration_min: number;
  task_label: string | null;
  completed: boolean | null;
  log_note: string | null;
  paused_seconds: number;
  pause_reason: string | null;
  break_pause_reason: string | null;
  extension_log: number[];
  restart_count: number;
  started_at: string;
  ended_at: string | null;
}

export interface TemplateRow {
  id: string;
  user_id: string;
  name: string;
  break_seconds: number;
  schedule: CycleItem[];
  created_at: string;
}

export interface SnapshotRow {
  session_id: string;
  user_id: string;
  snapshot_at: string;
  app_mode: AppMode;
  autopilot: boolean;
  break_seconds: number;
  alert_sound: AlertSound;
  start_min: number | null;
  end_min: number | null;
  std_task_label: string | null;
  schedule: CycleItem[] | null;
  schedule_index: number;
  current_cycle_min: number;
  completed_cycles: number;
  resume_point: ResumePoint;
  remaining_seconds: number | null;
  standard_direction: 'decreasing' | 'increasing';
  standard_step_min: number;
}

export type StartupMode = 'ask' | 'autopilot' | 'manual';
export type Theme = 'dark' | 'light';
export type PopupStyle = 'ring' | 'minimal' | 'bar';

export interface UserSettings {
  user_id: string;
  startup_mode: StartupMode;
  ask_feedback_after_cycle: boolean;
  default_break_seconds_standard: number;
  default_break_seconds_target: number;
  default_alert_sound: AlertSound;
  transition_seconds: number;
  transition_before_break: boolean;
  end_alert_enabled: boolean;
  end_alert_seconds: number;
  end_alert_use_task_label: boolean;
  long_pause_check_enabled: boolean;
  long_pause_cycle_minutes: number;
  long_pause_break_mode: 'percent' | 'minutes';
  long_pause_break_percent: number;
  long_pause_break_minutes: number;
  popup_style: PopupStyle;
  theme: Theme;
  updated_at: string;
}

export interface DisplayState {
  time: string;
  cycle: string;
  status: string;
  progress: string;
  task: string;
  paused: boolean;
  fraction: number; // 0..1 remaining, for progress rings
  isBreak: boolean;
}
