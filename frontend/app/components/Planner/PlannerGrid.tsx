import React from 'react';
import AssignmentCell from './AssignmentCell';

interface Assignment {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  planner_class: string;
  order: number;
}

interface Class {
  id: string;
  name: string;
  order: number;
}

interface DayInfo {
  date: Date;
  dateString: string;
  displayName: string;
  isToday: boolean;
  dayNumber: number;
  monthName: string;
}

interface DragState {
  isDragging: boolean;
  draggedIndex: number | null;
  dragOverIndex: number | null;
}

interface PlannerGridProps {
  classes: Class[];
  days: DayInfo[];
  organizedAssignments: Record<string, Record<string, Assignment[]>>;
  isAuthenticated: boolean;
  settingsUnlocked: boolean;  // Add this line
  dragState: DragState;
  editingAssignment: string | null;
  editingAssignmentValue: string;
  newAssignmentInputs: Record<string, string>;
  stripedCells: Set<string>;
  getRowHeight: (classId: string) => number;
  onToggleAssignment: (assignmentId: string, currentCompleted: boolean) => void;
  onStartEditAssignment: (assignmentId: string, currentTitle: string) => void;
  onUpdateAssignmentEdit: (value: string) => void;
  onSaveAssignmentEdit: () => void;
  onCancelAssignmentEdit: () => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onAddAssignment: (classId: string, dateString: string) => void;
  onNewAssignmentChange: (classId: string, dateString: string, value: string) => void;
  onCreateAssignment: (classId: string, dateString: string) => void;
  onCancelNewAssignment: (classId: string, dateString: string) => void;
  onKeyPress: (e: React.KeyboardEvent, action: () => void) => void;
  onToggleStripePattern: (classId: string, dateString: string) => void;
}

const PlannerGrid: React.FC<PlannerGridProps> = ({
  classes,
  days,
  organizedAssignments,
  isAuthenticated,
  settingsUnlocked,  // Add this line
  dragState,
  editingAssignment,
  editingAssignmentValue,
  newAssignmentInputs,
  stripedCells,
  getRowHeight,
  onToggleAssignment,
  onStartEditAssignment,
  onUpdateAssignmentEdit,
  onSaveAssignmentEdit,
  onCancelAssignmentEdit,
  onDeleteAssignment,
  onAddAssignment,
  onNewAssignmentChange,
  onCreateAssignment,
  onCancelNewAssignment,
  onKeyPress,
  onToggleStripePattern
}) => {
  return (
    <div className="main-grid">
      <div className="grid-header">
        {days.map((day) => (
          <div key={day.dateString} className={`day-header ${day.isToday ? 'today' : ''}`}>
            {day.displayName} {day.dayNumber}
          </div>
        ))}
      </div>

      <div className="grid-body">
        {classes.map((cls, index) => (
          <div 
            key={cls.id} 
            className={`class-row ${
              dragState.isDragging && dragState.draggedIndex === index ? 'dragging-row' : ''
            }`}
            style={{ height: `${getRowHeight(cls.id)}px` }}
          >
            {days.map((day) => {
              const cellKey = `${cls.id}-${day.dateString}`;
              const showStripePattern = stripedCells?.has(cellKey) || false;
              
              return (
                <AssignmentCell
                  key={cellKey}
                  classId={cls.id}
                  dateString={day.dateString}
                  assignments={organizedAssignments[cls.id]?.[day.dateString] || []}
                  isToday={day.isToday}
                  isAuthenticated={isAuthenticated}
                  settingsUnlocked={settingsUnlocked}
                  editingAssignment={editingAssignment}
                  editingAssignmentValue={editingAssignmentValue}
                  newAssignmentInput={newAssignmentInputs[cellKey]}
                  showStripePattern={showStripePattern}
                  onToggleAssignment={onToggleAssignment}
                  onStartEditAssignment={onStartEditAssignment}
                  onUpdateAssignmentEdit={onUpdateAssignmentEdit}
                  onSaveAssignmentEdit={onSaveAssignmentEdit}
                  onCancelAssignmentEdit={onCancelAssignmentEdit}
                  onDeleteAssignment={onDeleteAssignment}
                  onAddAssignment={onAddAssignment}
                  onNewAssignmentChange={onNewAssignmentChange}
                  onCreateAssignment={onCreateAssignment}
                  onCancelNewAssignment={onCancelNewAssignment}
                  onKeyPress={onKeyPress}
                  onToggleStripePattern={onToggleStripePattern}
                />
              );
            })}
          </div>
        ))}
      </div>

      <style jsx>{`
        .class-row.dragging-row {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
};

export default PlannerGrid;