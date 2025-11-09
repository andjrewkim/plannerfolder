// Sidebar.tsx - Fixed date handling
import React, { useEffect, useState, useRef, useCallback } from 'react';
import FriendList from '../components/Friends/FriendList';
import '../styles/container.css';
import { authAPI } from '../../lib/auth';
import { useAppState, EventDetails, TaskData } from '../hooks/useAppState';
import BellSchedule from './BellSchedule';
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

const LAST_RESET_KEY = 'tasks_last_reset_date';
const VIEW_PREFERENCE_KEY = 'sidebar_view_preference';

// Helper function to get today's date in local timezone (YYYY-MM-DD)
const getTodayLocal = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

  // View toggle state - default to tasks
  const [activeView, setActiveView] = useState<'bell' | 'tasks'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(VIEW_PREFERENCE_KEY);
      return (saved === 'tasks' || saved === 'bell') ? saved : 'tasks';
    }
    return 'tasks';
  });

  // Save view preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(VIEW_PREFERENCE_KEY, activeView);
    }
  }, [activeView]);

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
      } finally {
        refreshInProgressRef.current = false;
      }
    }, 500),
    [initializeData]
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

  // Reset timer effect with proper cleanup and FIXED DATE HANDLING
  useEffect(() => {
    if (!authAPI.isAuthenticated() || !initialized) return;

    const performCheck = async () => {
      if (isResettingTasks || !isMountedRef.current) return;
      
      // ✅ FIXED: Use local timezone instead of UTC
      const todayFormatted = getTodayLocal();
      const lastResetDate = localStorage.getItem(LAST_RESET_KEY);

      console.log('Checking reset - Today:', todayFormatted, 'Last reset:', lastResetDate);

      if (lastResetDate !== todayFormatted) {
        console.log('New day detected, resetting tasks...');
        
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

    performCheck();
    
    resetTimerRef.current = setInterval(performCheck, 60 * 60 * 1000);

    return () => {
      if (resetTimerRef.current) {
        clearInterval(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [initialized, tasks, createTask, deleteTask, isResettingTasks]);

  // Filter regular tasks
  const regularTasks = tasks.filter((task: TaskData) => 
    !task.date || task.date !== "longterm"
  );

  // Determine error to display
  const displayError = localError || error || plannerError;

  return (
    <div className="app-layout">
      <aside
        className="app-sidebar bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
        style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'auto' }}
      >
<section style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', marginTop: '10px', overflow: 'hidden' }}>
  <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
    {activeView === 'bell' ? 'Bell Schedule' : 'Tasks'}
    {activeView === 'tasks' && isResettingTasks && (
      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#007bff', fontWeight: 'normal' }}>
        (Resetting...)
      </span>
    )}
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', color: 'hsl(var(--muted-foreground))', fontWeight: '400' }}>
      {activeView === 'bell' ? 'GHCHS Bell Schedule' : 'See Bell Schedule'}
      <button 
        onClick={() => setActiveView(activeView === 'bell' ? 'tasks' : 'bell')}
        title={activeView === 'bell' ? 'Switch to Tasks' : 'Switch to Bell Schedule'}
        style={{ 
          background: 'none', 
          border: 'none', 
          cursor: 'pointer', 
          padding: '2px',
          display: 'flex',
          color: 'hsl(var(--muted-foreground))'
        }}
      >
        {activeView === 'bell' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        )}
      </button>
    </span>
  </h3>
  <div className="section-content" style={{ padding: 0, display: activeView === 'bell' ? 'block' : 'none', flex: 1, overflow: 'auto' }}>
    <BellSchedule />
  </div>
  
  <div 
    className="section-content clickable-area"
    onClick={handleTaskAreaClick}
    style={{ flex: 1, overflow: 'auto', display: activeView === 'tasks' ? 'flex' : 'none', flexDirection: 'column' }}
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
                  <span className="task-text">
                    {task.event}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        
        {isAddingTask ? (
          <div className="task-form">
            <input
              type="text"
              ref={taskInputRef}
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateTask(e as any);
                }
              }}
              placeholder="Enter new task..."
              className="task-input"
              disabled={isCreatingTask || isResettingTasks}
            />
            <div className="task-form-buttons" style={{ marginTop: '8px' }}>
              <button 
                type="button"
                onClick={(e) => handleCreateTask(e as any)}
                className="btn btn-save"
                disabled={isCreatingTask || !newTaskText.trim() || isResettingTasks}
              >
                {isCreatingTask ? 'Saving...' : 'Save'}
              </button>
              <button 
                type="button" 
                className="btn btn-cancel"
                onClick={handleCancelTask}
                disabled={isCreatingTask || isResettingTasks}
              >
                Cancel
              </button>
            </div>
            {localError && (
              <div className="error-message">
                {localError}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
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
</section>


        <section style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', marginTop: '8px', overflow: 'hidden' }}>
          <h3 className="section-title" style={{ flexShrink: 0 }}>Friends</h3>
          <div className="section-content" style={{ flex: 1, overflow: 'auto' }}>
            <FriendList />
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