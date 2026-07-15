import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTimerEngine } from '../../context/TimerEngineContext';
import { formatDurationExact } from '../../lib/time';

export default function PauseReasonModal() {
  const { state, actions } = useTimerEngine();
  const { user } = useAuth();
  const [reason, setReason] = useState('');

  if (!state.pauseReasonPromptOpen) return null;

  const firstName = ((user?.user_metadata?.full_name as string) || '').split(' ')[0] || 'there';
  const away = formatDurationExact(state.pauseReasonAwaySeconds);
  const isBreak = state.pauseReasonContext === 'break';

  function submit() {
    actions.resolvePauseReason(reason);
    setReason('');
  }
  function skip() {
    actions.resolvePauseReason('');
    setReason('');
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Hey {firstName}, you were away for {away}</h2>
        <p>
          {isBreak
            ? "That break ran longer than expected. Mind sharing what happened?"
            : 'This cycle was paused a while. Mind sharing what happened?'}
        </p>
        <div className="full-input">
          <label>What happened? (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Got pulled into a call"
            autoFocus
          />
        </div>
        <div className="modal-btns">
          <button style={{ background: '#3B8A81', color: '#EEF1EE' }} onClick={submit}>
            Save &amp; Continue
          </button>
        </div>
        <div className="skip-link" onClick={skip}>
          Skip and continue
        </div>
      </div>
    </div>
  );
}
