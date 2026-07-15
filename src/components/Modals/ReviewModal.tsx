import { useState } from 'react';
import { useTimerEngine } from '../../context/TimerEngineContext';

export default function ReviewModal() {
  const { state, actions } = useTimerEngine();
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);
  const [note, setNote] = useState('');

  if (!state.reviewModalOpen) return null;

  function submit() {
    actions.closeReview(answer, note);
    setAnswer(null);
    setNote('');
  }
  function skip() {
    actions.closeReview(null, note);
    setAnswer(null);
    setNote('');
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="review-question">{state.reviewQuestion}</div>
        <div className="yn-btns">
          <button
            className={'yn-btn yes' + (answer === 'yes' ? ' selected' : '')}
            onClick={() => setAnswer('yes')}
          >
            ✓ Yes
          </button>
          <button
            className={'yn-btn no' + (answer === 'no' ? ' selected' : '')}
            onClick={() => setAnswer('no')}
          >
            ✗ No
          </button>
        </div>
        <div className="full-input">
          <label>Notes (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Any reflections on this cycle…"
          />
        </div>
        <div className="modal-btns" style={{ marginTop: 4 }}>
          <button style={{ background: '#3B8A81', color: '#EEF1EE' }} onClick={submit}>
            Save &amp; Continue
          </button>
        </div>
        <div className="skip-link" onClick={skip}>
          Skip without saving
        </div>
      </div>
    </div>
  );
}
