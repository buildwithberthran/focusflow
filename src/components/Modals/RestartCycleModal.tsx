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
          <button style={{ background: '#3f4a60', color: '#aab2c5' }} onClick={onClose}>
            Cancel
          </button>
          <button style={{ background: '#e05656', color: '#fff' }} onClick={confirm}>
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}
