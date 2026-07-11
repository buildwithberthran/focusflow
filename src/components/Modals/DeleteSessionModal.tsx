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
          <button style={{ background: '#3f4a60', color: '#aab2c5' }} onClick={onCancel}>
            Cancel
          </button>
          <button style={{ background: '#e05656', color: '#fff' }} onClick={onConfirm}>
            End session
          </button>
        </div>
      </div>
    </div>
  );
}
