import { supabase } from './supabaseClient';
import type {
  AppMode,
  CycleLogRow,
  CycleItem,
  ResumePoint,
  SessionRow,
  SnapshotRow,
  TemplateRow,
  UserSettings,
} from '../types';

const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id' | 'updated_at'> = {
  startup_mode: 'ask',
  ask_feedback_after_cycle: true,
  default_break_seconds_standard: 10,
  default_break_seconds_target: 10,
  default_alert_sound: 'beep',
  transition_seconds: 3,
  transition_before_break: true,
  end_alert_enabled: false,
  end_alert_seconds: 10,
  end_alert_use_task_label: false,
  long_pause_check_enabled: false,
  long_pause_cycle_minutes: 15,
  long_pause_break_mode: 'percent',
  long_pause_break_percent: 50,
  long_pause_break_minutes: 5,
  theme: 'dark',
};

export async function dbGetSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error || !data) {
    return { user_id: userId, updated_at: new Date().toISOString(), ...DEFAULT_SETTINGS };
  }
  return data as UserSettings;
}

export async function dbUpsertSettings(userId: string, updates: Partial<UserSettings>) {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function dbStartSession(
  userId: string,
  mode: AppMode,
  autopilot: boolean,
  name?: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      name: name?.trim() || null,
      mode,
      autopilot,
      total_cycles: 0,
      status: 'active',
    })
    .select()
    .single();
  if (error) {
    console.warn('DB session insert:', error.message);
    return null;
  }
  return data.id;
}

