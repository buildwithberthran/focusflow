import { Zap, Bell, Coffee, MessageSquare, Palette, TimerReset, AlarmClockCheck } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import type { AlertSound, StartupMode, Theme } from '../../types';
import Toggle from './Toggle';

export default function SettingsPage() {
  const { settings, loading, update } = useSettings();

  if (loading || !settings) {
    return (
      <div className="page-dashboard">
        <div className="page-header">
          <h1>Settings</h1>
        </div>
        <div className="history-loading">Loading…</div>
      </div>
    );
  }

  const breakMinutesEquivalent =
    settings.long_pause_break_mode === 'percent'
      ? Math.round(
          ((settings.default_break_seconds_target * settings.long_pause_break_percent) / 100 / 60) * 10
        ) / 10
      : null;

  return (
    <div id="settingsPage" className="page-dashboard">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Tune FocusFlow to how you actually work — these apply to every new session.</p>
      </div>

      <div className="settings-grid">
        {/* ── Startup behavior ── */}
        <div className="config-section accent-blue settings-card">
          <div className="config-section-header">
            <Zap size={14} strokeWidth={2.2} /> Starting a session
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Autopilot vs Manual</div>
              <div className="settings-row-hint">Decides whether you're asked every time you hit Start.</div>
            </div>
          </div>
          <div className="settings-radio-group">
            {(
              [
                ['ask', 'Always ask'],
                ['autopilot', 'Autopilot'],
                ['manual', 'Manual'],
              ] as [StartupMode, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                className={'settings-radio' + (settings.startup_mode === val ? ' active' : '')}
                onClick={() => update({ startup_mode: val })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Feedback ── */}
        <div className="config-section accent-blue settings-card">
          <div className="config-section-header">
            <MessageSquare size={14} strokeWidth={2.2} /> Post-cycle feedback
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Ask "did you use this time for…" after each cycle</div>
              <div className="settings-row-hint">
                Turn off to skip straight to the break. You can always confirm completion and add
                notes later from History.
              </div>
            </div>
            <Toggle
              checked={settings.ask_feedback_after_cycle}
              onChange={(v) => update({ ask_feedback_after_cycle: v })}
              label="Ask for feedback after each cycle"
            />
          </div>
        </div>

        {/* ── Breaks ── */}
        <div className="config-section accent-amber settings-card">
          <div className="config-section-header">
            <Coffee size={14} strokeWidth={2.2} /> Default break length
          </div>
          <div className="inputs">
            <div>
              <label>Standard mode (sec)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={settings.default_break_seconds_standard}
                onChange={(e) => update({ default_break_seconds_standard: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
            <div>
              <label>Target mode (sec)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={settings.default_break_seconds_target}
                onChange={(e) => update({ default_break_seconds_target: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
          </div>
          <div className="settings-row-hint" style={{ marginBottom: 10 }}>
            Applied the next time you start a fresh (unconfigured) session — won't change one already running.
          </div>
        </div>

        {/* ── Transitions ── */}
        <div className="config-section accent-amber settings-card">
          <div className="config-section-header">
            <Bell size={14} strokeWidth={2.2} /> Alerts &amp; transitions
          </div>
          <div className="inputs">
            <div>
              <label>Default alert sound</label>
              <select
                value={settings.default_alert_sound}
                onChange={(e) => update({ default_alert_sound: e.target.value as AlertSound })}
              >
                <option value="beep">Beep</option>
                <option value="voice">Voice</option>
              </select>
            </div>
            <div>
              <label>Transition countdown (sec)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={settings.transition_seconds}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  update({ transition_seconds: Number.isInteger(v) && v >= 0 ? v : 0 });
                }}
              />
            </div>
          </div>
          <div className="settings-row" style={{ marginTop: 4 }}>
            <div>
              <div className="settings-row-label">Also play the transition before breaks</div>
              <div className="settings-row-hint">
                Off means breaks start immediately — the countdown still plays between cycles either way.
              </div>
            </div>
            <Toggle
              checked={settings.transition_before_break}
              onChange={(v) => update({ transition_before_break: v })}
              label="Play transition before breaks"
            />
          </div>
        </div>

        {/* ── Ending soon alert ── */}
        <div className="config-section accent-amber settings-card">
          <div className="config-section-header">
            <AlarmClockCheck size={14} strokeWidth={2.2} /> Cycle ending soon
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Alert me before a cycle ends</div>
              <div className="settings-row-hint">A one-time heads-up cue in the last stretch of a cycle.</div>
            </div>
            <Toggle
              checked={settings.end_alert_enabled}
              onChange={(v) => update({ end_alert_enabled: v })}
              label="Alert before cycle ends"
            />
          </div>
          {settings.end_alert_enabled && (
            <div className="inputs" style={{ marginTop: 10 }}>
              <div>
                <label>Alert with (sec) left</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={settings.end_alert_seconds}
                  onChange={(e) => update({ end_alert_seconds: parseInt(e.target.value, 10) || 1 })}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Long pause check-in ── */}
        <div className="config-section accent-blue settings-card settings-card-wide">
          <div className="config-section-header">
            <TimerReset size={14} strokeWidth={2.2} /> Long-pause check-in
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Ask why, when a pause runs long</div>
              <div className="settings-row-hint">
                If you resume after being away a while, FocusFlow will ask what happened and save it
                to that cycle's history.
              </div>
            </div>
            <Toggle
              checked={settings.long_pause_check_enabled}
              onChange={(v) => update({ long_pause_check_enabled: v })}
              label="Ask why when a pause runs long"
            />
          </div>

          {settings.long_pause_check_enabled && (
            <>
              <div className="settings-subsection">
                <div className="settings-subsection-label">During a cycle</div>
                <div className="inputs">
                  <div>
                    <label>Flag pauses longer than (min)</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={settings.long_pause_cycle_minutes}
                      onChange={(e) => update({ long_pause_cycle_minutes: parseInt(e.target.value, 10) || 1 })}
                    />
                  </div>
                </div>
              </div>

              <div className="settings-subsection">
                <div className="settings-subsection-label">During a break</div>
                <div className="settings-radio-group" style={{ marginBottom: 10 }}>
                  <button
                    className={'settings-radio' + (settings.long_pause_break_mode === 'percent' ? ' active' : '')}
                    onClick={() => update({ long_pause_break_mode: 'percent' })}
                  >
                    By percentage over
                  </button>
                  <button
                    className={'settings-radio' + (settings.long_pause_break_mode === 'minutes' ? ' active' : '')}
                    onClick={() => update({ long_pause_break_mode: 'minutes' })}
                  >
                    By minutes over
                  </button>
                </div>
                {settings.long_pause_break_mode === 'percent' ? (
                  <div className="inputs">
                    <div>
                      <label>Flag if break runs over by (%)</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={settings.long_pause_break_percent}
                        onChange={(e) => update({ long_pause_break_percent: parseInt(e.target.value, 10) || 1 })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="inputs">
                    <div>
                      <label>Flag if break runs over by (min)</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={settings.long_pause_break_minutes}
                        onChange={(e) => update({ long_pause_break_minutes: parseInt(e.target.value, 10) || 1 })}
                      />
                    </div>
                  </div>
                )}
                <div className="settings-row-hint">
                  {settings.long_pause_break_mode === 'percent' && breakMinutesEquivalent !== null
                    ? `That's about ${breakMinutesEquivalent} extra minute${breakMinutesEquivalent === 1 ? '' : 's'} on your current ${Math.round(settings.default_break_seconds_target / 60) || '<1'} min Target-mode break.`
                    : 'Applies on top of whatever that break\'s length was.'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Appearance ── */}
        <div className="config-section accent-blue settings-card">
          <div className="config-section-header">
            <Palette size={14} strokeWidth={2.2} /> Appearance
          </div>
          <div className="settings-radio-group">
            {(
              [
                ['dark', 'Dark'],
                ['light', 'Light'],
              ] as [Theme, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                className={'settings-radio' + (settings.theme === val ? ' active' : '')}
                onClick={() => update({ theme: val })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
