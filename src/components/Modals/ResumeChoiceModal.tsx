import type { SnapshotRow } from '../../types';
import { describeResumeChoice } from '../../lib/resumeChoice';

export default function ResumeChoiceModal({
  snapshot,
  onCancel,
  onChoose,
}: {
  snapshot: SnapshotRow | null;
  onCancel: () => void;
  onChoose: (choice: 'continue' | 'restart') => void;
}) {
  if (!snapshot) return null;
  const desc = describeResumeChoice(snapshot);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal">
        <h2>{desc.title}</h2>
        <p>How would you like to resume?</p>
        <div className="modal-btns" style={{ flexDirection: 'column', gap: 10 }}>
          <button style={{ background: '#4caf50', color: '#fff', width: '100%' }} onClick={() => onChoose('continue')}>
            {desc.continueLabel}
          </button>
          <button
            style={{ background: '#2a3344', color: '#aab2c5', border: '1px solid #3f4a60', width: '100%' }}
            onClick={() => onChoose('restart')}
          >
            {desc.restartLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
