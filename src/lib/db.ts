import { supabase } from './supabaseClient';
import type {
  AppMode,
  CycleLogRow,
  CycleItem,
  ResumePoint,
  SessionRow,
  SnapshotRow,
  TemplateRow,
} from '../types';

export async function dbStartSession(
  userId: string,
  mode: AppMode,
  autopilot: boolean
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ user_id: userId, mode, autopilot, total_cycles: 0, status: 'active' })
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

export async function dbEndCycle(cycleLogId: string, completed: 'yes' | 'no' | null, note: string) {
  const { error } = await supabase
    .from('cycle_logs')
    .update({
      completed: completed === null ? null : completed === 'yes',
      log_note: note || '',
      ended_at: new Date().toISOString(),
    })
    .eq('id', cycleLogId);
  if (error) console.warn('DB cycle update:', error.message);
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

export async function dbFindInterruptedSession(): Promise<{
  session: SessionRow;
  snapshot: SnapshotRow;
} | null> {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1);
  if (error || !sessions || !sessions.length) return null;
  const session = sessions[0] as SessionRow;

  const { data: snaps } = await supabase
    .from('session_snapshots')
    .select('*')
    .eq('session_id', session.id);

  if (!snaps || !snaps.length) {
    await supabase.from('sessions').update({ status: 'interrupted' }).eq('id', session.id);
    return null;
  }
  return { session, snapshot: snaps[0] as SnapshotRow };
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

export async function dbDeleteTemplate(id: string) {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw error;
}

export type { ResumePoint };
