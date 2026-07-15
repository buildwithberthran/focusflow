import { useTimerEngine } from '../../context/TimerEngineContext';

export default function RestartCycleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useTimerEngine();
  if (!open) return null;

  function confirm() {
    actions.restartCurrentCycle();
    onClose();
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <h2>Restart this cycle?</h2>
        <p>
          Progress and any extensions on this attempt are cleared, and it starts fresh from its
          original length. It'll show as "Restarted" in History — nothing is hidden.
        </p>
        <div className="modal-btns">
          <button style={{ background: '#454B51', color: '#9BA3A8' }} onClick={onClose}>
            Cancel
          </button>
          <button style={{ background: '#D06868', color: '#EEF1EE' }} onClick={confirm}>
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}
