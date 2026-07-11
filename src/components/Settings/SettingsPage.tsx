import { Zap, Bell, Coffee, MessageSquare, Palette } from 'lucide-react';
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
              <div className="settings-row-hint">Turn off to skip straight to the break — your history just won't have completion notes.</div>
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

        {/* ── Alerts ── */}
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
          <div className="settings-row-hint" style={{ marginBottom: 10 }}>
            How long the "starting in…" countdown runs between cycles and breaks. Use 0 for an
            instant transition with no countdown.
          </div>
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
