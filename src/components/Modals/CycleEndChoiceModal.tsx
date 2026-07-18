import { useEffect, useState } from 'react';
import { useTimerEngine } from '../../context/TimerEngineContext';

const QUICK_OPTIONS = [5, 10, 15];

export default function CycleEndChoiceModal() {
  const { state, actions } = useTimerEngine();
  const [step, setStep] = useState<'main' | 'extend' | 'restart'>('main');
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (state.cycleEndChoiceOpen) {
      setStep('main');
      setCustom('');
    }
  }, [state.cycleEndChoiceOpen]);

  if (!state.cycleEndChoiceOpen) return null;

  function applyExtend(minutes: number) {
    if (minutes > 0) actions.resolveCycleEndChoice('extend', minutes);
  }

  if (step === 'extend') {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <h2>Need more time?</h2>
          <p>Add minutes to this cycle without losing your original estimate — History keeps both.</p>
          <div className="extend-quick-row">
            {QUICK_OPTIONS.map((m) => (
              <button key={m} className="extend-quick-btn" onClick={() => applyExtend(m)}>
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
            <button style={{ background: '#454B51', color: '#9BA3A8' }} onClick={() => setStep('main')}>
              Back
            </button>
            <button
              style={{ background: '#3B8A81', color: '#EEF1EE' }}
              onClick={() => applyExtend(parseInt(custom, 10) || 0)}
            >
              Add time
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'restart') {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <h2>Restart this cycle?</h2>
          <p>
            Runs the same length again from the top. Any extensions already on this cycle stay in
            the record — a restart resets the countdown, not the tally (History shows a "Restarted"
            badge alongside it).
          </p>
          <div className="modal-btns">
            <button style={{ background: '#454B51', color: '#9BA3A8' }} onClick={() => setStep('main')}>
              Back
            </button>
            <button
              style={{ background: '#3B8A81', color: '#EEF1EE' }}
              onClick={() => actions.resolveCycleEndChoice('restart')}
            >
              Restart
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Time's up</h2>
        <p>Did you finish, or do you need a bit more time?</p>
        <div className="modal-btns" style={{ flexDirection: 'column', gap: 10 }}>
          <button
            style={{ background: '#3B8A81', color: '#EEF1EE', width: '100%' }}
            onClick={() => actions.resolveCycleEndChoice('done')}
          >
            ✓ I'm done
          </button>
          <button
            style={{ background: '#33383D', color: '#EEF1EE', width: '100%' }}
            onClick={() => setStep('extend')}
          >
            + Need more time
          </button>
          <button
            style={{ background: 'transparent', border: '1px solid #454B51', color: '#9BA3A8', width: '100%' }}
            onClick={() => setStep('restart')}
          >
            ↻ Restart this cycle
          </button>
        </div>
      </div>
    </div>
  );
}
