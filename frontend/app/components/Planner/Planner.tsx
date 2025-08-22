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
    getAssignmentsByClassAndDay
  } = usePlanner();

  const [newClassName, setNewClassName] = useState('');
  const [showAddClass, setShowAddClass] = useState(false);
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [editingClassValue, setEditingClassValue] = useState('');
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [editingAssignmentValue, setEditingAssignmentValue] = useState('');
  const [newAssignmentInputs, setNewAssignmentInputs] = useState<Record<string, string>>({});

  // Create a dummy ref for the header (not used in planner but required by header component)
  const dummyCalendarRef = useRef(null);

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const daysOfWeekDisplay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  // Get organized assignments
  const organizedAssignments = getAssignmentsByClassAndDay();

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

  const handleAddAssignment = (classId: string, day: string) => {
    const inputKey = `${classId}-${day}`;
    setNewAssignmentInputs(prev => ({ ...prev, [inputKey]: '' }));
  };

  const handleCreateAssignment = async (classId: string, day: string) => {
    const inputKey = `${classId}-${day}`;
    const title = newAssignmentInputs[inputKey];
    
    if (!title || !title.trim()) {
      // Remove the input without creating assignment
      const updated = { ...newAssignmentInputs };
      delete updated[inputKey];
      setNewAssignmentInputs(updated);
      return;
    }

    // Get the count of existing assignments for this class/day to set order
    const existingAssignments = organizedAssignments[classId]?.[day] || [];
    
    const success = await createAssignment({
      title: title.trim(),
      day_of_week: day,
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

  const handleAssignmentInputChange = (classId: string, day: string, value: string) => {
    const inputKey = `${classId}-${day}`;
    setNewAssignmentInputs(prev => ({ ...prev, [inputKey]: value }));
  };

  const cancelNewAssignment = (classId: string, day: string) => {
    const inputKey = `${classId}-${day}`;
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

  const getRowHeight = (classId: string) => {
    let maxAssignments = 0;
    daysOfWeek.forEach(day => {
      const dayAssignments = organizedAssignments[classId]?.[day]?.length || 0;
      const hasNewInput = newAssignmentInputs[`${classId}-${day}`] !== undefined ? 1 : 0;
      const totalItems = dayAssignments + hasNewInput;
      if (totalItems > maxAssignments) {
        maxAssignments = totalItems;
      }
    });
    // Minimum height for at least 2 assignments, then expand as needed
    return Math.max(70, 40 + (Math.max(2, maxAssignments) * 32));
  };

  const getDayWithDate = (day: string, index: number) => {
    const currentDate = new Date();
    const currentDay = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Calculate Monday of current week
    const dayDate = new Date(currentDate);
    dayDate.setDate(currentDate.getDate() + mondayOffset + index);
    return `${daysOfWeekDisplay[index]} ${dayDate.getDate()}`;
  };

  // Dummy functions for calendar header (not used in planner)
  const handleDummyViewChange = (view: string) => {
    // Not used in planner, but required by header
    console.log('View change not applicable to planner:', view);
  };

  if (classes.length === 0) {

    return (
      <div className="planner-container">
        <CustomCalendarHeader 
          calendarRef={dummyCalendarRef}
          currentTitle="Weekly Planner" 
          currentView="planner" 
          onViewChange={handleDummyViewChange} 
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
  console.log('Planner Debug:', {
    classesCount: classes.length,
    assignmentsCount: assignments.length,
    isAuthenticated,
    error,
    isLoading,
    initialized,
    classes: classes.map(c => ({ id: c.id, name: c.name }))
  });

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
      {/* Use the same header as Calendar */}
      <CustomCalendarHeader 
        calendarRef={dummyCalendarRef}
        currentTitle="Weekly Planner" // Static title for planner
        currentView="planner" // Static view identifier
        onViewChange={handleDummyViewChange} // Dummy function
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
            {daysOfWeek.map((day, index) => (
              <div key={day} className={`day-header ${day === today ? 'today' : ''}`}>
                {getDayWithDate(day, index)}
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
                {daysOfWeek.map((day) => (
                  <div 
                    key={`${cls.id}-${day}`} 
                    className={`assignment-cell ${day === today ? 'today-cell' : ''}`}
                  >
                    <div className="assignments-list">
                      {/* Existing assignments */}
                      {organizedAssignments[cls.id]?.[day]?.map((assignment) => (
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
                      {newAssignmentInputs[`${cls.id}-${day}`] !== undefined && (
                        <div className="assignment-item">
                          <input
                            type="checkbox"
                            disabled
                            className="assignment-checkbox"
                          />
                          <input
                            type="text"
                            value={newAssignmentInputs[`${cls.id}-${day}`] || ''}
                            onChange={(e) => handleAssignmentInputChange(cls.id, day, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCreateAssignment(cls.id, day);
                              } else if (e.key === 'Escape') {
                                cancelNewAssignment(cls.id, day);
                              }
                            }}
                            onBlur={() => handleCreateAssignment(cls.id, day)}
                            className="assignment-edit-input"
                            autoFocus
                            placeholder="Assignment name"
                          />
                          <button
                            onClick={() => cancelNewAssignment(cls.id, day)}
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
                        onClick={() => handleAddAssignment(cls.id, day)}
                        className="add-assignment-btn"
                        title="Add assignment"
                        disabled={newAssignmentInputs[`${cls.id}-${day}`] !== undefined}
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