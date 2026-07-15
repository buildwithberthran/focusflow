import { useState } from 'react';
import { useTimerEngine } from '../../context/TimerEngineContext';
import { useAuth } from '../../context/AuthContext';
import { dbInsertTemplate } from '../../lib/db';

export default function TemplateNameModal({ onSaved }: { onSaved: () => void }) {
  const { state, actions } = useTimerEngine();
  const { user } = useAuth();
  const [name, setName] = useState('');

  if (!state.tplNameModalOpen) return null;

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || !user) return;
    actions.patch({ tplNameModalOpen: false });
    try {
      await dbInsertTemplate(user.id, trimmed, state.tBreakSeconds, state.schedule);
      setName('');
      onSaved();
    } catch (e: any) {
      actions.patch({ errorMsg: 'Save failed: ' + e.message });
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) actions.patch({ tplNameModalOpen: false });
      }}
    >
      <div className="modal">
        <h2>Save Template</h2>
        <p>Give this schedule a name so you can load it later.</p>
        <div className="full-input">
          <label>Template name</label>
          <input
            type="text"
            value={name}
            maxLength={80}
            placeholder="e.g. Morning deep work"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-btns">
          <button
            style={{ background: '#454B51', color: '#9BA3A8' }}
            onClick={() => actions.patch({ tplNameModalOpen: false })}
          >
            Cancel
          </button>
          <button style={{ background: '#3B8A81', color: '#EEF1EE' }} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
