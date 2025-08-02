import React, { useEffect, useState, useRef, useCallback } from 'react';
import EventForm from './EventForm';
import '../styles/container.css';
import { authAPI } from '../../lib/auth';
import { useAppState, EventDetails, TaskData } from '../hooks/useAppState';

interface EventData {
  id?: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  event_type: string;
  recurrence_pattern: string;
  color: string;
  is_all_day: boolean;
  day_marking_title?: string;
  type?: string;
}

interface APIEvent {
  id: number;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  color: string;
}

interface SidebarProps {
  onEventChange?: () => void;
  refreshTrigger?: number;
}

const LAST_RESET_KEY = 'tasks_last_reset_date';

const Sidebar: React.FC<SidebarProps> = ({ 
  onEventChange, 
  refreshTrigger
}) => {
  const {
    events,
    tasks,
    isLoading,
    error,
    initialized,
    createTask,
    deleteTask,
    setError,
    initializeData
  } = useAppState();

  // Local state
  const [todayEvents, setTodayEvents] = useState<APIEvent[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set());
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [eventResults, setEventResults] = useState<EventData[]>([]);
  const [eventError, setEventError] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  
  // Refs
  const taskInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  // Section heights for resizing
  const [sectionHeights, setSectionHeights] = useState({
    eventForm: 250,
    schedule: 350,
    tasks: 350
  });
  
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const heightsRef = useRef(sectionHeights);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Calculate hours until event
  const calculateHoursUntil = useCallback((date: string, startTime: string, endTime?: string): { hoursUntil: number | null, status: 'upcoming' | 'ongoing' | 'past' } => {
    try {
      // Parse the date and time more carefully
      const dateStr = date.split('T')[0]; // Get YYYY-MM-DD
      let startTimeStr = startTime;
      
      // Handle different time formats
      if (startTime && !startTime.includes(':')) {
        console.warn('Invalid time format:', startTime);
        return { hoursUntil: null, status: 'past' };
      }
      
      // Ensure time has seconds
      if (startTimeStr && startTimeStr.split(':').length === 2) {
        startTimeStr += ':00';
      }
      
      const eventStartDateTime = new Date(`${dateStr}T${startTimeStr}`);
      console.log('Event start datetime:', eventStartDateTime, 'from', dateStr, startTimeStr);
      
      if (isNaN(eventStartDateTime.getTime())) {
        console.error('Invalid date/time:', dateStr, startTimeStr);
        return { hoursUntil: null, status: 'past' };
      }
      
      const now = new Date();
      const startDiffMs = eventStartDateTime.getTime() - now.getTime();
      const startDiffHours = startDiffMs / (1000 * 60 * 60);
      
      // Check if we have end time for ongoing detection
      if (endTime && endTime.trim()) {
        let endTimeStr = endTime;
        if (endTimeStr.split(':').length === 2) {
          endTimeStr += ':00';
        }
        const eventEndDateTime = new Date(`${dateStr}T${endTimeStr}`);
        
        if (!isNaN(eventEndDateTime.getTime())) {
          const endDiffMs = eventEndDateTime.getTime() - now.getTime();
          
          console.log('Event end datetime:', eventEndDateTime, 'Start diff hours:', startDiffHours, 'End diff hours:', endDiffMs / (1000 * 60 * 60));
          
          // Event is ongoing if we're past start time but before end time
          if (startDiffHours <= 0 && endDiffMs > 0) {
            return { hoursUntil: startDiffHours, status: 'ongoing' };
          }
        }
      }
      
      console.log('Hours until event:', startDiffHours, 'for event at', eventStartDateTime);
      
      if (startDiffHours > 0) {
        return { hoursUntil: startDiffHours, status: 'upcoming' };
      } else {
        return { hoursUntil: startDiffHours, status: 'past' };
      }
    } catch (error) {
      console.error('Error calculating hours until event:', error, { date, startTime, endTime });
      return { hoursUntil: null, status: 'past' };
    }
  }, []);

  // Format hours until display
  const formatHoursUntil = useCallback((hours: number): string => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    } else if (hours < 24) {
      const wholeHours = Math.floor(hours);
      const minutes = Math.round((hours - wholeHours) * 60);
      if (minutes === 0) {
        return `${wholeHours}h`;
      }
      return `${wholeHours}h ${minutes}m`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.floor(hours % 24);
      if (remainingHours === 0) {
        return `${days}d`;
      }
      return `${days}d ${remainingHours}h`;
    }
  }, []);

  // Update today's events when events change
  useEffect(() => {
    if (!isMountedRef.current) return;

    if (events && events.length > 0) {
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const filteredEvents = events
        .filter((event: EventDetails) => {
          const eventDateString = event.date.split('T')[0];
          return eventDateString === todayString;
        })
        .map((event: EventDetails) => ({
          id: parseInt(event.id || event.eventId || '0'),
          event_name: event.event_name,
          date: event.date,
          start_time: event.start_time || '',
          end_time: event.end_time || '', // ✅ Add this line
          color: event.color
        }))
        .sort((a, b) => {
          return a.start_time.localeCompare(b.start_time);
        });

      setTodayEvents(filteredEvents);
    } else {
      setTodayEvents([]);
    }
  }, [events, calculateHoursUntil]);

  // Handle refresh trigger
  useEffect(() => {
    if (!isMountedRef.current) return;

    if (refreshTrigger && refreshTrigger > 0) {
      console.log('Refresh trigger activated:', refreshTrigger);
      initializeData(true);
      
      if (onEventChange) {
        setTimeout(() => onEventChange(), 100);
      }
    }
  }, [refreshTrigger, onEventChange, initializeData]);

  // Focus input when adding task
  useEffect(() => {
    if (isAddingTask && taskInputRef.current && isMountedRef.current) {
      taskInputRef.current.focus();
    }
  }, [isAddingTask]);

  // Event result handler
  const handleEventResult = useCallback(async (results: EventData[]) => {
    if (!isMountedRef.current) return;

    console.log('Event created, refreshing data...');
    setEventResults(results);
    
    try {
      await initializeData(true);
      if (onEventChange) {
        setTimeout(() => onEventChange(), 100);
      }
    } catch (error) {
      console.error('Error refreshing after event creation:', error);
    }
  }, [initializeData, onEventChange]);

  // Task area click handler
  const handleTaskAreaClick = useCallback((e: React.MouseEvent) => {
    if (!isMountedRef.current || isCreatingTask) return;

    const target = e.target as HTMLElement;
    const clickableClasses = ['section-content', 'empty-state', 'clickable-area'];
    
    if (clickableClasses.includes(target.className)) {
      setIsAddingTask(true);
      setLocalError(null);
    }
  }, [isCreatingTask]);

  // Reset daily tasks
  const resetDailyTasks = useCallback(async () => {
    if (!isMountedRef.current || !authAPI.isAuthenticated()) {
      setLocalError('Please log in to manage your tasks');
      return;
    }

    try {
      console.log('Resetting daily tasks...');
      
      const regularTasks = tasks.filter((task: TaskData) => 
        !task.date || task.date !== "longterm"
      );
      
      console.log(`Found ${regularTasks.length} regular tasks to reset`);

      // Delete existing regular tasks
      for (const task of regularTasks) {
        if (task.id && isMountedRef.current) {
          console.log('Deleting task:', task.event);
          await deleteTask(task.id);
        }
      }

      // Recreate tasks
      for (const task of regularTasks) {
        if (isMountedRef.current) {
          console.log('Recreating task:', task.event);
          await createTask({
            event: task.event,
            date: null  // Reset as regular task
          });
        }
      }
      
      console.log('Daily tasks reset completed');
    } catch (error) {
      console.error('Error resetting tasks:', error);
      if (isMountedRef.current) {
        setLocalError('Failed to reset daily tasks');
      }
    }
  }, [tasks, deleteTask, createTask]);

  // Check and reset tasks
  const checkAndResetTasks = useCallback(async () => {
    if (!isMountedRef.current || !authAPI.isAuthenticated() || !initialized) {
      return;
    }

    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0];
    const lastResetDate = localStorage.getItem(LAST_RESET_KEY);

    if (lastResetDate !== todayFormatted) {
      console.log('New day detected, resetting tasks...');
      await resetDailyTasks();
      localStorage.setItem(LAST_RESET_KEY, todayFormatted);
    }
  }, [resetDailyTasks, initialized]);

  // Create task handler with better validation
  const handleCreateTask = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isMountedRef.current || isCreatingTask) return;
    
    const trimmedText = newTaskText.trim();
    if (!trimmedText) {
      setLocalError('Task title cannot be empty');
      return;
    }

    if (!authAPI.isAuthenticated()) {
      setLocalError('Please log in to create tasks');
      return;
    }

    setIsCreatingTask(true);
    setLocalError(null);

    try {
      console.log('Creating task with data:', {
        event: trimmedText,
        date: null  // null for regular tasks, "longterm" for long-term tasks
      });

      const taskData = {
        event: trimmedText,
        date: null  // null for regular tasks, "longterm" for long-term tasks
      };

      const newTask = await createTask(taskData);

      if (newTask && isMountedRef.current) {
        console.log('Task created successfully:', newTask);
        setNewTaskText('');
        
        // Keep form open for continuous adding
        if (taskInputRef.current) {
          taskInputRef.current.focus();
        }
      } else {
        console.error('Task creation returned null');
        if (isMountedRef.current) {
          setLocalError('Failed to create task - no response from server');
        }
      }
    } catch (error) {
      console.error('Error creating task:', error);
      if (isMountedRef.current) {
        if (error instanceof Error) {
          setLocalError(`Failed to create task: ${error.message}`);
        } else {
          setLocalError('Failed to create task - unknown error');
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsCreatingTask(false);
      }
    }
  }, [newTaskText, createTask, isCreatingTask]);

  // Cancel task creation
  const handleCancelTask = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setIsAddingTask(false);
    setNewTaskText('');
    setLocalError(null);
  }, []);

  // Task completion handler
  const handleTaskComplete = useCallback(async (taskId: string) => {
    if (!isMountedRef.current || deletingTasks.has(taskId)) return;
    
    if (!authAPI.isAuthenticated()) {
      setLocalError('Please log in to manage tasks');
      return;
    }

    setDeletingTasks(prev => new Set([...prev, taskId]));
    
    // Delay for animation
    setTimeout(async () => {
      if (!isMountedRef.current) return;

      try {
        console.log('Completing task:', taskId);
        const success = await deleteTask(taskId);
        
        if (success) {
          console.log('Task completed successfully');
          setLocalError(null);
        } else {
          console.error('Task deletion failed');
          if (isMountedRef.current) {
            setLocalError('Failed to complete task');
          }
        }
      } catch (error) {
        console.error('Error completing task:', error);
        if (isMountedRef.current) {
          setLocalError('Failed to complete task');
        }
      } finally {
        if (isMountedRef.current) {
          setDeletingTasks(prev => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
        }
      }
    }, 400);
  }, [deleteTask, deletingTasks]);

  // Format event time
  const formatEventTime = useCallback((date: string, time: string): string => {
    try {
      return new Date(`${date.split('T')[0]}T${time}`).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return time;
    }
  }, []);

  // Resize handlers
  const startResize = useCallback((section: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    
    setActiveSection(section);
    setIsResizing(true);
    
    startYRef.current = e.clientY;
    startHeightRef.current = heightsRef.current[section as keyof typeof sectionHeights];
    
    const sections = ['eventForm', 'schedule', 'tasks'];
    const sectionIndex = sections.indexOf(section);
    const nextSectionIndex = sectionIndex + 1;
    const nextSection = nextSectionIndex < sections.length ? sections[nextSectionIndex] : null;
    
    document.body.classList.add('resizing');
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startYRef.current;
      let newSectionHeight = Math.max(120, startHeightRef.current + delta);
      
      if (nextSection) {
        const nextSectionStartHeight = heightsRef.current[nextSection as keyof typeof sectionHeights];
        const nextSectionNewHeight = Math.max(120, nextSectionStartHeight - delta);
        
        if (nextSectionNewHeight < 120) {
          newSectionHeight = startHeightRef.current + (nextSectionStartHeight - 120);
        }
        
        const newHeights = {
          ...heightsRef.current,
          [section]: newSectionHeight,
          [nextSection]: heightsRef.current[nextSection as keyof typeof sectionHeights] - 
                        (newSectionHeight - heightsRef.current[section as keyof typeof sectionHeights])
        };
        
        heightsRef.current = newHeights;
        
        const currentSection = document.querySelector(`.sidebar-section[data-section="${section}"]`);
        const nextSectionEl = document.querySelector(`.sidebar-section[data-section="${nextSection}"]`);
        
        if (currentSection && nextSectionEl) {
          currentSection.setAttribute('style', `height: ${newSectionHeight}px; min-height: 120px;`);
          nextSectionEl.setAttribute('style', `height: ${newHeights[nextSection as keyof typeof newHeights]}px; min-height: 120px;`);
        }
      }
    };
    
    const handleMouseUp = () => {
      setActiveSection(null);
      setIsResizing(false);
      document.body.classList.remove('resizing');
      setSectionHeights({...heightsRef.current});
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Reset timer effect
  useEffect(() => {
    if (!authAPI.isAuthenticated() || !initialized) return;

    checkAndResetTasks();

    const resetTimer = setInterval(checkAndResetTasks, 60 * 60 * 1000);
    return () => clearInterval(resetTimer);
  }, [checkAndResetTasks, initialized]);

  // Cleanup resize effect
  useEffect(() => {
    return () => {
      document.body.classList.remove('resizing');
    };
  }, []);

  // Update heights ref
  useEffect(() => {
    heightsRef.current = sectionHeights;
  }, [sectionHeights]);

  // Filter regular tasks - tasks with null date or not "longterm"
  const regularTasks = tasks.filter((task: TaskData) => 
    !task.date || task.date !== "longterm"
  );

  // Determine error to display
  const displayError = localError || error;

  // Loading state
  if (!initialized && isLoading) {
    return (
      <div className="app-layout">
        <aside className="app-sidebar bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
          <div className="loading-message" style={{ padding: '20px', textAlign: 'center' }}>
            Initializing application...
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside
        className="app-sidebar bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
        style={{ overflowY: 'auto', maxHeight: '100vh' }}
      >

        {/* Event Form Section */}
        <section 
          className={`sidebar-section ${activeSection === 'eventForm' ? 'resizing' : ''}`}
          data-section="eventForm"
          style={{ 
            marginTop: '10px', 
            height: `${sectionHeights.eventForm}px`,
            minHeight: '120px',
            transition: isResizing ? 'none' : 'height 0.2s ease-out'
          }}
        >
          <h3 className="section-title">Create Event</h3>
          <div className="section-content" style={{ overflow: 'hidden' }}>
            <EventForm 
              setResult={setEventResults} 
              setError={setEventError}
              onEventResult={handleEventResult}
            />
          </div>
          <div 
            className={`resize-handle ${activeSection === 'eventForm' ? 'active' : ''}`}
            onMouseDown={startResize('eventForm')}
          />
        </section>

        {/* Today's Schedule Section */}
        <section 
          className={`sidebar-section ${activeSection === 'schedule' ? 'resizing' : ''}`}
          data-section="schedule"
          style={{ 
            height: `${sectionHeights.schedule}px`,
            minHeight: '120px',
            transition: isResizing ? 'none' : 'height 0.2s ease-out'
          }}
        >
          <h3 className="section-title">Today's Schedule</h3>
          <div className="section-content" style={{ overflowY: 'auto', maxHeight: `${sectionHeights.schedule - 60}px` }}>
            {displayError && !isLoading ? (
              <div className="error-message" style={{ color: 'red', padding: '10px' }}>
                {displayError}
              </div>
            ) : isLoading && todayEvents.length === 0 ? (
              <div className="loading-message">Loading events...</div>
            ) : todayEvents.length > 0 ? (
              <ul className="event-list">
                {todayEvents.map((event, index) => {
                  const result = calculateHoursUntil(event.date, event.start_time, event.end_time);
                  const { hoursUntil, status } = result;
                  
                  // Find the first upcoming event for timer display
                  const firstUpcomingIndex = todayEvents.findIndex(e => {
                    const eventResult = calculateHoursUntil(e.date, e.start_time, e.end_time);
                    return eventResult.status === 'upcoming';
                  });
                  
                  const showTimer = status === 'upcoming' && index === firstUpcomingIndex && hoursUntil !== null;
                  
                  console.log('Event:', event.event_name, 'Status:', status, 'Hours until:', hoursUntil, 'Show timer:', showTimer, 'End time:', event.end_time);
                  
                  return (
                    <li
                      key={event.id}
                      className="event-item"
                      style={{
                        '--event-color': event.color,
                        ...(status === 'past' && {
                          opacity: 0.5
                        }),
                        ...(status === 'ongoing' && {
                          backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        })
                      } as React.CSSProperties}
                    >
                      <span 
                        className="event-name"
                        style={{
                          ...(status === 'past' && {
                            textDecoration: 'line-through',
                            color: '#888'
                          })
                        }}
                      >
                        {event.event_name}
                        {status === 'ongoing' && (
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '11px',
                            color: '#007bff',
                            fontWeight: 'bold'
                          }}>
                            LIVE
                          </span>
                        )}
                      </span>
                      <span 
                        className="event-time"
                        style={{
                          ...(status === 'past' && {
                            textDecoration: 'line-through',
                            color: '#888'
                          })
                        }}
                      >
                        {showTimer && (
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: 'bold', 
                            color: '#007bff',
                            marginRight: '8px'
                          }}>
                            (in {formatHoursUntil(hoursUntil)})
                          </span>
                        )}
                        {status === 'ongoing' && event.end_time ? 
                          `ends at: ${formatEventTime(event.date, event.end_time)}` :
                          formatEventTime(event.date, event.start_time)
                        }
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty-state">No events for today</div>
            )}
          </div>
          <div 
            className={`resize-handle ${activeSection === 'schedule' ? 'active' : ''}`}
            onMouseDown={startResize('schedule')}
          />
        </section>

        {/* Tasks Section */}
        <section 
          className="sidebar-section"
          data-section="tasks"
          style={{ 
            height: `${sectionHeights.tasks}px`,
            minHeight: '120px',
            transition: isResizing ? 'none' : 'height 0.2s ease-out'
          }}
        >
          <h3 className="section-title">Tasks</h3>
          <div 
            className="section-content clickable-area"
            onClick={handleTaskAreaClick}
            style={{ 
              overflowY: 'auto', 
              maxHeight: `${sectionHeights.tasks - 60}px`
            }}
          >
            {isLoading && regularTasks.length === 0 ? (
              <div className="loading-message">Loading tasks...</div>
            ) : (
              <>
                {regularTasks.length > 0 && (
                  <ul className="task-list">
                    {regularTasks.map((task) => (
                      <li 
                        key={task.id} 
                        className={`task-item ${deletingTasks.has(task.id || '') ? 'deleting' : ''}`}
                        style={{
                          opacity: deletingTasks.has(task.id || '') ? 0.5 : 1,
                          transition: 'opacity 0.3s ease'
                        }}
                      >
                        <label className="task-label">
                          <input
                            type="checkbox"
                            onChange={() => task.id && handleTaskComplete(task.id)}
                            className="task-checkbox"
                            disabled={deletingTasks.has(task.id || '')}
                          />
                          <span 
                            className="task-text"
                            style={{
                              color: 'var(--foreground, #000)',
                              fontSize: '14px',
                              lineHeight: '1.4'
                            }}
                          >
                            {task.event}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                
                {isAddingTask ? (
                  <form onSubmit={handleCreateTask} className="task-form">
                    <input
                      type="text"
                      ref={taskInputRef}
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      placeholder="Enter new task..."
                      className="task-input"
                      disabled={isCreatingTask}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                    <div className="task-form-buttons" style={{ marginTop: '8px' }}>
                      <button 
                        type="submit" 
                        className="btn btn-save"
                        disabled={isCreatingTask || !newTaskText.trim()}
                        style={{
                          padding: '6px 12px',
                          marginRight: '8px',
                          backgroundColor: isCreatingTask ? '#ccc' : '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isCreatingTask ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isCreatingTask ? 'Saving...' : 'Save'}
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-cancel"
                        onClick={handleCancelTask}
                        disabled={isCreatingTask}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isCreatingTask ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    {localError && (
                      <div className="error-message" style={{ 
                        color: 'red', 
                        fontSize: '12px', 
                        marginTop: '4px' 
                      }}>
                        {localError}
                      </div>
                    )}
                  </form>
                ) : (
                  <div className="empty-state" style={{ 
                    padding: '20px', 
                    textAlign: 'center', 
                    color: '#666',
                    cursor: 'pointer'
                  }}>
                    Click here to add tasks
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </aside>

      <main className="app-content">
        {eventError && (
          <div className="error-message" style={{ margin: '20px', color: 'red' }}>
            {eventError}
          </div>
        )}
      </main>
    </div>
  );
};

export default Sidebar;