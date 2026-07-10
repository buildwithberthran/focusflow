import type { TemplateRow } from '../../types';

export default function DeleteTemplateModal({
  template,
  onCancel,
  onConfirm,
}: {
  template: TemplateRow | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!template) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal">
        <h2>Delete template?</h2>
        <p>
          "{template.name}" will be permanently deleted. This doesn't affect any past sessions
          that used it.
        </p>
        <div className="modal-btns">
          <button style={{ background: '#3f4a60', color: '#aab2c5' }} onClick={onCancel}>
            Cancel
          </button>
          <button style={{ background: '#e05656', color: '#fff' }} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
