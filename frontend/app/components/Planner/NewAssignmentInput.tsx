import React from 'react';

interface NewAssignmentInputProps {
  titleValue: string;
  startDateValue: string;
  endDateValue: string;
  onTitleChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}

const NewAssignmentInput: React.FC<NewAssignmentInputProps> = ({
  titleValue,
  startDateValue,
  endDateValue,
  onTitleChange,
  onStartDateChange,
  onEndDateChange,
  onCreate,
  onCancel
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onCreate();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="assignment-item">
      <input
        type="checkbox"
        disabled
        className="assignment-checkbox"
      />
      <input
        type="text"
        value={titleValue || ''}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onCreate}
        className="assignment-edit-input"
        autoFocus
        placeholder="Assignment name"
      />
      <button
        onClick={onCancel}
        className="delete-assignment-btn"
        title="Cancel"
      >
        ×
      </button>
    </div>
  );
};

export default NewAssignmentInput;