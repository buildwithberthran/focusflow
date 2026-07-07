import { useEffect, useState } from 'react';
import { useTimerEngine } from '../../context/TimerEngineContext';
import { useTemplates } from '../../hooks/useTemplates';
import ResumeBanner from './ResumeBanner';
import CyclePreview from './CyclePreview';
import ModeModal from '../Modals/ModeModal';
import ReviewModal from '../Modals/ReviewModal';
import TemplateNameModal from '../Modals/TemplateNameModal';

export default function TimerPage() {
  const { state, actions, derived } = useTimerEngine();
  const { templates, refresh } = useTemplates();
  const [selectedTplId, setSelectedTplId] = useState('');

  useEffect(() => {
    actions.checkForInterruptedSession();
    actions.refreshIdleDisplay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disabled = derived.inputsDisabled;
  const btn = derived.buttonState;

  return (
    <div id="timerPage">
      <ResumeBanner />

      <div className="seg-tabs">
        <button
          className={'seg-tab' + (state.appMode === 'standard' ? ' active' : '')}
          onClick={() => actions.setAppMode('standard')}
        >
          Standard
        </button>
        <button
          className={'seg-tab' + (state.appMode === 'target' ? ' active' : '')}
          onClick={() => actions.setAppMode('target')}
        >
          🎯 Target Total
        </button>
      </div>

      {state.appMode === 'standard' && (
        <div id="standardPanel">
          <div className="inputs">
            <div>
              <label>Start time (min)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={state.startMin}
                disabled={disabled}
                onChange={(e) => actions.patch({ startMin: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div>
              <label>End time (min)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={state.endMin}
                disabled={disabled}
                onChange={(e) => actions.patch({ endMin: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div>
              <label>Break (sec)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={state.breakSeconds}
                disabled={disabled}
                onChange={(e) => actions.patch({ breakSeconds: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div>
              <label>Alert</label>
              <select
                value={state.alertSound}
                disabled={disabled}
                onChange={(e) => actions.patch({ alertSound: e.target.value as any })}
              >
                <option value="beep">Beep</option>
                <option value="voice">Voice</option>
              </select>
            </div>
          </div>
          <div className="full-input">
            <label>Task label (all cycles)</label>
            <input
              type="text"
              maxLength={120}
              placeholder="e.g. Deep work — Chapter 3"
              value={state.stdTaskLabel}
              disabled={disabled}
              onChange={(e) => actions.patch({ stdTaskLabel: e.target.value })}
            />
          </div>
        </div>
      )}

      {state.appMode === 'target' && (
        <div id="targetPanel">
          <div className="inputs">
            <div>
              <label>Break (sec)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={state.tBreakSeconds}
                disabled={disabled}
                onChange={(e) => actions.patch({ tBreakSeconds: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div>
              <label>Alert</label>
              <select
                value={state.tAlertSound}
                disabled={disabled}
                onChange={(e) => actions.patch({ tAlertSound: e.target.value as any })}
              >
                <option value="beep">Beep</option>
                <option value="voice">Voice</option>
              </select>
            </div>
          </div>

          <div className="template-strip">
            <label>Template:</label>
            <select value={selectedTplId} onChange={(e) => setSelectedTplId(e.target.value)} disabled={disabled}>
              <option value="">— none —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              className="tpl-btn tpl-load-btn"
              disabled={disabled}
              onClick={() => {
                if (!selectedTplId) {
                  actions.patch({ errorMsg: 'Select a template to load.' });
                  return;
                }
                const tpl = templates.find((t) => t.id === selectedTplId);
                if (tpl) actions.loadScheduleFromTemplate(tpl);
              }}
            >
              Load
            </button>
            <button
              className="tpl-btn tpl-save-btn"
              disabled={disabled}
              onClick={() => {
                if (!state.schedule.length) {
                  actions.patch({ errorMsg: 'Build a schedule before saving as template.' });
                  return;
                }
                actions.patch({ tplNameModalOpen: true });
              }}
            >
              Save as template
            </button>
          </div>

          <div className="sub-tabs">
            <button
              className={'sub-tab' + (state.subMode === 'auto' ? ' active' : '')}
              onClick={() => actions.setSubMode('auto')}
            >
              🤖 Auto-calculate
            </button>
            <button
              className={'sub-tab' + (state.subMode === 'manual' ? ' active' : '')}
              onClick={() => actions.setSubMode('manual')}
            >
              ✏️ Manual entry
            </button>
          </div>

          {state.subMode === 'auto' && (
            <div id="autoCalcPanel">
              <div className="inputs cols3">
                <div>
                  <label>Target (min)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={state.acTarget}
                    disabled={disabled}
                    onChange={(e) => actions.patch({ acTarget: parseInt(e.target.value, 10) || 0, autoHint: 'Click Generate to preview.' })}
                  />
                </div>
                <div>
                  <label>Start (min)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={state.acStart}
                    disabled={disabled}
                    onChange={(e) => actions.patch({ acStart: parseInt(e.target.value, 10) || 0, autoHint: 'Click Generate to preview.' })}
                  />
                </div>
                <div>
                  <label>Step (min)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={state.acStep}
                    disabled={disabled}
                    onChange={(e) => actions.patch({ acStep: parseInt(e.target.value, 10) || 0, autoHint: 'Click Generate to preview.' })}
                  />
                </div>
              </div>
              <div className="target-hint">{state.autoHint}</div>
              <button className="generate-btn" disabled={disabled} onClick={() => actions.generateAutoSchedule()}>
                ⚙️ Generate Schedule
              </button>
            </div>
          )}

          {state.subMode === 'manual' && (
            <div id="manualEntryPanel">
              <div className="target-hint">Add cycles below.</div>
              <div className="add-cycle-row">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={state.manualAddValue}
                  disabled={disabled}
                  onChange={(e) => actions.patch({ manualAddValue: parseInt(e.target.value, 10) || 0 })}
                />
                <button disabled={disabled} onClick={() => actions.addManualCycle()}>
                  + Add Cycle
                </button>
              </div>
            </div>
          )}

          <CyclePreview />
        </div>
      )}

      <div className="display">
        <div className={'time' + (state.display.paused ? ' paused' : '')}>{state.display.time}</div>
        <div className="cycle-label">{state.display.cycle}</div>
        <div className="task-display">{state.display.task}</div>
        <div className="status">{state.display.status}</div>
        <div className="progress-row">{state.display.progress}</div>
        {btn.modeBadge && (
          <div className={'mode-badge ' + btn.modeBadge}>
            {btn.modeBadge === 'auto' ? '🤖 Autopilot' : '🖐 Manual'}
          </div>
        )}
      </div>

      <div className="buttons-row">
        {btn.showStart && (
          <button id="startBtn" disabled={btn.startDisabled} onClick={() => actions.requestStart()}>
            ▶ Start
          </button>
        )}
        {btn.showPause && (
          <button id="pauseBtn" disabled={btn.pauseDisabled} onClick={() => actions.pauseTimer()}>
            ⏸ Pause
          </button>
        )}
        {btn.showResume && (
          <button id="resumeBtn" disabled={btn.resumeDisabled} onClick={() => actions.resumeTimer()}>
            ▶ Resume
          </button>
        )}
        <button id="stopBtn" disabled={btn.stopDisabled} onClick={() => actions.stopAndReset()}>
          ■ Reset
        </button>
      </div>
      {btn.showContinue && (
        <button id="continueBtn" style={{ display: 'block' }} onClick={() => actions.continueNextCycle()}>
          ▶ Continue Next Cycle
        </button>
      )}
      <div className="buttons-row secondary">
        <button id="popoutBtn" onClick={() => actions.openPopout()}>
          ⧉ Pop out{derived.hasPiP ? <span className="pip-badge">PiP</span> : null}
        </button>
      </div>
      <div className="error">{state.errorMsg}</div>

      <ModeModal />
      <ReviewModal />
      <TemplateNameModal onSaved={refresh} />
    </div>
  );
}
