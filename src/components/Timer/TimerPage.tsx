import { useEffect, useState } from 'react';
import { Play, Pause, Square, SkipForward, ExternalLink, Target, LayoutList } from 'lucide-react';
import { useTimerEngine } from '../../context/TimerEngineContext';
import { useTemplates } from '../../hooks/useTemplates';
import StatsBar from '../Layout/StatsBar';
import ResumeBanner from './ResumeBanner';
import CyclePreview from './CyclePreview';
import ProgressRing from './ProgressRing';
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

  const isBreak = state.phase === 'break';
  const totalSeconds = isBreak
    ? state.appMode === 'standard'
      ? state.breakSeconds
      : state.tBreakSeconds
    : state.currentCycleMin * 60;
  const ringProgress = totalSeconds > 0 ? state.remainingSeconds / totalSeconds : 0;
  const ringColor = isBreak ? 'var(--ff-rest)' : 'var(--ff-focus)';

  return (
    <div id="timerPage" className="page-dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Cycles taper as you go — long focus blocks up front, shorter ones as attention fades.</p>
      </div>

      <StatsBar />
      <ResumeBanner />

      <div className="timer-grid">
        {/* ── Live timer card ── */}
        <div className="panel-card live-card">
          <ProgressRing progress={ringProgress} color={ringColor} size={252} strokeWidth={9}>
            <div className={'time' + (state.display.paused ? ' paused' : '')}>{state.display.time}</div>
            <div className="cycle-label">{state.display.cycle}</div>
          </ProgressRing>

          <div className="task-display">{state.display.task}</div>
          <div className="status">{state.display.status}</div>
          <div className="progress-row">{state.display.progress}</div>
          {btn.modeBadge && (
            <div className={'mode-badge ' + btn.modeBadge}>
              {btn.modeBadge === 'auto' ? 'Autopilot' : 'Manual'}
            </div>
          )}

          <div className="buttons-row">
            {btn.showStart && (
              <button id="startBtn" disabled={btn.startDisabled} onClick={() => actions.requestStart()}>
                <Play size={16} strokeWidth={2.4} /> Start
              </button>
            )}
            {btn.showPause && (
              <button id="pauseBtn" disabled={btn.pauseDisabled} onClick={() => actions.pauseTimer()}>
                <Pause size={16} strokeWidth={2.4} /> Pause
              </button>
            )}
            {btn.showResume && (
              <button id="resumeBtn" disabled={btn.resumeDisabled} onClick={() => actions.resumeTimer()}>
                <Play size={16} strokeWidth={2.4} /> Resume
              </button>
            )}
            <button id="stopBtn" disabled={btn.stopDisabled} onClick={() => actions.stopAndReset()}>
              <Square size={15} strokeWidth={2.4} /> Reset
            </button>
          </div>

          {btn.showContinue && (
            <button id="continueBtn" onClick={() => actions.continueNextCycle()}>
              <SkipForward size={16} strokeWidth={2.4} /> Continue Next Cycle
            </button>
          )}

          <button id="popoutBtn" onClick={() => actions.openPopout()}>
            <ExternalLink size={15} strokeWidth={2.2} /> Pop out
            {derived.hasPiP ? <span className="pip-badge">PiP</span> : null}
          </button>

          <div className="error">{state.errorMsg}</div>
        </div>

        {/* ── Schedule / config card ── */}
        <div className="panel-card config-card">
          <div className="seg-tabs">
            <button
              className={'seg-tab' + (state.appMode === 'standard' ? ' active' : '')}
              onClick={() => actions.setAppMode('standard')}
            >
              <LayoutList size={15} strokeWidth={2.2} /> Standard
            </button>
            <button
              className={'seg-tab' + (state.appMode === 'target' ? ' active' : '')}
              onClick={() => actions.setAppMode('target')}
            >
              <Target size={15} strokeWidth={2.2} /> Target Total
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
                <select
                  value={selectedTplId}
                  onChange={(e) => setSelectedTplId(e.target.value)}
                  disabled={disabled}
                >
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
                  Auto-calculate
                </button>
                <button
                  className={'sub-tab' + (state.subMode === 'manual' ? ' active' : '')}
                  onClick={() => actions.setSubMode('manual')}
                >
                  Manual entry
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
                        onChange={(e) =>
                          actions.patch({
                            acTarget: parseInt(e.target.value, 10) || 0,
                            autoHint: 'Click Generate to preview.',
                          })
                        }
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
                        onChange={(e) =>
                          actions.patch({
                            acStart: parseInt(e.target.value, 10) || 0,
                            autoHint: 'Click Generate to preview.',
                          })
                        }
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
                        onChange={(e) =>
                          actions.patch({
                            acStep: parseInt(e.target.value, 10) || 0,
                            autoHint: 'Click Generate to preview.',
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="target-hint">{state.autoHint}</div>
                  <button className="generate-btn" disabled={disabled} onClick={() => actions.generateAutoSchedule()}>
                    Generate Schedule
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
        </div>
      </div>

      <ModeModal />
      <ReviewModal />
      <TemplateNameModal onSaved={refresh} />
    </div>
  );
}
