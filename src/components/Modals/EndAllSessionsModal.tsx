export default function EndAllSessionsModal({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!count) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal">
        <h2>End all {count} session{count === 1 ? '' : 's'}?</h2>
        <p>
          Every session listed here will be permanently closed. This can't be undone — they'll stay
          in your History, just won't be recoverable anymore.
        </p>
        <div className="modal-btns">
          <button style={{ background: '#454B51', color: '#9BA3A8' }} onClick={onCancel}>
            Cancel
          </button>
          <button style={{ background: '#D06868', color: '#EEF1EE' }} onClick={onConfirm}>
            End all
          </button>
        </div>
      </div>
    </div>
  );
}
