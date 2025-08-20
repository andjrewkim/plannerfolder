import React, { useState, useRef } from 'react';
import CustomCalendarHeader from '../CustomCalHeader';
import '../../styles/planner.css';

// Define or import ViewType - matching the main app view types
type ViewType = 'calendar' | 'your-new-view';

interface Assignment {
  id: string;
  title: string;
  completed: boolean;
  isEditing?: boolean;
}

interface Class {
  id: string;
  name: string;
  isEditing?: boolean;
}

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
  const [classes, setClasses] = useState<Class[]>([
    { id: '1', name: 'Class 1' },
    { id: '2', name: 'Class 2' },
    { id: '3', name: 'Class 3' },
    { id: '4', name: 'Class 4' },
    { id: '5', name: 'Class 5' },
    { id: '6', name: 'Class 6' }
  ]);
  const [assignments, setAssignments] = useState<Record<string, Record<string, Assignment[]>>>({});
  const [newClassName, setNewClassName] = useState('');
  const [showAddClass, setShowAddClass] = useState(false);

  // Create a dummy ref for the header (not used in planner but required by header component)
  const dummyCalendarRef = useRef(null);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayDate = new Date().getDate();

  const addClass = () => {
    if (!newClassName.trim()) return;
    const newClass: Class = {
      id: Date.now().toString(),
      name: newClassName.trim()
    };
    setClasses([...classes, newClass]);
    setNewClassName('');
    setShowAddClass(false);
    setAssignments(prev => ({ ...prev, [newClass.id]: {} }));
  };

  const removeClass = (classId: string) => {
    setClasses(classes.filter(cls => cls.id !== classId));
    const newAssignments = { ...assignments };
    delete newAssignments[classId];
    setAssignments(newAssignments);
  };

  const updateClassName = (classId: string, newName: string) => {
    setClasses(classes.map(cls => 
      cls.id === classId 
        ? { ...cls, name: newName, isEditing: false }
        : cls
    ));
  };

  const startEditingClass = (classId: string) => {
    setClasses(classes.map(cls => 
      cls.id === classId 
        ? { ...cls, isEditing: true }
        : { ...cls, isEditing: false }
    ));
  };

  const addAssignment = (classId: string, day: string) => {
    const newAssignment: Assignment = {
      id: Date.now().toString(),
      title: '',
      completed: false,
      isEditing: true
    };

    setAssignments(prev => ({
      ...prev,
      [classId]: {
        ...prev[classId],
        [day]: [...(prev[classId]?.[day] || []), newAssignment]
      }
    }));
  };

  const updateAssignment = (classId: string, day: string, assignmentId: string, title: string) => {
    setAssignments(prev => ({
      ...prev,
      [classId]: {
        ...prev[classId],
        [day]: prev[classId][day].map(assignment =>
          assignment.id === assignmentId
            ? { ...assignment, title, isEditing: false }
            : assignment
        )
      }
    }));
  };

  const toggleAssignment = (classId: string, day: string, assignmentId: string) => {
    setAssignments(prev => ({
      ...prev,
      [classId]: {
        ...prev[classId],
        [day]: prev[classId][day].map(assignment =>
          assignment.id === assignmentId
            ? { ...assignment, completed: !assignment.completed }
            : assignment
        )
      }
    }));
  };

  const deleteAssignment = (classId: string, day: string, assignmentId: string) => {
    setAssignments(prev => ({
      ...prev,
      [classId]: {
        ...prev[classId],
        [day]: prev[classId][day].filter(assignment => assignment.id !== assignmentId)
      }
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  const getRowHeight = (classId: string) => {
    let maxAssignments = 0;
    daysOfWeek.forEach(day => {
      const dayAssignments = assignments[classId]?.[day]?.length || 0;
      if (dayAssignments > maxAssignments) {
        maxAssignments = dayAssignments;
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
    return `${day} ${dayDate.getDate()}`;
  };

  // Dummy functions for calendar header (not used in planner)
  const handleDummyViewChange = (view: string) => {
    // Not used in planner, but required by header
    console.log('View change not applicable to planner:', view);
  };

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

      <div className="planner-content">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="classes-header">
              <h2>Classes</h2>
              {!showAddClass ? (
                <button onClick={() => setShowAddClass(true)} className="add-class-btn">+</button>
              ) : (
                <div className="add-class-input">
                  <input
                    type="text"
                    placeholder="Class name"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, addClass)}
                    onBlur={() => {
                      if (newClassName.trim()) addClass();
                      else setShowAddClass(false);
                    }}
                    className="class-input"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>
          <div className="classes-list">
            {classes.map((cls) => (
              <div 
                key={cls.id} 
                className="class-item"
                style={{ height: `${getRowHeight(cls.id)}px` }}
              >
                {cls.isEditing ? (
                  <input
                    type="text"
                    value={cls.name}
                    onChange={(e) => setClasses(classes.map(c => 
                      c.id === cls.id ? { ...c, name: e.target.value } : c
                    ))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        updateClassName(cls.id, cls.name);
                      }
                    }}
                    onBlur={() => updateClassName(cls.id, cls.name)}
                    className="class-name-edit-input"
                    autoFocus
                  />
                ) : (
                  <span 
                    className="class-name"
                    onClick={() => startEditingClass(cls.id)}
                  >
                    {cls.name}
                  </span>
                )}
                <button 
                  onClick={() => removeClass(cls.id)}
                  className="delete-class-btn"
                  title="Delete class"
                >
                  ×
                </button>
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
            {classes.map((cls) => (
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
                      {assignments[cls.id]?.[day]?.map((assignment) => (
                        <div key={assignment.id} className="assignment-item">
                          <input
                            type="checkbox"
                            checked={assignment.completed}
                            onChange={() => toggleAssignment(cls.id, day, assignment.id)}
                            className="assignment-checkbox"
                          />
                          {assignment.isEditing ? (
                            <input
                              type="text"
                              value={assignment.title}
                              onChange={(e) => {
                                const newTitle = e.target.value;
                                setAssignments(prev => ({
                                  ...prev,
                                  [cls.id]: {
                                    ...prev[cls.id],
                                    [day]: prev[cls.id][day].map(a =>
                                      a.id === assignment.id ? { ...a, title: newTitle } : a
                                    )
                                  }
                                }));
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updateAssignment(cls.id, day, assignment.id, assignment.title);
                                }
                              }}
                              onBlur={() => updateAssignment(cls.id, day, assignment.id, assignment.title)}
                              className="assignment-edit-input"
                              autoFocus
                              placeholder="Assignment name"
                            />
                          ) : (
                            <span className={`assignment-title ${assignment.completed ? 'completed' : ''}`}>
                              {assignment.title}
                            </span>
                          )}
                          <button
                            onClick={() => deleteAssignment(cls.id, day, assignment.id)}
                            className="delete-assignment-btn"
                            title="Delete assignment"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <button 
                      onClick={() => addAssignment(cls.id, day)}
                      className="add-assignment-btn"
                      title="Add assignment"
                    >
                      +
                    </button>
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