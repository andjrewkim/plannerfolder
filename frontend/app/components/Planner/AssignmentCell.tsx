import React from 'react';
import AssignmentItem from './AssignmentItem';
import NewAssignmentInput from './NewAssignmentInput';
import { usePlanner, Assignment } from '../../hooks/usePlanner'; // Adjust import path

interface AssignmentCellProps {
  classId: string;
  dateString: string;
  assignments: Assignment[];
  isToday: boolean;
  isAuthenticated: boolean;
  editingAssignment: string | null;
  editingAssignmentValue: string;
  newAssignmentInput?: string;
  showStripePattern: boolean;
  onStartEditAssignment: (assignmentId: string, currentTitle: string) => void;
  onUpdateAssignmentEdit: (value: string) => void;
  onSaveAssignmentEdit: () => void;
  onCancelAssignmentEdit: () => void;
  onAddAssignment: (classId: string, dateString: string) => void;
  onNewAssignmentChange: (classId: string, dateString: string, value: string) => void;
  onCreateAssignment: (classId: string, dateString: string) => void;
  onCancelNewAssignment: (classId: string, dateString: string) => void;
  onKeyPress: (e: React.KeyboardEvent, action: () => void) => void;
  onToggleStripePattern: (classId: string, dateString: string) => void;
  onToggleAssignment: (assignmentId: string, currentCompleted: boolean) => void; // <-- add this
  onDeleteAssignment: (assignmentId: string) => void; // <-- add this

}

const AssignmentCell: React.FC<AssignmentCellProps> = ({
  classId,
  dateString,
  assignments,
  isToday,
  isAuthenticated,
  editingAssignment,
  editingAssignmentValue,
  newAssignmentInput,
  showStripePattern,
  onStartEditAssignment,
  onUpdateAssignmentEdit,
  onSaveAssignmentEdit,
  onCancelAssignmentEdit,
  onAddAssignment,
  onNewAssignmentChange,
  onCreateAssignment,
  onCancelNewAssignment,
  onKeyPress,
  onToggleStripePattern
}) => {
  const { 
    updateAssignment, 
    deleteAssignment, 
    setError 
  } = usePlanner();

  const showTempClass = String(classId).startsWith('temp-');
  const hasNoAssignments = (!assignments || assignments.length === 0) && newAssignmentInput === undefined;
  const shouldShowNoWorkPattern = showStripePattern && hasNoAssignments;

  const handleToggleAssignment = async (assignmentId: string, currentCompleted: boolean) => {
    try {
      const success = await updateAssignment(assignmentId, { 
        completed: !currentCompleted 
      });
      
      if (!success) {
        console.error('Failed to toggle assignment');
      }
    } catch (error) {
      console.error('Error toggling assignment:', error);
      setError('Failed to update assignment');
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      const success = await deleteAssignment(assignmentId);
      
      if (!success) {
        console.error('Failed to delete assignment');
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      setError('Failed to delete assignment');
    }
  };


  return (
    <div 
      className={`assignment-cell ${isToday ? 'today-cell' : ''} ${shouldShowNoWorkPattern ? 'no-work-day' : ''}`}
    >
      {shouldShowNoWorkPattern && (
        <div className="no-work-overlay">
          <span className="no-work-text">No Work</span>
        </div>
      )}
      
      <div className="assignments-list">
        {assignments?.map((assignment) => (
          <AssignmentItem
            key={assignment.id}
            assignment={assignment}
            isEditing={editingAssignment === assignment.id}
            editValue={editingAssignmentValue}
            isAuthenticated={isAuthenticated && !showTempClass}
            onToggleComplete={handleToggleAssignment}
            onStartEdit={onStartEditAssignment}
            onUpdateEdit={onUpdateAssignmentEdit}
            onSaveEdit={onSaveAssignmentEdit}
            onCancelEdit={onCancelAssignmentEdit}
            onDelete={handleDeleteAssignment}
            onKeyPress={onKeyPress}
          />
        ))}
        
        {newAssignmentInput !== undefined && (
          <NewAssignmentInput
            value={newAssignmentInput}
            onChange={(value) => onNewAssignmentChange(classId, dateString, value)}
            onCreate={() => onCreateAssignment(classId, dateString)}
            onCancel={() => onCancelNewAssignment(classId, dateString)}
          />
        )}
      </div>
      
      <div className={`cell-buttons ${hasNoAssignments ? 'empty-cell' : 'has-content'}`}>
        {isAuthenticated && !showTempClass && hasNoAssignments && (
          <button
            onClick={() => onToggleStripePattern(classId, dateString)}
            className={`no-work-toggle ${showStripePattern ? 'active' : ''}`}
            title={showStripePattern ? "Mark as has work" : "Mark as no work"}
          >
            <span className="no-work-icon">✕</span>
          </button>
        )}

        {isAuthenticated && !showTempClass && (
          <button 
            onClick={() => onAddAssignment(classId, dateString)}
            className="add-assignment-btn"
            title="Add assignment"
            disabled={newAssignmentInput !== undefined}
          >
            +
          </button>
        )}
      </div>

      <style jsx>{`
.assignment-cell {
  position: relative;
  min-height: 60px;
  transition: background-color 0.2s ease;
}

.assignment-cell.no-work-day {
  background: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 8px,
    hsl(var(--accent) / 0.025) 8px,
    hsl(var(--accent) / 0.025) 16px
  );
}

.assignment-cell.no-work-day.today-cell {
  background: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 8px,
    hsl(var(--accent) / 0.035) 8px,
    hsl(var(--accent) / 0.035) 16px
  );
}

.no-work-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 0;
  opacity: 0.75;
}

.no-work-text {
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px hsl(var(--background) / 0.8);
}

.assignments-list {
  position: relative;
  z-index: 1;
}

.cell-buttons {
  position: absolute;
  bottom: 2px;
  right: 2px;
  display: flex;
  gap: 4px;
  align-items: center;
  z-index: 2;
}

.add-assignment-btn,
.no-work-toggle {
  width: 20px;
  height: 20px;
  background: hsl(var(--calendar-background));
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
  opacity: 1;
  box-shadow: 0 0 0 1px hsl(var(--border)/0.3);
}

.add-assignment-btn {
  font-size: 20px;
  color: hsl(var(--accent));
  opacity: 0.8;
  font-weight: 400;
  box-shadow: 0 0 0 1px hsl(var(--accent)/0.5);
}

.add-assignment-btn:hover {
  opacity: 1 !important;
  box-shadow: 0 0 0 1px hsl(var(--accent)/0.4);
}

.add-assignment-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.no-work-toggle:hover {
  box-shadow: 0 0 0 1px hsl(var(--accent) / 0.4);
}

.no-work-toggle.active {
  background: hsl(var(--calendar-background));
  opacity: 1;
}

.no-work-toggle.active:hover {
  background: hsl(var(--calendar-background));
  box-shadow: 0 0 0 1px hsl(var(--accent) / 0.6);
}

.no-work-icon {
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  transition: color 0.2s ease;
  line-height: 1;
}

.no-work-toggle:hover .no-work-icon {
  color: hsl(var(--accent));
}

.cell-buttons:hover .no-work-toggle {
  opacity: 1;
}

.cell-buttons:hover .add-assignment-btn {
  opacity: 1;
}
      `}</style>
    </div>
  );
};

export default AssignmentCell;