import React from 'react';
import ClassItem from './ClassItem';

interface Class {
  id: string;
  name: string;
  order: number;
}

interface DragState {
  isDragging: boolean;
  draggedIndex: number | null;
  dragOverIndex: number | null;
}

interface ClassesSidebarProps {
  classes: Class[];
  isAuthenticated: boolean;
  showAddClass: boolean;
  newClassName: string;
  editingClass: string | null;
  editingClassValue: string;
  dragState: DragState;
  getRowHeight: (classId: string) => number;
  onToggleAddClass: (show: boolean) => void;
  onNewClassNameChange: (value: string) => void;
  onCreateClass: () => void;
  onStartEditClass: (classId: string, className: string) => void;
  onUpdateEditClass: (value: string) => void;
  onSaveEditClass: () => void;
  onCancelEditClass: () => void;
  onDeleteClass: (classId: string, className: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, dropIndex: number) => void;
  onDragEnd: () => void;
  onKeyPress: (e: React.KeyboardEvent, action: () => void) => void;
}

const ClassesSidebar: React.FC<ClassesSidebarProps> = ({
  classes,
  isAuthenticated,
  showAddClass,
  newClassName,
  editingClass,
  editingClassValue,
  dragState,
  getRowHeight,
  onToggleAddClass,
  onNewClassNameChange,
  onCreateClass,
  onStartEditClass,
  onUpdateEditClass,
  onSaveEditClass,
  onCancelEditClass,
  onDeleteClass,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onKeyPress
}) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="classes-header">
          {!showAddClass && (
            <div className="header-row">
              <h2>Classes</h2>
              <div className="header-buttons">
                {isAuthenticated && (
                  <button onClick={() => onToggleAddClass(true)} className="add-class-btn">+</button>
                )}
              </div>
            </div>
          )}
          {showAddClass && isAuthenticated && (
            <div className="add-class-input">
              <input
                type="text"
                placeholder="Class name"
                value={newClassName}
                onChange={(e) => onNewClassNameChange(e.target.value)}
                onKeyPress={(e) => onKeyPress(e, onCreateClass)}
                onBlur={() => {
                  if (newClassName.trim()) {
                    onCreateClass();
                  } else {
                    onToggleAddClass(false);
                  }
                }}
                className="class-input"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
      <div className="classes-list">
        {classes.map((cls, index) => (
          <ClassItem
            key={cls.id}
            classId={cls.id}
            className={cls.name}
            index={index}
            height={getRowHeight(cls.id)}
            isAuthenticated={isAuthenticated}
            isEditing={editingClass === cls.id}
            editValue={editingClassValue}
            isDragging={dragState.isDragging && dragState.draggedIndex === index}
            isDragOver={dragState.dragOverIndex === index}
            onStartEdit={onStartEditClass}
            onUpdateEdit={onUpdateEditClass}
            onSaveEdit={onSaveEditClass}
            onCancelEdit={onCancelEditClass}
            onDelete={onDeleteClass}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onKeyPress={onKeyPress}
          />
        ))}
      </div>

      <style jsx>{`
        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .header-buttons {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .header-row h2 {
          margin: 0;
          flex: 1;
        }
      `}</style>
    </div>
  );
};

export default ClassesSidebar;