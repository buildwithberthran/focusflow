import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useTimerEngine } from '../../context/TimerEngineContext';

export default function CyclePreview() {
  const { state, actions, derived } = useTimerEngine();
  const { schedule } = state;
  if (!schedule.length) return null;

  const total = schedule.reduce((a, b) => a + b.min, 0);
  const activeIndex =
    state.appMode === 'target' && (state.phase === 'countdown' || state.phase === 'break')
      ? state.scheduleIndex
      : -1;
  const disabled = derived.inputsDisabled;

  return (
    <div className="cycle-preview">
      <div className="cycle-preview-header">
        <span>Cycle Schedule</span>
        <span className="total-pill">{total} min total</span>
      </div>
      <div className="cycle-col-headers">
        <span className="ch-order" />
        <span className="ch-num">#</span>
        <span className="ch-min">Min</span>
        <span className="ch-lbl">Task label</span>
      </div>
      <div>
        {schedule.map((c, idx) => (
          <div className={'cycle-row' + (idx === activeIndex ? ' active-cycle' : '')} key={idx}>
            <span className="cycle-order-btns">
              <button
                className="cycle-order-btn"
                title="Move up"
                disabled={disabled || idx === 0}
                onClick={() => actions.moveCycle(idx, 'up')}
              >
                <ChevronUp size={13} strokeWidth={2.4} />
              </button>
              <button
                className="cycle-order-btn"
                title="Move down"
                disabled={disabled || idx === schedule.length - 1}
                onClick={() => actions.moveCycle(idx, 'down')}
              >
                <ChevronDown size={13} strokeWidth={2.4} />
              </button>
            </span>
            <span className="cycle-num">{idx + 1}.</span>
            <input
              type="number"
              min={1}
              step={1}
              className="cycle-min-input"
              defaultValue={c.min}
              disabled={disabled}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isInteger(v) && v >= 1) actions.updateCycleMin(idx, v);
              }}
            />
            <input
              type="text"
              placeholder="Task label…"
              maxLength={120}
              className="cycle-label-input"
              value={c.label}
              disabled={disabled}
              onChange={(e) => actions.updateCycleLabel(idx, e.target.value)}
            />
            <button
              className="cycle-del-btn"
              title="Remove"
              disabled={disabled}
              onClick={() => actions.removeCycle(idx)}
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
