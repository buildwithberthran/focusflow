import { useCallback, useEffect, useState } from 'react';
import { Play, RotateCw, XCircle } from 'lucide-react';
import { useTimerEngine } from '../../context/TimerEngineContext';
import { dbAbandonSession, dbListRecoverableSessions, type RecoverableSession } from '../../lib/db';
import { describeResumeChoice } from '../../lib/resumeChoice';
import type { Page } from '../Layout/AppShell';
import ResumeChoiceModal from '../Modals/ResumeChoiceModal';
import DeleteSessionModal from '../Modals/DeleteSessionModal';

export default function RecoverPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { state, actions } = useTimerEngine();
  const [rows, setRows] = useState<RecoverableSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [choiceRow, setChoiceRow] = useState<RecoverableSession | null>(null);
  const [deleteRow, setDeleteRow] = useState<RecoverableSession | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbListRecoverableSessions(state.currentSessionId);
      setRows(data);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentSessionId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveElsewhere = state.phase !== 'idle';

  async function runResume(row: RecoverableSession, choice: 'continue' | 'restart') {
    if (!row.snapshot) return;
    setBusyId(row.session.id);
    try {
      await actions.doResume(row.session, row.snapshot, choice);
      onNavigate('timer');
    } finally {
      setBusyId(null);
      setChoiceRow(null);
    }
  }

  function handleResume(row: RecoverableSession) {
    if (!row.snapshot) return;
    if (liveElsewhere) {
      alert('Finish or reset your current session before resuming another one.');
      return;
    }
    // Only bother the person with a choice when there's a real one to make.
    if (describeResumeChoice(row.snapshot).hasRealChoice) {
      setChoiceRow(row);
    } else {
      void runResume(row, 'restart');
    }
  }

  async function handleRestart(row: RecoverableSession) {
    if (liveElsewhere) {
      alert('Finish or reset your current session before starting another one.');
      return;
    }
    setBusyId(row.session.id);
    try {
      await dbAbandonSession(row.session.id);
      if (row.snapshot) actions.configureFromSnapshot(row.snapshot, row.session.name);
      await load();
      onNavigate('timer');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmEnd() {
    if (!deleteRow) return;
    setBusyId(deleteRow.session.id);
    try {
      await dbAbandonSession(deleteRow.session.id);
      await load();
    } finally {
      setBusyId(null);
      setDeleteRow(null);
    }
  }

  return (
    <div id="recoverPage" className="page-dashboard">
      <div className="page-header">
        <h1>Recover sessions</h1>
        <p>Sessions that didn't finish cleanly — resume where you left off, restart with the same setup, or end them for good.</p>
      </div>

      {liveElsewhere && (
        <div className="recover-notice">
          A session is currently active on the Timer page. Finish or reset it before resuming or restarting another.
        </div>
      )}

      {loading && <div className="history-loading">Loading…</div>}

      {!loading && !rows.length && (
        <div className="empty-state">
          <div className="es-icon">✅</div>
          Nothing to recover — every past session ended cleanly.
        </div>
      )}

      {!loading &&
        rows.map((row) => {
          const { session: s, snapshot } = row;
          const date = new Date(s.started_at).toLocaleString();
          const busy = busyId === s.id;
          return (
            <div className="recover-item" key={s.id}>
              <div className="recover-meta">
                <div className="recover-name">
                  {s.name || 'Untitled session'}
                  <span className={'recover-status-pill status-' + s.status}>{s.status}</span>
                </div>
                <div className="recover-sub">
                  {s.mode} · started {date}
                  {snapshot
                    ? ` · ${snapshot.completed_cycles} cycle${snapshot.completed_cycles === 1 ? '' : 's'} done`
                    : ' · no resume data available'}
                </div>
              </div>
              <div className="recover-actions">
                <button
                  className="recover-btn resume"
                  disabled={!snapshot || busy || liveElsewhere}
                  title={snapshot ? 'Resume from where it left off' : 'No snapshot to resume from'}
                  onClick={() => handleResume(row)}
                >
                  <Play size={14} strokeWidth={2.4} /> Resume
                </button>
                <button
                  className="recover-btn restart"
                  disabled={busy || liveElsewhere}
                  title="Start fresh with the same setup"
                  onClick={() => handleRestart(row)}
                >
                  <RotateCw size={14} strokeWidth={2.4} /> Restart
                </button>
                <button className="recover-btn end" disabled={busy} onClick={() => setDeleteRow(row)}>
                  <XCircle size={14} strokeWidth={2.4} /> End
                </button>
              </div>
            </div>
          );
        })}

      <ResumeChoiceModal
        snapshot={choiceRow?.snapshot ?? null}
        onCancel={() => setChoiceRow(null)}
        onChoose={(choice) => choiceRow && runResume(choiceRow, choice)}
      />
      <DeleteSessionModal row={deleteRow} onCancel={() => setDeleteRow(null)} onConfirm={confirmEnd} />
    </div>
  );
}
