import React, { useEffect } from 'react';
import { MdClose } from 'react-icons/md';

export interface EventEditModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const EventEditModal: React.FC<EventEditModalProps> = ({ open, title, onClose, children }) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="event-edit-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="event-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-edit-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="event-edit-modal-header">
          <h2 id="event-edit-modal-title" className="event-edit-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="event-edit-modal-close"
            onClick={onClose}
            aria-label="Close editor"
          >
            <MdClose aria-hidden />
          </button>
        </div>
        <div className="event-edit-modal-body">{children}</div>
      </div>
    </div>
  );
};

export default EventEditModal;
