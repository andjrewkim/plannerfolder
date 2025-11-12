import React, { useState, useRef, useEffect } from 'react';
import { Assignment } from '../../hooks/usePlanner';


interface AssignmentItemProps {
  assignment: Assignment;  // Now uses the imported type
  isEditing: boolean;
  editValue: string;
  isAuthenticated: boolean;
  dateString: string;
  onToggleComplete: (assignmentId: string, currentCompleted: boolean) => void;
  onStartEdit: (assignmentId: string, currentTitle: string, dateString: string) => void;
  onUpdateEdit: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (assignmentId: string) => void;
  onKeyPress: (e: React.KeyboardEvent, action: () => void) => void;
  onUpdateDateRange?: (assignmentId: string, newEndDate: string) => void;
}

const AssignmentItem: React.FC<AssignmentItemProps> = ({
  assignment,
  isEditing,
  editValue,
  isAuthenticated,
  dateString,
  onToggleComplete,
  onStartEdit,
  onUpdateEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onKeyPress,
  onUpdateDateRange
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragDays, setDragDays] = useState(0);
  const [isHoveringHandle, setIsHoveringHandle] = useState(false);
  const [isMultiLine, setIsMultiLine] = useState(false);
  const assignmentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const initialCellXRef = useRef<number>(0);
  const cellWidthRef = useRef<number>(0);
  const mouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const mouseUpHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);

  const isMultiDay = assignment.start_date !== assignment.end_date;

  // Auto-focus the edit input when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      // Place cursor at the end instead of selecting all
      const len = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Check if text wraps to multiple lines
  useEffect(() => {
    const checkMultiLine = () => {
      if (titleRef.current && assignmentRef.current) {
        const titleHeight = titleRef.current.offsetHeight;
        const lineHeight = parseFloat(getComputedStyle(titleRef.current).lineHeight);
        setIsMultiLine(titleHeight > lineHeight * 1.5);
      }
    };

    checkMultiLine();
    window.addEventListener('resize', checkMultiLine);
    return () => window.removeEventListener('resize', checkMultiLine);
  }, [assignment.title, isEditing]);

  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isAuthenticated || !onUpdateDateRange) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const cell = assignmentRef.current?.closest('.assignment-cell');
    if (cell) {
      const rect = cell.getBoundingClientRect();
      cellWidthRef.current = rect.width;
      initialCellXRef.current = rect.left;
    } else {
      cellWidthRef.current = 150;
      initialCellXRef.current = 0;
    }
    
    setIsDragging(true);
    setDragDays(0);
    
    const moveHandler = (e: MouseEvent) => {
      const cellWidth = cellWidthRef.current || 150;
      const deltaX = e.clientX - initialCellXRef.current;
      const days = Math.floor(deltaX / cellWidth);
      setDragDays(days);
    };

    const upHandler = (e: MouseEvent) => {
      if (mouseMoveHandlerRef.current) {
        document.removeEventListener('mousemove', mouseMoveHandlerRef.current);
      }
      if (mouseUpHandlerRef.current) {
        document.removeEventListener('mouseup', mouseUpHandlerRef.current);
      }
      
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      const cellWidth = cellWidthRef.current || 150;
      const deltaX = e.clientX - initialCellXRef.current;
      const finalDays = Math.floor(deltaX / cellWidth);
      
      if (finalDays !== 0 && onUpdateDateRange) {
        const endDate = new Date(assignment.end_date + 'T00:00:00');
        endDate.setDate(endDate.getDate() + finalDays);
        
        const minDate = new Date(assignment.start_date + 'T00:00:00');
        if (endDate < minDate) {
          endDate.setTime(minDate.getTime());
        }
        
        const newEndDate = formatDateForAPI(endDate);
        
        if (newEndDate !== assignment.end_date) {
          onUpdateDateRange(assignment.id, newEndDate);
        }
      }
      
      setIsDragging(false);
      setDragDays(0);
    };

    mouseMoveHandlerRef.current = moveHandler;
    mouseUpHandlerRef.current = upHandler;
    
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
    
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    return () => {
      if (mouseMoveHandlerRef.current) {
        document.removeEventListener('mousemove', mouseMoveHandlerRef.current);
      }
      if (mouseUpHandlerRef.current) {
        document.removeEventListener('mouseup', mouseUpHandlerRef.current);
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  const getPreviewEndDate = () => {
    if (dragDays === 0) return null;
    
    const endDate = new Date(assignment.end_date + 'T00:00:00');
    endDate.setDate(endDate.getDate() + dragDays);
    
    const minDate = new Date(assignment.start_date + 'T00:00:00');
    if (endDate < minDate) {
      endDate.setTime(minDate.getTime());
    }
    
    return endDate;
  };

  const previewEndDate = getPreviewEndDate();

  const handleTitleClick = (e: React.MouseEvent) => {
    if (!isAuthenticated || isEditing) return;
    
    // Don't start editing if we're clicking near the drag handle
    const target = e.target as HTMLElement;
    const dragHandle = assignmentRef.current?.querySelector('.drag-handle');
    
    if (dragHandle && dragHandle.contains(target)) {
      return;
    }
    
    e.stopPropagation();
    e.preventDefault();
    onStartEdit(assignment.id, assignment.title, dateString);
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Only save if we're not clicking on another part of the same assignment
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && assignmentRef.current?.contains(relatedTarget)) {
      return;
    }
    onSaveEdit();
  };

  return (
    <div 
      ref={assignmentRef}
      className={`assignment-item${assignment.completed ? ' completed' : ''}${isMultiDay ? ' multi-day' : ''}${isDragging ? ' dragging' : ''}`}
      style={{
        position: 'relative',
        paddingRight: isMultiLine ? '32px' : '56px',
        overflow: 'visible'
      }}
    >
      {isMultiDay && (
        <div
          style={{
            position: 'absolute',
            left: '-1px',
            top: '0',
            bottom: '0',
            width: '5px',
            backgroundColor: 'hsl(var(--accent))',
            borderRadius: '5px 0 0 5px',
            pointerEvents: 'none'
          }}
        />
      )}
      
      <input
        type="checkbox"
        checked={assignment.completed}
        onChange={() => onToggleComplete(assignment.id, assignment.completed)}
        className="assignment-checkbox"
        disabled={!isAuthenticated}
      />
      {isEditing ? (
        <input
          ref={editInputRef}
          type="text"
          value={editValue}
          onChange={(e) => onUpdateEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSaveEdit();
            } else if (e.key === 'Escape') {
              onCancelEdit();
            }
          }}
          onBlur={handleInputBlur}
          className="assignment-edit-input"
          placeholder="Assignment name"
        />
      ) : (
        <span 
          ref={titleRef}
          className={`assignment-title ${assignment.completed ? 'completed' : ''}`}
          onClick={handleTitleClick}
          style={{ 
            cursor: isAuthenticated ? 'pointer' : 'default',
            userSelect: 'none'
          }}
        >
          {assignment.title || 'Click to edit'}
        </span>
      )}
      
      {isAuthenticated && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(assignment.id);
            }}
            className="delete-assignment-btn"
            title="Delete assignment"
          >
            ×
          </button>
          
          <div
            className="drag-handle"
            onMouseDown={handleMouseDown}
            onMouseEnter={() => setIsHoveringHandle(true)}
            onMouseLeave={() => setIsHoveringHandle(false)}
            title="Drag to adjust end date"
            style={{
              position: 'absolute',
              right: isMultiLine ? '1px' : '18px',
              top: isMultiLine ? 'calc(50% + 10px)' : '50%',
              transform: 'translateY(-50%)',
              width: '18px',
              height: '20px',
              cursor: 'ew-resize',
              backgroundColor: isDragging ? 'hsl(var(--accent) / 0.15)' : isHoveringHandle ? 'hsl(var(--accent) / 0.1)' : 'transparent',
              borderRadius: '4px',
              transition: isDragging ? 'none' : 'all 0.15s',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              userSelect: 'none'
            }}
          >
            <div style={{
              width: '10px',
              height: '2px',
              backgroundColor: isDragging ? 'hsl(var(--accent) / 0.8)' : isHoveringHandle ? 'hsl(var(--accent) / 0.6)' : 'hsl(var(--accent) / 0.3)',
              borderRadius: '1px',
              transition: 'all 0.15s',
              pointerEvents: 'none'
            }} />
            <div style={{
              width: '10px',
              height: '2px',
              backgroundColor: isDragging ? 'hsl(var(--accent) / 0.8)' : isHoveringHandle ? 'hsl(var(--accent) / 0.6)' : 'hsl(var(--accent) / 0.3)',
              borderRadius: '1px',
              transition: 'all 0.15s',
              pointerEvents: 'none'
            }} />
            <div style={{
              width: '10px',
              height: '2px',
              backgroundColor: isDragging ? 'hsl(var(--accent) / 0.8)' : isHoveringHandle ? 'hsl(var(--accent) / 0.6)' : 'hsl(var(--accent) / 0.3)',
              borderRadius: '1px',
              transition: 'all 0.15s',
              pointerEvents: 'none'
            }} />
          </div>
        </>
      )}
      
      {isDragging && dragDays !== 0 && (
        <div 
          style={{
            position: 'fixed',
            top: assignmentRef.current ? assignmentRef.current.getBoundingClientRect().top + 'px' : '0',
            left: assignmentRef.current ? (assignmentRef.current.getBoundingClientRect().right + 10) + 'px' : '0',
            backgroundColor: 'hsl(var(--accent) / 0.6)',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10000,
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
          }}
        >
          {dragDays > 0 ? '+' : ''}{dragDays} day{Math.abs(dragDays) !== 1 ? 's' : ''}
          {previewEndDate && (
            <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.9 }}>
              → {previewEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssignmentItem;