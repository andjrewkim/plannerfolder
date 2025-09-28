import React from 'react';

interface Assignment {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  planner_class: string;
  order: number;
}

interface AssignmentItemProps {
  assignment: Assignment;
  isEditing: boolean;
  editValue: string;
  isAuthenticated: boolean;
  onToggleComplete: (assignmentId: string, currentCompleted: boolean) => void;
  onStartEdit: (assignmentId: string, currentTitle: string) => void;
  onUpdateEdit: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (assignmentId: string) => void;
  onKeyPress: (e: React.KeyboardEvent, action: () => void) => void;
}

const AssignmentItem: React.FC<AssignmentItemProps> = ({
  assignment,
  isEditing,
  editValue,
  isAuthenticated,
  onToggleComplete,
  onStartEdit,
  onUpdateEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onKeyPress
}) => {
  return (
    <div className={`assignment-item${assignment.completed ? ' completed' : ''}`}>
      <input
        type="checkbox"
        checked={assignment.completed}
        onChange={() => onToggleComplete(assignment.id, assignment.completed)}
        className="assignment-checkbox"
        disabled={!isAuthenticated}
      />
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => onUpdateEdit(e.target.value)}
          onKeyPress={(e) => onKeyPress(e, onSaveEdit)}
          onBlur={onSaveEdit}
          className="assignment-edit-input"
          autoFocus
          placeholder="Assignment name"
        />
      ) : (
        <span 
          className={`assignment-title ${assignment.completed ? 'completed' : ''}`}
          onClick={() => isAuthenticated && onStartEdit(assignment.id, assignment.title)}
          style={{ cursor: isAuthenticated ? 'pointer' : 'default' }}
        >
          {assignment.title || 'Click to edit'}
        </span>
      )}
      {isAuthenticated && (
        <button
          onClick={() => onDelete(assignment.id)}
          className="delete-assignment-btn"
          title="Delete assignment"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default AssignmentItem;