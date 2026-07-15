import type { RecoverableSession } from '../../lib/db';

export default function DeleteSessionModal({
  row,
  onCancel,
  onConfirm,
}: {
  row: RecoverableSession | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!row) return null;
  const { session, snapshot } = row;
  const date = new Date(session.started_at).toLocaleString();

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal">
        <h2>End this session?</h2>
        <p>
          "{session.name || 'Untitled session'}" from {date}
          {snapshot ? ` (${snapshot.completed_cycles} cycle${snapshot.completed_cycles === 1 ? '' : 's'} done)` : ''}{' '}
          will be permanently closed. This can't be undone — it won't appear in Recover anymore, but
          it stays in your History.
        </p>
        <div className="modal-btns">
          <button style={{ background: '#454B51', color: '#9BA3A8' }} onClick={onCancel}>
            Cancel
          </button>
          <button style={{ background: '#D06868', color: '#EEF1EE' }} onClick={onConfirm}>
            End session
          </button>
        </div>
      </div>
    </div>
  );
}
