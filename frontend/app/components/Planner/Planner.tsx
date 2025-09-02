import React, { useState, useRef } from 'react';
import { Edit2, GripVertical } from 'lucide-react';
import CustomCalendarHeader from '../CustomCalHeader';
import { usePlanner } from '../../hooks/usePlanner';
import '../../styles/planner.css';

// Define or import ViewType - matching the main app view types
type ViewType = 'calendar' | 'your-new-view';

export interface PlannerProps {
  rightSidebarOpen?: boolean;
  activeAppView?: ViewType;
  onAppViewChange?: (newView: ViewType) => void;
  isAuthenticated?: boolean;
}

interface DragState {
  isDragging: boolean;
  draggedIndex: number | null;
  dragOverIndex: number | null;
}

const Planner: React.FC<PlannerProps> = ({
  rightSidebarOpen = false,
  activeAppView = 'your-new-view',
  onAppViewChange,
  isAuthenticated = false
}) => {
  const {
    classes,
    assignments,
    isLoading,
    error,
    initialized,
    createClass,
    updateClass,
    deleteClass,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    getAssignmentsByClassAndDate
  } = usePlanner();

  const [newClassName, setNewClassName] = useState('');
  const [showAddClass, setShowAddClass] = useState(false);
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [editingClassValue, setEditingClassValue] = useState('');
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [editingAssignmentValue, setEditingAssignmentValue] = useState('');
  const [newAssignmentInputs, setNewAssignmentInputs] = useState<Record<string, string>>({});
  
  // New state for date navigation
  const [currentDateOffset, setCurrentDateOffset] = useState(0); // 0 = today, -1 = yesterday, 1 = tomorrow

  // State for drag and drop
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedIndex: null,
    dragOverIndex: null
  });

  // State for delete confirmation
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    classId: string;
    className: string;
  }>({
    show: false,
    classId: '',
    className: ''
  });

  // Create a dummy ref for the header (not used in planner but required by header component)
  const dummyCalendarRef = useRef(null);

  // Get organized assignments
  const organizedAssignments = getAssignmentsByClassAndDate();

  // FIXED: Helper function to format date as YYYY-MM-DD for API (avoiding timezone issues)
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // FIXED: Helper function to create date from API date string (avoiding timezone conversion)
  const createDateFromAPIString = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed in JavaScript Date
  };

  // Helper function to get display name for date
  const getDateDisplayName = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  };

  // FIXED: Get the 5 days to show based on current offset (using local date construction)
  const getFiveDaysToShow = () => {
    const today = new Date();
    // Reset time to avoid any time-based issues
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + currentDateOffset - 1);

    const days = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      days.push({
        date: date,
        dateString: formatDateForAPI(date),
        displayName: getDateDisplayName(date),
        isToday: date.toDateString() === today.toDateString(),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' })
      });
    }
    return days;
  };

  // Get current title based on the view window
  const getCurrentTitle = () => {
    const centerDate = new Date();
    centerDate.setHours(0, 0, 0, 0);
    centerDate.setDate(centerDate.getDate() + currentDateOffset);
    return centerDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const fiveDays = getFiveDaysToShow();

  // Navigation functions for the header
  const handlePrevious = () => {
    setCurrentDateOffset(prev => prev - 1);
  };

  const handleNext = () => {
    setCurrentDateOffset(prev => prev + 1);
  };

  const handleToday = () => {
    setCurrentDateOffset(0);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragState({
      isDragging: true,
      draggedIndex: index,
      dragOverIndex: null
    });
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    setDragState(prev => ({
      ...prev,
      dragOverIndex: index
    }));
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear dragOverIndex if we're actually leaving the draggable area
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragState(prev => ({
        ...prev,
        dragOverIndex: null
      }));
    }
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    const { draggedIndex } = dragState;
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragState({
        isDragging: false,
        draggedIndex: null,
        dragOverIndex: null
      });
      return;
    }

    // Create new order for classes
    const sortedClasses = [...classes].sort((a, b) => a.order - b.order);
    const reorderedClasses = [...sortedClasses];
    const draggedClass = reorderedClasses.splice(draggedIndex, 1)[0];
    reorderedClasses.splice(dropIndex, 0, draggedClass);

    // Update order property for each class
    const updatePromises = reorderedClasses.map((cls, index) => 
      updateClass(cls.id, { order: index })
    );

    try {
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Failed to reorder classes:', error);
    }

    setDragState({
      isDragging: false,
      draggedIndex: null,
      dragOverIndex: null
    });
  };

  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      draggedIndex: null,
      dragOverIndex: null
    });
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    const success = await createClass(newClassName.trim());
    if (success) {
      setNewClassName('');
      setShowAddClass(false);
    }
  };

  const handleRemoveClass = (classId: string, className: string) => {
    setDeleteConfirmation({
      show: true,
      classId,
      className
    });
  };

  const confirmDeleteClass = async () => {
    if (deleteConfirmation.classId) {
      await deleteClass(deleteConfirmation.classId);
    }
    setDeleteConfirmation({
      show: false,
      classId: '',
      className: ''
    });
  };

  const cancelDeleteClass = () => {
    setDeleteConfirmation({
      show: false,
      classId: '',
      className: ''
    });
  };

  const startEditingClass = (classId: string, className: string) => {
    setEditingClass(classId);
    setEditingClassValue(className);
  };

  const handleUpdateClass = async () => {
    if (editingClass && editingClassValue.trim()) {
      const success = await updateClass(editingClass, { name: editingClassValue.trim() });
      if (success) {
        setEditingClass(null);
        setEditingClassValue('');
      }
    }
  };

  const cancelEditingClass = () => {
    setEditingClass(null);
    setEditingClassValue('');
  };

  const handleAddAssignment = (classId: string, dateString: string) => {
    const inputKey = `${classId}-${dateString}`;
    setNewAssignmentInputs(prev => ({ ...prev, [inputKey]: '' }));
  };

  const handleCreateAssignment = async (classId: string, dateString: string) => {
    const inputKey = `${classId}-${dateString}`;
    const title = newAssignmentInputs[inputKey];
    
    if (!title || !title.trim()) {
      // Remove the input without creating assignment
      const updated = { ...newAssignmentInputs };
      delete updated[inputKey];
      setNewAssignmentInputs(updated);
      return;
    }

    // Get the count of existing assignments for this class/date to set order
    const existingAssignments = organizedAssignments[classId]?.[dateString] || [];
    
    const success = await createAssignment({
      title: title.trim(),
      date: dateString,
      planner_class: classId,
      completed: false,
      order: existingAssignments.length
    });

    if (success) {
      const updated = { ...newAssignmentInputs };
      delete updated[inputKey];
      setNewAssignmentInputs(updated);
    }
  };

  const handleAssignmentInputChange = (classId: string, dateString: string, value: string) => {
    const inputKey = `${classId}-${dateString}`;
    setNewAssignmentInputs(prev => ({ ...prev, [inputKey]: value }));
  };

  const cancelNewAssignment = (classId: string, dateString: string) => {
    const inputKey = `${classId}-${dateString}`;
    const updated = { ...newAssignmentInputs };
    delete updated[inputKey];
    setNewAssignmentInputs(updated);
  };

  const handleUpdateAssignment = async () => {
    if (editingAssignment && editingAssignmentValue.trim()) {
      const success = await updateAssignment(editingAssignment, { title: editingAssignmentValue.trim() });
      if (success) {
        setEditingAssignment(null);
        setEditingAssignmentValue('');
      }
    }
  };

  const startEditingAssignment = (assignmentId: string, currentTitle: string) => {
    setEditingAssignment(assignmentId);
    setEditingAssignmentValue(currentTitle);
  };

  const cancelEditingAssignment = () => {
    setEditingAssignment(null);
    setEditingAssignmentValue('');
  };

  const handleToggleAssignment = async (assignmentId: string, currentCompleted: boolean) => {
    await updateAssignment(assignmentId, { completed: !currentCompleted });
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    await deleteAssignment(assignmentId);
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    } else if (e.key === 'Escape') {
      if (editingClass) cancelEditingClass();
      if (editingAssignment) cancelEditingAssignment();
    }
  };

  // Enhanced getRowHeight function that accounts for text wrapping
  const getRowHeight = (classId: string) => {
    let maxHeight = 0;
    
    fiveDays.forEach(day => {
      const dayAssignments = organizedAssignments[classId]?.[day.dateString] || [];
      const hasNewInput = newAssignmentInputs[`${classId}-${day.dateString}`] !== undefined ? 1 : 0;
      
      // Calculate height for this day's column
      let columnHeight = 0;
      
      // Height for existing assignments
      dayAssignments.forEach(assignment => {
        // Estimate height based on text length
        const titleLength = assignment.title?.length || 0;
        
        if (titleLength <= 30) {
          columnHeight += 28; // Single line
        } else if (titleLength <= 60) {
          columnHeight += 40; // Two lines
        } else if (titleLength <= 90) {
          columnHeight += 56; // Three lines
        } else {
          columnHeight += 70; // Four lines or more
        }
      });
      
      // Height for new input if present
      if (hasNewInput) {
        columnHeight += 28; // Default height for input
      }
      
      if (columnHeight > maxHeight) {
        maxHeight = columnHeight;
      }
    });
    
    // Minimum height + padding
    return Math.max(70, maxHeight + 40);
  };

  // Create a mock calendar API for the header navigation
  const mockCalendarApi = {
    prev: handlePrevious,
    next: handleNext,
    today: handleToday,
    changeView: () => {} // Not used in planner
  };

  const mockCalendarRef = {
    current: {
      getApi: () => mockCalendarApi
    }
  };

  if (classes.length === 0) {
    return (
      <div className="planner-container">
        <CustomCalendarHeader 
          calendarRef={mockCalendarRef}
          currentTitle={getCurrentTitle()} 
          currentView="planner" 
          onViewChange={() => {}} 
          isAuthenticated={isAuthenticated}
          rightSidebarOpen={rightSidebarOpen}
          activeAppView={activeAppView}
          onAppViewChange={onAppViewChange}
        />
        <div className="planner-loading"></div>
      </div>
    );
  }

  // Show fallback classes if not authenticated, or if authenticated but no classes loaded yet
  const showFallback = !isAuthenticated || (isAuthenticated && classes.length === 0);
  const displayClasses = showFallback ? [
    { id: 'temp-1', name: 'Class 1', order: 0 },
    { id: 'temp-2', name: 'Class 2', order: 1 },
    { id: 'temp-3', name: 'Class 3', order: 2 },
    { id: 'temp-4', name: 'Class 4', order: 3 },
    { id: 'temp-5', name: 'Class 5', order: 4 },
    { id: 'temp-6', name: 'Class 6', order: 5 }
  ] : [...classes].sort((a, b) => a.order - b.order);

  return (
    <div className="planner-container">
      {/* Use the same header as Calendar with navigation functionality */}
      <CustomCalendarHeader 
        calendarRef={mockCalendarRef}
        currentTitle={getCurrentTitle()} 
        currentView="planner" 
        onViewChange={() => {}} 
        isAuthenticated={isAuthenticated}
        rightSidebarOpen={rightSidebarOpen}
        activeAppView={activeAppView}
        onAppViewChange={onAppViewChange}
      />

      {error && (
        <div className="planner-error">
          Error: {error}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.show && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation-modal">
            <h3>Delete Class</h3>
            <p>Are you sure you want to delete "{deleteConfirmation.className}"?</p>
            <p className="delete-warning">This will also delete all assignments in this class.</p>
            <div className="delete-confirmation-buttons">
              <button 
                onClick={cancelDeleteClass}
                className="cancel-delete-btn"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteClass}
                className="confirm-delete-btn"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="planner-content">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="classes-header">
              {!showAddClass && <h2>Classes</h2>}
              {!showAddClass && isAuthenticated ? (
                <button onClick={() => setShowAddClass(true)} className="add-class-btn">+</button>
              ) : isAuthenticated ? (
                <div className="add-class-input">
                  <input
                    type="text"
                    placeholder="Class name"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, handleAddClass)}
                    onBlur={() => {
                      if (newClassName.trim()) {
                        handleAddClass();
                      } else {
                        setShowAddClass(false);
                      }
                    }}
                    className="class-input"
                    autoFocus
                  />
                </div>
              ) : null}
            </div>
          </div>
          <div className="classes-list">
            {displayClasses.map((cls, index) => (
              <div 
                key={cls.id} 
                className={`class-item ${
                  dragState.isDragging && dragState.draggedIndex === index ? 'dragging' : ''
                } ${
                  dragState.dragOverIndex === index ? 'drag-over' : ''
                }`}
                style={{ height: `${getRowHeight(cls.id)}px` }}
                draggable={isAuthenticated && !String(cls.id).startsWith('temp-')}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                {isAuthenticated && !String(cls.id).startsWith('temp-') && (
                  <div className="drag-handle">
                    <GripVertical size={14} />
                  </div>
                )}
                
                {editingClass === cls.id ? (
                  <input
                    type="text"
                    value={editingClassValue}
                    onChange={(e) => setEditingClassValue(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, handleUpdateClass)}
                    onBlur={handleUpdateClass}
                    className="class-name-edit-input"
                    autoFocus
                  />
                ) : (
                  <div className="class-name-container">
                    <span className="class-name">
                      {cls.name}
                    </span>
                    {isAuthenticated && !String(cls.id).startsWith('temp-') && (
                      <button 
                        onClick={() => startEditingClass(cls.id, cls.name)}
                        className="edit-class-btn"
                        title="Edit class name"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                )}
                {isAuthenticated && !String(cls.id).startsWith('temp-') && (
                  <button 
                    onClick={() => handleRemoveClass(cls.id, cls.name)}
                    className="delete-class-btn"
                    title="Delete class"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="main-grid">
          <div className="grid-header">
            {fiveDays.map((day) => (
              <div key={day.dateString} className={`day-header ${day.isToday ? 'today' : ''}`}>
                {day.displayName} {day.dayNumber}
              </div>
            ))}
          </div>

          <div className="grid-body">
            {displayClasses.map((cls, index) => (
              <div 
                key={cls.id} 
                className={`class-row ${
                  dragState.isDragging && dragState.draggedIndex === index ? 'dragging-row' : ''
                }`}
                style={{ height: `${getRowHeight(cls.id)}px` }}
              >
                {fiveDays.map((day) => (
                  <div 
                    key={`${cls.id}-${day.dateString}`} 
                    className={`assignment-cell ${day.isToday ? 'today-cell' : ''}`}
                  >
                    <div className="assignments-list">
                      {/* Existing assignments */}
                      {organizedAssignments[cls.id]?.[day.dateString]?.map((assignment) => (
                        <div key={assignment.id} className="assignment-item">
                          <input
                            type="checkbox"
                            checked={assignment.completed}
                            onChange={() => handleToggleAssignment(assignment.id, assignment.completed)}
                            className="assignment-checkbox"
                          />
                          {editingAssignment === assignment.id ? (
                            <input
                              type="text"
                              value={editingAssignmentValue}
                              onChange={(e) => setEditingAssignmentValue(e.target.value)}
                              onKeyPress={(e) => handleKeyPress(e, handleUpdateAssignment)}
                              onBlur={handleUpdateAssignment}
                              className="assignment-edit-input"
                              autoFocus
                              placeholder="Assignment name"
                            />
                          ) : (
                            <span 
                              className={`assignment-title ${assignment.completed ? 'completed' : ''}`}
                              onClick={() => startEditingAssignment(assignment.id, assignment.title)}
                              style={{ cursor: 'pointer' }}
                            >
                              {assignment.title || 'Click to edit'}
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteAssignment(assignment.id)}
                            className="delete-assignment-btn"
                            title="Delete assignment"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      
                      {/* New assignment input */}
                      {newAssignmentInputs[`${cls.id}-${day.dateString}`] !== undefined && (
                        <div className="assignment-item">
                          <input
                            type="checkbox"
                            disabled
                            className="assignment-checkbox"
                          />
                          <input
                            type="text"
                            value={newAssignmentInputs[`${cls.id}-${day.dateString}`] || ''}
                            onChange={(e) => handleAssignmentInputChange(cls.id, day.dateString, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCreateAssignment(cls.id, day.dateString);
                              } else if (e.key === 'Escape') {
                                cancelNewAssignment(cls.id, day.dateString);
                              }
                            }}
                            onBlur={() => handleCreateAssignment(cls.id, day.dateString)}
                            className="assignment-edit-input"
                            autoFocus
                            placeholder="Assignment name"
                          />
                          <button
                            onClick={() => cancelNewAssignment(cls.id, day.dateString)}
                            className="delete-assignment-btn"
                            title="Cancel"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Only show add button for authenticated users and non-temp classes */}
                    {isAuthenticated && !String(cls.id).startsWith('temp-') && (
                      <button 
                        onClick={() => handleAddAssignment(cls.id, day.dateString)}
                        className="add-assignment-btn"
                        title="Add assignment"
                        disabled={newAssignmentInputs[`${cls.id}-${day.dateString}`] !== undefined}
                      >
                        +
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Drag and Drop Styles */
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

        .class-row.dragging-row {
          opacity: 0.5;
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

        /* Delete Confirmation Modal Styles */
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

        /* Adjust class-name-container to account for drag handle */
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

export default Planner;