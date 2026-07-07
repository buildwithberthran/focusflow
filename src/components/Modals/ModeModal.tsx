import { useTimerEngine } from '../../context/TimerEngineContext';

export default function ModeModal() {
  const { state, actions } = useTimerEngine();
  if (!state.modeModalOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) actions.patch({ modeModalOpen: false });
      }}
    >
      <div className="modal">
        <h2>How should cycles run?</h2>
        <p>
          <strong>Autopilot</strong> — next countdown starts automatically after each break.
          <br />
          <br />
          <strong>Manual</strong> — waits for you to press Continue after each break.
        </p>
        <div className="modal-btns">
          <button id="modeAutoBtn" onClick={() => actions.doStart(true)}>
            🤖 Autopilot
          </button>
          <button id="modeManualBtn" onClick={() => actions.doStart(false)}>
            🖐 Manual
          </button>
        </div>
      </div>
    </div>
  );
}