export async function dbStartCycle(
  userId: string,
  sessionId: string,
  cycleNumber: number,
  durationMin: number,
  label: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('cycle_logs')
    .insert({
      user_id: userId,
      session_id: sessionId,
      cycle_number: cycleNumber,
      duration_min: durationMin,
      task_label: label,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    console.warn('DB cycle insert:', error.message);
    return null;
  }
  return data.id;
}

export async function dbEndCycle(
  cycleLogId: string,
  completed: 'yes' | 'no' | null,
  note: string,
  pausedSeconds = 0
) {
  const { error } = await supabase
    .from('cycle_logs')
    .update({
      completed: completed === null ? null : completed === 'yes',
      log_note: note || '',
      paused_seconds: pausedSeconds,
      ended_at: new Date().toISOString(),
    })
    .eq('id', cycleLogId);
  if (error) console.warn('DB cycle update:', error.message);
}

// General-purpose partial update — used for attaching a pause reason, and
// for retroactively correcting completed/log_note from the History page.
export async function dbUpdateCycleLog(
  cycleLogId: string,
  updates: Partial<
    Pick<
      CycleLogRow,
      'completed' | 'log_note' | 'pause_reason' | 'break_pause_reason' | 'extension_log' | 'restart_count'
    >
  >
) {
  const { error } = await supabase.from('cycle_logs').update(updates).eq('id', cycleLogId);
  if (error) throw error;
}

// Appends one extension amount to the cycle's running list — reads the
// current list first so concurrent tabs/extensions don't clobber each other.
export async function dbAppendCycleExtension(cycleLogId: string, minutes: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('cycle_logs')
    .select('extension_log')
    .eq('id', cycleLogId)
    .single();
  if (error) throw error;
  const next = [...((data?.extension_log as number[]) || []), minutes];
  const { error: updateError } = await supabase
    .from('cycle_logs')
    .update({ extension_log: next })
    .eq('id', cycleLogId);
  if (updateError) throw updateError;
  return next;
}

// Resets progress for a restart: clears extensions (a restart is a fresh
// attempt, previous overruns don't carry over) and bumps restart_count so the
// do-over itself stays visible.
export async function dbRegisterCycleRestart(cycleLogId: string): Promise<number> {
  const { data, error } = await supabase
    .from('cycle_logs')
    .select('restart_count')
    .eq('id', cycleLogId)
    .single();
  if (error) throw error;
  const next = ((data?.restart_count as number) || 0) + 1;
  const { error: updateError } = await supabase
    .from('cycle_logs')
    .update({ restart_count: next, extension_log: [], started_at: new Date().toISOString() })
    .eq('id', cycleLogId);
  if (updateError) throw updateError;
  return next;
}

export async function dbRenameSession(sessionId: string, name: string) {
  const { error } = await supabase
    .from('sessions')
    .update({ name: name.trim() || null })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function dbEndSession(
  sessionId: string,
  totalCycles: number,
  status: 'completed' | 'interrupted' | 'abandoned' = 'completed'
) {
  const { error } = await supabase
    .from('sessions')
    .update({ finished_at: new Date().toISOString(), total_cycles: totalCycles, status })
    .eq('id', sessionId);
  if (error) console.warn('DB session update:', error.message);
}

export async function dbSaveSnapshot(userId: string, snap: Omit<SnapshotRow, 'user_id'>) {
  const { error } = await supabase
    .from('session_snapshots')
    .upsert({ ...snap, user_id: userId }, { onConflict: 'session_id' });
  if (error) console.warn('Snapshot failed:', error.message);
}

export async function dbDeleteSnapshot(sessionId: string) {
  const { error } = await supabase.from('session_snapshots').delete().eq('session_id', sessionId);
  if (error) console.warn('Snapshot delete failed:', error.message);
}

// Non-destructive: never mutates session status as a side effect of reading.
// (Previously this silently flipped an "active" session to "interrupted" the
// instant it couldn't find a snapshot yet — which could fire on a session
// that was still genuinely running, just mid-write. Reads should never mutate.)
export async function dbFindInterruptedSession(
  excludeSessionId?: string | null
): Promise<{ session: SessionRow; snapshot: SnapshotRow } | null> {
  let query = supabase
    .from('sessions')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(5);
  const { data: sessions, error } = await query;
  if (error || !sessions || !sessions.length) return null;

  const candidates = excludeSessionId ? sessions.filter((s) => s.id !== excludeSessionId) : sessions;
  if (!candidates.length) return null;
  const session = candidates[0] as SessionRow;

  const { data: snaps } = await supabase
    .from('session_snapshots')
    .select('*')
    .eq('session_id', session.id);

  if (!snaps || !snaps.length) return null;
  return { session, snapshot: snaps[0] as SnapshotRow };
}

export interface RecoverableSession {
  session: SessionRow;
  snapshot: SnapshotRow | null;
}

// Everything that isn't cleanly finished — for the dedicated recovery page.
export async function dbListRecoverableSessions(excludeSessionId?: string | null): Promise<RecoverableSession[]> {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .in('status', ['active', 'interrupted'])
    .order('started_at', { ascending: false })
    .limit(50);
  if (error || !sessions) return [];

  const candidates = (excludeSessionId ? sessions.filter((s) => s.id !== excludeSessionId) : sessions) as SessionRow[];
  if (!candidates.length) return [];

  const ids = candidates.map((s) => s.id);
  const { data: snaps } = await supabase.from('session_snapshots').select('*').in('session_id', ids);
  const snapBySession: Record<string, SnapshotRow> = {};
  (snaps || []).forEach((sn) => (snapBySession[sn.session_id] = sn as SnapshotRow));

  return candidates.map((session) => ({ session, snapshot: snapBySession[session.id] || null }));
}

export async function dbAbandonSession(sessionId: string) {
  await supabase
    .from('sessions')
    .update({ status: 'abandoned', finished_at: new Date().toISOString() })
    .eq('id', sessionId);
  await supabase.from('session_snapshots').delete().eq('session_id', sessionId);
}

export async function dbListSessions(limit = 100): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as SessionRow[];
}

export async function dbListCycleLogsForSessions(sessionIds: string[]): Promise<CycleLogRow[]> {
  if (!sessionIds.length) return [];
  const { data, error } = await supabase
    .from('cycle_logs')
    .select('*')
    .in('session_id', sessionIds)
    .order('cycle_number', { ascending: true });
  if (error) throw error;
  return data as CycleLogRow[];
}

export async function dbListAllCycleLogs(limit = 5000): Promise<CycleLogRow[]> {
  const { data, error } = await supabase
    .from('cycle_logs')
    .select('*')
    .order('session_id', { ascending: true })
    .order('cycle_number', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as CycleLogRow[];
}

export async function dbListTemplates(): Promise<TemplateRow[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as TemplateRow[];
}

export async function dbInsertTemplate(
  userId: string,
  name: string,
  breakSeconds: number,
  schedule: CycleItem[]
) {
  const { error } = await supabase
    .from('templates')
    .insert({ user_id: userId, name, break_seconds: breakSeconds, schedule });
  if (error) throw error;
}

export async function dbUpdateTemplate(
  id: string,
  updates: { name?: string; break_seconds?: number; schedule?: CycleItem[] }
) {
  const { error } = await supabase.from('templates').update(updates).eq('id', id);
  if (error) throw error;
}

export async function dbDeleteTemplate(id: string) {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw error;
}

export type { ResumePoint };
