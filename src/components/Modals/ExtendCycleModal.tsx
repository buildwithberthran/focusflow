import { useState } from 'react';
import { useTimerEngine } from '../../context/TimerEngineContext';

const QUICK_OPTIONS = [5, 10, 15];

export default function ExtendCycleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useTimerEngine();
  const [custom, setCustom] = useState('');

  if (!open) return null;

  function apply(minutes: number) {
    if (minutes > 0) actions.extendCurrentCycle(minutes);
    setCustom('');
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
        <h2>Need more time?</h2>
        <p>Add minutes to this cycle without losing your original estimate — History keeps both.</p>
        <div className="extend-quick-row">
          {QUICK_OPTIONS.map((m) => (
            <button key={m} className="extend-quick-btn" onClick={() => apply(m)}>
              +{m}m
            </button>
          ))}
        </div>
        <div className="full-input">
          <label>Custom (min)</label>
          <input
            type="number"
            min={1}
            step={1}
            value={custom}
            placeholder="e.g. 8"
            onChange={(e) => setCustom(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-btns">
          <button style={{ background: '#3f4a60', color: '#aab2c5' }} onClick={onClose}>
            Cancel
          </button>
          <button
            style={{ background: '#4caf50', color: '#fff' }}
            onClick={() => apply(parseInt(custom, 10) || 0)}
          >
            Add time
          </button>
        </div>
      </div>
    </div>
  );
}
