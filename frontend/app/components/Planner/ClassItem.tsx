import React from 'react';
import { Edit2, GripVertical } from 'lucide-react';

interface ClassItemProps {
  classId: string;
  className: string;
  index: number;
  height: number;
  isAuthenticated: boolean;
  isEditing: boolean;
  editValue: string;
  isDragging: boolean;
  isDragOver: boolean;
  onStartEdit: (classId: string, className: string) => void;
  onUpdateEdit: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (classId: string, className: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, dropIndex: number) => void;
  onDragEnd: () => void;
  onKeyPress: (e: React.KeyboardEvent, action: () => void) => void;
}

const ClassItem: React.FC<ClassItemProps> = ({
  classId,
  className,
  index,
  height,
  isAuthenticated,
  isEditing,
  editValue,
  isDragging,
  isDragOver,
  onStartEdit,
  onUpdateEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onKeyPress
}) => {
  const showTempClass = String(classId).startsWith('temp-');
  const canDrag = isAuthenticated && !showTempClass;

  return (
    <div 
      className={`class-item ${
        isDragging ? 'dragging' : ''
      } ${
        isDragOver ? 'drag-over' : ''
      }`}
      style={{ height: `${height}px` }}
      draggable={canDrag}
      onDragStart={(e) => canDrag && onDragStart(e, index)}
      onDragOver={(e) => canDrag && onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => canDrag && onDrop(e, index)}
      onDragEnd={onDragEnd}
    >
      {canDrag && (
        <div className="drag-handle">
          <GripVertical size={14} />
        </div>
      )}
      
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => onUpdateEdit(e.target.value)}
          onKeyPress={(e) => onKeyPress(e, onSaveEdit)}
          onBlur={onSaveEdit}
          className="class-name-edit-input"
          autoFocus
        />
      ) : (
        <div className="class-name-container">
          <span className="class-name">
            {className}
          </span>
          {isAuthenticated && !showTempClass && (
            <button 
              onClick={() => onStartEdit(classId, className)}
              className="edit-class-btn"
              title="Edit class name"
            >
              <Edit2 size={12} />
            </button>
          )}
        </div>
      )}
      {isAuthenticated && !showTempClass && (
        <button 
          onClick={() => onDelete(classId, className)}
          className="delete-class-btn"
          title="Delete class"
        >
          ×
        </button>
      )}

      <style jsx>{`
        .class-item {
          position: relative;
          display: flex;
          align-items: flex-start;
          cursor: grab;
          transition: all 0.2s ease;
        }

        .class-item[draggable="true"]:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px hsl(var(--muted) / 0.6);
        }

        .class-item.dragging {
          opacity: 0.5;
          transform: rotate(2deg);
          cursor: grabbing;
        }

        .class-item.drag-over {
          transform: translateY(2px);
          box-shadow: 0 4px 12px hsl(var(--accent) / 0.3);
        }

        .drag-handle {
          display: flex;
          align-items: center;
          padding: 4px;
          color: hsl(var(--mutedForeground));
          cursor: grab;
          margin-right: 8px;
        }

        .drag-handle:hover {
          color: hsl(var(--foreground));
        }

        .class-item.dragging .drag-handle {
          cursor: grabbing;
        }

        .class-name-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Prevent text selection during drag */
        .class-item.dragging * {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }
      `}</style>
    </div>
  );
};

export default ClassItem;