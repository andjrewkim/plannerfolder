import React from 'react';

interface DeleteConfirmationModalProps {
  show: boolean;
  className: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  show,
  className,
  onConfirm,
  onCancel
}) => {
  if (!show) return null;

  return (
    <div className="delete-confirmation-overlay">
      <div className="delete-confirmation-modal">
        <h3>Delete Class</h3>
        <p>Are you sure you want to delete "{className}"?</p>
        <p className="delete-warning">This will also delete all assignments in this class.</p>
        <div className="delete-confirmation-buttons">
          <button 
            onClick={onCancel}
            className="cancel-delete-btn"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="confirm-delete-btn"
          >
            Delete
          </button>
        </div>
      </div>
      
      <style jsx>{`
        .delete-confirmation-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .delete-confirmation-modal {
          background: hsl(var(--card));
          border-radius: 8px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .delete-confirmation-modal h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          color: hsl(var(--foreground));
        }

        .delete-confirmation-modal p {
          margin: 0 0 8px 0;
          color: hsl(var(--mutedForeground));
          line-height: 1.5;
        }

        .delete-warning {
          color: hsl(var(--chart1)) !important;
          font-size: 14px;
          margin-bottom: 20px !important;
        }

        .delete-confirmation-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .cancel-delete-btn {
          padding: 8px 16px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--muted));
          color: hsl(var(--mutedForeground));
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-delete-btn:hover {
          background: hsl(var(--input));
          border-color: hsl(var(--mutedForeground));
        }

        .confirm-delete-btn {
          padding: 8px 16px;
          border: none;
          background: hsl(var(--chart1));
          color: hsl(var(--foreground));
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .confirm-delete-btn:hover {
          background: hsl(12 80% 50%);
        }
      `}</style>
    </div>
  );
};

export default DeleteConfirmationModal;