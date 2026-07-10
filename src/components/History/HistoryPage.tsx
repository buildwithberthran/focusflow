import { useCallback, useEffect, useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import type { CycleLogRow, SessionRow } from '../../types';
import { dbListAllCycleLogs, dbListCycleLogsForSessions, dbListSessions, dbRenameSession } from '../../lib/db';
import { formatDurationExact } from '../../lib/time';

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [logs, setLogs] = useState<CycleLogRow[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sess = await dbListSessions(100);
      setSessions(sess);
      const ids = sess.map((s) => s.id);
      const cycleLogs = await dbListCycleLogsForSessions(ids);
      setLogs(cycleLogs);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportCsv() {
    try {
      const sessAll = await dbListSessions(500);
      const logsAll = await dbListAllCycleLogs(5000);
      const bySession: Record<string, SessionRow> = {};
      sessAll.forEach((s) => (bySession[s.id] = s));
      const rows: (string | number)[][] = [
        [
          'Session ID',
          'Session Date',
          'Mode',
          'Autopilot',
          'Status',
          'Cycle #',
          'Duration (min)',
          'Task Label',
          'Completed',
          'Notes',
          'Cycle Start',
          'Cycle End',
        ],
      ];
      logsAll.forEach((l) => {
        const sess = bySession[l.session_id];
        rows.push([
          l.session_id,
          sess?.started_at || '',
          sess?.mode || '',
          sess?.autopilot ? 'Yes' : 'No',
          sess?.status || '',
          l.cycle_number,
          l.duration_min,
          l.task_label || '',
          l.completed === true ? 'Yes' : l.completed === false ? 'No' : '',
          l.log_note || '',
          l.started_at || '',
          l.ended_at || '',
        ]);
      });
      const csv = rows
        .map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(','))
        .join('\n');
      const a = document.createElement('a');
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
      a.download = 'focusflow-history-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    }
  }

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div id="historyPage" className="page-dashboard">
      <div className="page-header">
        <h1>History</h1>
        <p>Every session, cycle, and note you've logged.</p>
      </div>

      <div className="history-toolbar">
        <button onClick={load}>↻ Refresh</button>
        <button onClick={exportCsv}>⬇ Export CSV</button>
      </div>

      {loading && <div className="history-loading">Loading…</div>}
      {error && <div className="history-loading" style={{ color: '#ff6b6b' }}>Error: {error}</div>}
      {!loading && !error && !sessions.length && (
        <div className="empty-state">
          <div className="es-icon">📭</div>No sessions yet.
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <HistoryBody sessions={sessions} logs={logs} openIds={openIds} onToggle={toggle} onRenamed={load} />
      )}
    </div>
  );
}

