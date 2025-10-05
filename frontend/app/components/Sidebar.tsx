// Sidebar.tsx - Modified to display tasks instead of today's schedule
import React, { useEffect, useState, useRef, useCallback } from 'react';
import EventForm from './EventForm';
import '../styles/container.css';
import { authAPI } from '../../lib/auth';
import { useAppState, EventDetails, TaskData } from '../hooks/useAppState';
import { usePlanner, PlannerClass } from '../hooks/usePlanner';

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

interface SidebarProps {
  onEventChange?: () => void;
  refreshTrigger?: number;
}

interface SectionHeights {
  eventForm: number;
  tasks: number;
  classes: number;
}

const LAST_RESET_KEY = 'tasks_last_reset_date';

// Debounce utility function
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

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

  const {
    classes,
    isLoading: plannerLoading,
    error: plannerError,
    initialized: plannerInitialized
  } = usePlanner();

  // Local state
  const [localError, setLocalError] = useState<string | null>(null);
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set());
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);
  const [newTaskText, setNewTaskText] = useState<string>('');
  const [eventResults, setEventResults] = useState<EventData[]>([]);
  const [eventError, setEventError] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);
  const [isResettingTasks, setIsResettingTasks] = useState<boolean>(false);
  
  // Refs
  const taskInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef<boolean>(true);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshInProgressRef = useRef<boolean>(false);

  // Section heights for resizing
  const [sectionHeights, setSectionHeights] = useState<SectionHeights>({
    eventForm: 250,
    tasks: 350,
    classes: 350
  });
  
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const heightsRef = useRef<SectionHeights>(sectionHeights);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (resetTimerRef.current) {
        clearInterval(resetTimerRef.current);
      }
    };
  }, []);

  // Debounced refresh function
  const debouncedRefresh = useCallback(
    debounce(async () => {
      if (refreshInProgressRef.current || !isMountedRef.current) return;
      
      refreshInProgressRef.current = true;
      try {
        await initializeData();
        // REMOVED: onEventChange() call - don't trigger parent refresh
      } finally {
        refreshInProgressRef.current = false;
      }
    }, 500),
    [initializeData]  // Also removed onEventChange from dependencies
  );

  // Handle refresh trigger with debouncing
  useEffect(() => {
    if (!isMountedRef.current || !refreshTrigger || refreshTrigger <= 0) return;

    console.log('Refresh trigger activated:', refreshTrigger);
    debouncedRefresh();
  }, [refreshTrigger, debouncedRefresh]);

  // Focus input when adding task
  useEffect(() => {
    if (isAddingTask && taskInputRef.current && isMountedRef.current) {
      taskInputRef.current.focus();
    }
  }, [isAddingTask]);

  // Event result handler with debouncing
  const handleEventResult = useCallback(async (results: EventData[]) => {
    if (!isMountedRef.current) return;

    console.log('Event created, refreshing data...');
    setEventResults(results);
    debouncedRefresh();
  }, [debouncedRefresh]);

  // Task area click handler
  const handleTaskAreaClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMountedRef.current || isCreatingTask) return;

    const target = e.target as HTMLElement;
    const clickableClasses = ['section-content', 'empty-state', 'clickable-area'];
    
    if (clickableClasses.includes(target.className)) {
      setIsAddingTask(true);
      setLocalError(null);
    }
  }, [isCreatingTask]);

  // Reset daily tasks with proper guards
  const resetDailyTasks = useCallback(async (): Promise<void> => {
    if (isResettingTasks || !isMountedRef.current || !authAPI.isAuthenticated()) {
      console.log('Reset blocked - already in progress or not authenticated');
      return;
    }

    setIsResettingTasks(true);
    console.log('Starting daily task reset...');

    try {
      const regularTasks = tasks.filter((task: TaskData) => 
        !task.date || task.date !== "longterm"
      );
      
      console.log(`Found ${regularTasks.length} regular tasks to reset`);

      const tasksToRecreate = regularTasks.map((task: TaskData) => ({
        event: task.event,
        date: null as null
      }));

      const deletePromises = regularTasks
        .filter((task: TaskData) => task.id)
        .map(async (task: TaskData) => {
          if (!isMountedRef.current) return false;
          try {
            console.log('Deleting task:', task.event);
            return await deleteTask(task.id!);
          } catch (error) {
            console.error('Error deleting task:', task.id, error);
            return false;
          }
        });

      await Promise.all(deletePromises);
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!isMountedRef.current) return;

      const createPromises = tasksToRecreate.map(async (taskData) => {
        if (!isMountedRef.current) return null;
        try {
          console.log('Recreating task:', taskData.event);
          return await createTask(taskData);
        } catch (error) {
          console.error('Error recreating task:', taskData.event, error);
          return null;
        }
      });

      await Promise.all(createPromises);
      console.log('Daily tasks reset completed successfully');
    } catch (error) {
      console.error('Error during task reset:', error);
      if (isMountedRef.current) {
        setLocalError('Failed to reset daily tasks');
      }
    } finally {
      if (isMountedRef.current) {
        setIsResettingTasks(false);
      }
    }
  }, [tasks, deleteTask, createTask, isResettingTasks]);

  // Check and reset tasks with proper date handling
  const checkAndResetTasks = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current || !authAPI.isAuthenticated() || !initialized || isResettingTasks) {
      return;
    }

    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0];
    const lastResetDate = localStorage.getItem(LAST_RESET_KEY);

    console.log('Checking reset - Today:', todayFormatted, 'Last reset:', lastResetDate);

    if (lastResetDate !== todayFormatted) {
      console.log('New day detected, resetting tasks...');
      await resetDailyTasks();
      
      if (isMountedRef.current) {
        localStorage.setItem(LAST_RESET_KEY, todayFormatted);
      }
    }
  }, [resetDailyTasks, initialized, isResettingTasks]);

  // Create task handler with better validation
  const handleCreateTask = useCallback(async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
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
      const taskData = {
        event: trimmedText,
        date: null as null
      };

      const newTask = await createTask(taskData);

      if (newTask && isMountedRef.current) {
        console.log('Task created successfully:', newTask);
        setNewTaskText('');
        
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
        const errorMessage = error instanceof Error ? error.message : 'unknown error';
        setLocalError(`Failed to create task: ${errorMessage}`);
      }
    } finally {
      if (isMountedRef.current) {
        setIsCreatingTask(false);
      }
    }
  }, [newTaskText, createTask, isCreatingTask]);

  // Cancel task creation
  const handleCancelTask = useCallback((): void => {
    if (!isMountedRef.current) return;
    
    setIsAddingTask(false);
    setNewTaskText('');
    setLocalError(null);
  }, []);

  // Task completion handler
  const handleTaskComplete = useCallback(async (taskId: string): Promise<void> => {
    if (!isMountedRef.current || deletingTasks.has(taskId)) return;
    
    if (!authAPI.isAuthenticated()) {
      setLocalError('Please log in to manage tasks');
      return;
    }

    setDeletingTasks(prev => new Set([...Array.from(prev), taskId]));
    
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

  // Resize handlers
  const startResize = useCallback((section: string) => (e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    
    setActiveSection(section);
    setIsResizing(true);
    
    startYRef.current = e.clientY;
    startHeightRef.current = heightsRef.current[section as keyof SectionHeights];
    
    const sections = ['eventForm', 'tasks', 'classes'];
    const sectionIndex = sections.indexOf(section);
    const nextSectionIndex = sectionIndex + 1;
    const nextSection = nextSectionIndex < sections.length ? sections[nextSectionIndex] : null;
    
    document.body.classList.add('resizing');
    
    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const delta = moveEvent.clientY - startYRef.current;
      let newSectionHeight = Math.max(120, startHeightRef.current + delta);
      
      if (nextSection) {
        const nextSectionStartHeight = heightsRef.current[nextSection as keyof SectionHeights];
        const nextSectionNewHeight = Math.max(120, nextSectionStartHeight - delta);
        
        if (nextSectionNewHeight < 120) {
          newSectionHeight = startHeightRef.current + (nextSectionStartHeight - 120);
        }
        
        const newHeights = {
          ...heightsRef.current,
          [section]: newSectionHeight,
          [nextSection]: heightsRef.current[nextSection as keyof SectionHeights] - 
                        (newSectionHeight - heightsRef.current[section as keyof SectionHeights])
        };
        
        heightsRef.current = newHeights;
        
        const currentSection = document.querySelector(`.sidebar-section[data-section="${section}"]`) as HTMLElement;
        const nextSectionEl = document.querySelector(`.sidebar-section[data-section="${nextSection}"]`) as HTMLElement;
        
        if (currentSection && nextSectionEl) {
          currentSection.setAttribute('style', `height: ${newSectionHeight}px; min-height: 120px;`);
          nextSectionEl.setAttribute('style', `height: ${newHeights[nextSection as keyof typeof newHeights]}px; min-height: 120px;`);
        }
      }
    };
    
    const handleMouseUp = (): void => {
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

  // Calculate dynamic sizing to fit all classes without scrolling
  const calculateClassDimensions = useCallback((containerHeight: number, classCount: number) => {
    if (classCount === 0) return { padding: '4px 6px', fontSize: '14px' };
    
    const availableHeight = containerHeight - 8;
    const heightPerClass = availableHeight / classCount;
    const minContentHeight = 16;
    const availablePaddingHeight = Math.max(0, heightPerClass - minContentHeight);
    const verticalPadding = Math.max(1, Math.floor(availablePaddingHeight / 2));
    
    let fontSize = 14;
    if (heightPerClass < 20) fontSize = 12;
    else if (heightPerClass < 24) fontSize = 13;
    else if (heightPerClass > 40) fontSize = 15;
    
    return {
      padding: `${verticalPadding}px 6px`,
      fontSize: `${fontSize}px`
    };
  }, []);

  // Reset timer effect with proper cleanup - FIXED to prevent infinite loops
  useEffect(() => {
    if (!authAPI.isAuthenticated() || !initialized) return;

    const performCheck = async () => {
      if (isResettingTasks || !isMountedRef.current) return;
      
      const today = new Date();
      const todayFormatted = today.toISOString().split('T')[0];
      const lastResetDate = localStorage.getItem(LAST_RESET_KEY);

      console.log('Checking reset - Today:', todayFormatted, 'Last reset:', lastResetDate);

      if (lastResetDate !== todayFormatted) {
        console.log('New day detected, resetting tasks...');
        
        // Inline the reset logic to avoid callback dependencies
        setIsResettingTasks(true);
        
        try {
          const regularTasks = tasks.filter((task: TaskData) => 
            !task.date || task.date !== "longterm"
          );
          
          const tasksToRecreate = regularTasks.map((task: TaskData) => ({
            event: task.event,
            date: null as null
          }));

          const deletePromises = regularTasks
            .filter((task: TaskData) => task.id)
            .map(async (task: TaskData) => {
              if (!isMountedRef.current) return false;
              try {
                return await deleteTask(task.id!);
              } catch (error) {
                console.error('Error deleting task:', task.id, error);
                return false;
              }
            });

          await Promise.all(deletePromises);
          await new Promise(resolve => setTimeout(resolve, 500));

          if (!isMountedRef.current) return;

          const createPromises = tasksToRecreate.map(async (taskData) => {
            if (!isMountedRef.current) return null;
            try {
              return await createTask(taskData);
            } catch (error) {
              console.error('Error recreating task:', taskData.event, error);
              return null;
            }
          });

          await Promise.all(createPromises);
          
          if (isMountedRef.current) {
            localStorage.setItem(LAST_RESET_KEY, todayFormatted);
          }
        } catch (error) {
          console.error('Error during task reset:', error);
        } finally {
          if (isMountedRef.current) {
            setIsResettingTasks(false);
          }
        }
      }
    };

    if (resetTimerRef.current) {
      clearInterval(resetTimerRef.current);
    }

    // Run check once on mount/initialization
    performCheck();
    
    // Set up interval for periodic checks
    resetTimerRef.current = setInterval(performCheck, 60 * 60 * 1000);

    return () => {
      if (resetTimerRef.current) {
        clearInterval(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [initialized]); // Only depend on initialized - no task-related dependencies!

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

  // Filter regular tasks
  const regularTasks = tasks.filter((task: TaskData) => 
    !task.date || task.date !== "longterm"
  );

  // Determine error to display
  const displayError = localError || error || plannerError;

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

        {/* Tasks Section */}
        <section 
          className={`sidebar-section ${activeSection === 'tasks' ? 'resizing' : ''}`}
          data-section="tasks"
          style={{ 
            height: `${sectionHeights.tasks}px`,
            minHeight: '120px',
            transition: isResizing ? 'none' : 'height 0.2s ease-out'
          }}
        >
          <h3 className="section-title">
            Tasks
            {isResettingTasks && (
              <span style={{
                marginLeft: '8px',
                fontSize: '12px',
                color: '#007bff',
                fontWeight: 'normal'
              }}>
                (Resetting...)
              </span>
            )}
          </h3>
          <div 
            className="section-content clickable-area"
            onClick={handleTaskAreaClick}
            style={{ 
              overflowY: 'auto', 
              maxHeight: `${sectionHeights.tasks - 60}px`
            }}
          >
            {!initialized ? (
              <div className="loading-message"></div>
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
                            disabled={deletingTasks.has(task.id || '') || isResettingTasks}
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
                      disabled={isCreatingTask || isResettingTasks}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid hsl(var(--border)/0.5)',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                    <div className="task-form-buttons" style={{ marginTop: '8px' }}>
                      <button 
                        type="submit" 
                        className="btn btn-save"
                        disabled={isCreatingTask || !newTaskText.trim() || isResettingTasks}
                        style={{
                          padding: '6px 12px',
                          marginRight: '8px',
                          backgroundColor: (isCreatingTask || isResettingTasks) ? '#ccc' : '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: (isCreatingTask || isResettingTasks) ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isCreatingTask ? 'Saving...' : 'Save'}
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-cancel"
                        onClick={handleCancelTask}
                        disabled={isCreatingTask || isResettingTasks}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: (isCreatingTask || isResettingTasks) ? 'not-allowed' : 'pointer'
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
                    cursor: isResettingTasks ? 'not-allowed' : 'pointer',
                    opacity: isResettingTasks ? 0.5 : 1
                  }}>
                    {regularTasks.length === 0 ? (
                      isResettingTasks ? 'Resetting tasks...' : 'Click here to add tasks'
                    ) : (
                      isResettingTasks ? 'Resetting tasks...' : 'Click here to add more tasks'
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <div 
            className={`resize-handle ${activeSection === 'tasks' ? 'active' : ''}`}
            onMouseDown={startResize('tasks')}
          />
        </section>

        {/* Classes Section */}
        <section 
          className="sidebar-section"
          data-section="classes"
          style={{ 
            height: `${sectionHeights.classes}px`,
            minHeight: '120px',
            transition: isResizing ? 'none' : 'height 0.2s ease-out'
          }}
        >
          <h3 className="section-title">My Classes</h3>
          <div 
            className="section-content"
            style={{ 
              height: `${sectionHeights.classes - 60}px`,
              padding: '4px 8px 4px 8px',
              overflow: 'hidden'
            }}
          >
            {plannerLoading ? (
              <div className="loading-message"></div>
            ) : plannerError ? (
              <div></div>
            ) : !plannerInitialized ? (
              <div className="loading-message"></div>
            ) : classes && classes.length > 0 ? (
              <div className="classes-list" style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
                height: '100%'
              }}>
                {classes
                  .sort((a, b) => a.order - b.order)
                  .map((plannerClass: PlannerClass, index) => {
                    const dimensions = calculateClassDimensions(sectionHeights.classes - 68, classes.length);
                    
                    return (
                      <div
                        key={plannerClass.id}
                        className="class-item"
                        style={{
                          padding: dimensions.padding,
                          backgroundColor: 'var(--muted, #f8f9fa)',
                          borderRadius: '3px',
                          color: 'var(--foreground, #000)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'background-color 0.1s ease',
                          flex: 1,
                          minHeight: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--accent, #e9ecef)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--muted, #f8f9fa)';
                        }}
                      >
                        <span 
                          className="class-number"
                          style={{
                            fontSize: dimensions.fontSize === '15px' ? '13px' : 
                                     dimensions.fontSize === '14px' ? '12px' : 
                                     dimensions.fontSize === '13px' ? '11px' : '10px',
                            color: 'var(--muted-foreground, #6c757d)',
                            fontWeight: '600',
                            minWidth: '12px',
                            textAlign: 'center'
                          }}
                        >
                          {index + 1}
                        </span>
                        <span 
                          className="class-name"
                          style={{
                            fontSize: dimensions.fontSize,
                            fontWeight: '500',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            lineHeight: '1.2'
                          }}
                        >
                          {plannerClass.name}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="empty-state" style={{ 
                padding: '8px 6px', 
                textAlign: 'center', 
                color: '#999',
                fontSize: '12px'
              }}>
                No classes
              </div>
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
}

export default Sidebar;