import React, { useState, useRef } from 'react';
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

  // Create a dummy ref for the header (not used in planner but required by header component)
  const dummyCalendarRef = useRef(null);

  // Get organized assignments
  const organizedAssignments = getAssignmentsByClassAndDate();

  // Helper function to format date as YYYY-MM-DD for API
  const formatDateForAPI = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Helper function to get display name for date
  const getDateDisplayName = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  };

  // Get the 5 days to display based on current offset
  const getFiveDaysToShow = () => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + currentDateOffset - 1); // Start from 1 day before current offset (changed from -2)

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

  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    const success = await createClass(newClassName.trim());
    if (success) {
      setNewClassName('');
      setShowAddClass(false);
    }
  };

  const handleRemoveClass = async (classId: string) => {
    await deleteClass(classId);
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
        <div className="planner-loading">Loading planner...</div>
      </div>
    );
  }

  // Debug logging

  // Show fallback classes if not authenticated, or if authenticated but no classes loaded yet
  const showFallback = !isAuthenticated || (isAuthenticated && classes.length === 0);
  const displayClasses = showFallback ? [
    { id: 'temp-1', name: 'Class 1', order: 0 },
    { id: 'temp-2', name: 'Class 2', order: 1 },
    { id: 'temp-3', name: 'Class 3', order: 2 },
    { id: 'temp-4', name: 'Class 4', order: 3 },
    { id: 'temp-5', name: 'Class 5', order: 4 },
    { id: 'temp-6', name: 'Class 6', order: 5 }
  ] : classes;

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

      <div className="planner-content">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="classes-header">
              <h2>Classes</h2>
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
            {displayClasses.map((cls) => (
              <div 
                key={cls.id} 
                className="class-item"
                style={{ height: `${getRowHeight(cls.id)}px` }}
              >
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
                  <span 
                    className="class-name"
                    onClick={() => isAuthenticated && !String(cls.id).startsWith('temp-') && startEditingClass(cls.id, cls.name)}
                    style={{ cursor: isAuthenticated && !String(cls.id).startsWith('temp-') ? 'pointer' : 'default' }}
                  >
                    {cls.name}
                  </span>
                )}
                {isAuthenticated && !String(cls.id).startsWith('temp-') && (
                  <button 
                    onClick={() => handleRemoveClass(cls.id)}
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
            {displayClasses.map((cls) => (
              <div 
                key={cls.id} 
                className="class-row"
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
    </div>
  );
};

export default Planner;