function HistoryBody({
  sessions,
  logs,
  openIds,
  onToggle,
  onRenamed,
}: {
  sessions: SessionRow[];
  logs: CycleLogRow[];
  openIds: Set<string>;
  onToggle: (id: string) => void;
  onRenamed: () => void;
}) {
  const bySession: Record<string, CycleLogRow[]> = {};
  logs.forEach((l) => {
    if (!bySession[l.session_id]) bySession[l.session_id] = [];
    bySession[l.session_id].push(l);
  });

  const totalSessions = sessions.length;
  const totalCycles = logs.length;
  const doneLogs = logs.filter((l) => l.completed === true);
  const pct = totalCycles > 0 ? Math.round((doneLogs.length / totalCycles) * 100) : 0;
  const totalMin = logs.reduce((a, l) => a + (l.duration_min || 0), 0);

  const taskMap: Record<string, { total: number; done: number }> = {};
  logs.forEach((l) => {
    const t = (l.task_label || '(unlabelled)').trim() || '(unlabelled)';
    if (!taskMap[t]) taskMap[t] = { total: 0, done: 0 };
    taskMap[t].total++;
    if (l.completed === true) taskMap[t].done++;
  });
  const taskRows = Object.entries(taskMap).sort((a, b) => b[1].total - a[1].total);

  return (
    <>
      <h3>Summary</h3>
      <div className="summary-grid">
        <div className="summary-card blue">
          <div className="sc-val">{totalSessions}</div>
          <div className="sc-lbl">Sessions</div>
        </div>
        <div className="summary-card">
          <div className="sc-val">{totalCycles}</div>
          <div className="sc-lbl">Cycles</div>
        </div>
        <div className="summary-card green">
          <div className="sc-val">{pct}%</div>
          <div className="sc-lbl">Completion</div>
        </div>
        <div className="summary-card yellow">
          <div className="sc-val">{totalMin}</div>
          <div className="sc-lbl">Total min</div>
        </div>
      </div>

      <h3>By task</h3>
      <table className="breakdown-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Cycles</th>
            <th>Done</th>
          </tr>
        </thead>
        <tbody>
          {taskRows.map(([task, d]) => {
            const tp = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
            return (
              <tr key={task}>
                <td>{task}</td>
                <td>{d.total}</td>
                <td>
                  {d.done}
                  <div className="pct-bar">
                    <div className="pct-bar-fill" style={{ width: tp + '%' }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3>Sessions</h3>
      {groupByDate(sessions).map((group) => (
        <div key={group.dateKey} className="date-group">
          <div className="date-group-header">{group.label}</div>
          {group.sessions.map((sess) => (
            <SessionItem
              key={sess.id}
              session={sess}
              logs={bySession[sess.id] || []}
              open={openIds.has(sess.id)}
              onToggle={() => onToggle(sess.id)}
              onRenamed={onRenamed}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function groupByDate(sessions: SessionRow[]) {
  const groups: Record<string, SessionRow[]> = {};
  sessions.forEach((s) => {
    const d = new Date(s.started_at);
    const key = d.toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  return Object.entries(groups)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .map(([dateKey, sess]) => ({
      dateKey,
      label:
        dateKey === today
          ? 'Today'
          : dateKey === yesterday
            ? 'Yesterday'
            : new Date(dateKey).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              }),
      sessions: sess,
    }));
}

function SessionItem({
  session: s,
  logs: sLogs,
  open,
  onToggle,
  onRenamed,
}: {
  session: SessionRow;
  logs: CycleLogRow[];
  open: boolean;
  onToggle: () => void;
  onRenamed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(s.name || '');
  const [saving, setSaving] = useState(false);

  const sTime = new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sDone = sLogs.filter((l) => l.completed === true).length;
  const sPct = sLogs.length > 0 ? Math.round((sDone / sLogs.length) * 100) : 0;
  const sMin = sLogs.reduce((a, l) => a + (l.duration_min || 0), 0);
  const statusIcon =
    s.status === 'completed' ? '✓' : s.status === 'interrupted' ? '⚡' : s.status === 'abandoned' ? '✕' : '●';

  async function saveName() {
    setSaving(true);
    try {
      await dbRenameSession(s.id, draftName);
      onRenamed();
    } catch (e: any) {
      alert('Rename failed: ' + e.message);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  return (
    <div className={'session-item' + (open ? ' open' : '')}>
      <div className="session-header" onClick={() => !editing && onToggle()}>
        <div className="session-meta">
          {editing ? (
            <div className="session-rename-row" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={draftName}
                maxLength={80}
                placeholder="Session name"
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveName();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
              <button className="icon-btn" disabled={saving} onClick={saveName} title="Save">
                <Check size={14} strokeWidth={2.4} />
              </button>
              <button className="icon-btn" onClick={() => setEditing(false)} title="Cancel">
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          ) : (
            <div className="session-date">
              {statusIcon} {s.name || <span className="session-untitled">Untitled session</span>} · {sTime}
              <button
                className="icon-btn rename-btn"
                title="Rename"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraftName(s.name || '');
                  setEditing(true);
                }}
              >
                <Pencil size={12} strokeWidth={2.2} />
              </button>
            </div>
          )}
          <div className="session-sub">
            {s.mode} · {sLogs.length} cycles · {sMin} min · {sPct}% done · {s.status}
          </div>
        </div>
        <span className={'session-badge' + (s.status === 'interrupted' ? ' interrupted' : '')}>
          {s.autopilot ? '🤖' : '🖐'}
        </span>
        <span className="session-chevron">▶</span>
      </div>
      <div className="session-body">
        {!sLogs.length && (
          <div style={{ fontSize: '0.8rem', color: '#5a6a88', padding: '6px 0' }}>No cycle data.</div>
        )}
        {sLogs.map((l) => {
          const dc = l.completed === true ? 'yes' : l.completed === false ? 'no' : 'skip';
          const dt = l.completed === true ? '✓ Yes' : l.completed === false ? '✗ No' : '–';
          return (
            <div className="cycle-log-row" key={l.id}>
              <span className="clr-num">{l.cycle_number}</span>
              <span className="clr-dur">{l.duration_min}m</span>
              <span className="clr-task">
                {l.task_label || '—'}
                {l.paused_seconds > 0 && (
                  <span className="clr-paused">
                    ⏸ paused {formatDurationExact(l.paused_seconds)}
                  </span>
                )}
              </span>
              <span className={'clr-done ' + dc}>{dt}</span>
              {l.log_note && <span className="clr-note">{l.log_note}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

