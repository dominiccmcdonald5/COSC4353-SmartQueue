import React, { useId } from 'react';
import './ConfirmDialog.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}) => {
  const titleId = useId();
  const descId = useId();

  if (!open) return null;

  return (
    <div
      className="confirm-dialog-overlay"
      role="presentation"
      onClick={onCancel}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-dialog-title">
          {title}
        </h2>
        <div id={descId} className="confirm-dialog-message">
          {message}
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="confirm-dialog-btn cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog-btn confirm confirm--${confirmVariant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
