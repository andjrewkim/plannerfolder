import React, { useEffect, useState, useRef, useCallback } from 'react';
import EventForm from './EventForm'; // Import your EventForm component
import '../styles/container.css';
import { authAPI } from '../../lib/auth';

// Import the EventData interface from EventForm
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
  color: string;
}

interface TodoTask {
  id: number;
  event: string;
  date: string | null;
}

interface SidebarProps {
  onEventChange?: () => void;
}

// Key for storing the last reset date in local storage
const LAST_RESET_KEY = 'tasks_last_reset_date';

const Sidebar: React.FC<SidebarProps> = ({ onEventChange }) => {
  const [todayEvents, setTodayEvents] = useState<APIEvent[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingTasks, setDeletingTasks] = useState<number[]>([]);

  // State for regular task creation
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const taskInputRef = useRef<HTMLInputElement>(null);
  
  // State for EventForm results
  const [eventResults, setEventResults] = useState<EventData[]>([]);
  const [eventError, setEventError] = useState<string | null>(null);
  
  // Store section heights with updated values
  const [sectionHeights, setSectionHeights] = useState({
    eventForm: 250,
    schedule: 350,
    tasks: 350
  });
  
  // Track active resize section and use refs for smooth resizing
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  
  // Use refs for resizing to avoid re-renders
  const heightsRef = useRef(sectionHeights);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const activeSectionRef = useRef<string | null>(null);
  const totalHeightRef = useRef(0);
  
  // Calculate total available height once on mount
  useEffect(() => {
    totalHeightRef.current = 900; // Default value, adjust based on your sidebar height
    heightsRef.current = sectionHeights;
  }, [sectionHeights]);
  
  // Update ref when state changes
  useEffect(() => {
    heightsRef.current = sectionHeights;
  }, [sectionHeights]);

  // Focus input when adding a new task
  useEffect(() => {
    if (isAddingTask && taskInputRef.current) {
      taskInputRef.current.focus();
    }
  }, [isAddingTask]);

  // Enhanced fetchTodayEvents function with better error handling
  const fetchTodayEvents = useCallback(async () => {
    console.log('Fetching today events...');
    try {
      // Check if user is authenticated first
      if (!authAPI.isAuthenticated()) {
        setError('Please log in to view your events');
        return;
      }

      const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/`);

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to view your events');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Get today's date in local timezone (YYYY-MM-DD format)
      const today = new Date();
      const todayString = today.getFullYear() + '-' + 
                        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(today.getDate()).padStart(2, '0');
      
      const filteredEvents = data.filter((event: APIEvent) => {
        // Extract just the date part from the event date
        const eventDateString = event.date.split('T')[0];
        return eventDateString === todayString;
      });

      console.log('Today events fetched successfully:', filteredEvents);
      setTodayEvents(filteredEvents);
      setError(null);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Failed to load events');
    }
  }, []);

  // Enhanced fetchTasks function with better error handling
  const fetchTasks = useCallback(async () => {
    console.log('Fetching tasks...');
    try {
      // Check if user is authenticated first
      if (!authAPI.isAuthenticated()) {
        setError('Please log in to view your tasks');
        return;
      }

      const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks/`);

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to view your tasks');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Only get regular tasks (no date or not "longterm")
      const regular: TodoTask[] = data.filter((task: TodoTask) => 
        !task.date || task.date !== "longterm"
      );

      console.log('Tasks fetched successfully:', regular);
      setTasks(regular);
      setError(null);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to load tasks');
    }
  }, []);

  // Centralized refresh function for all data
  const refreshAllData = useCallback(async () => {
    console.log('Refreshing all sidebar data...');
    if (authAPI.isAuthenticated()) {
      try {
        await Promise.all([
          fetchTodayEvents(),
          fetchTasks()
        ]);
        
        // Notify parent component to refresh calendar
        if (onEventChange) {
          onEventChange();
        }
        
        console.log('All sidebar data refreshed successfully');
      } catch (error) {
        console.error('Error refreshing data:', error);
      }
    }
  }, [fetchTodayEvents, fetchTasks, onEventChange]);

  // Enhanced event result handler with proper refresh timing
  const handleEventResult = async (results: EventData[]) => {
    console.log('Event created, refreshing sidebar...');
    setEventResults(results);
    
    // Add a delay to ensure the API has processed the new event
    setTimeout(async () => {
      await refreshAllData();
    }, 500);
  };

  // Handle click on tasks area to initiate task creation
  const handleTaskAreaClick = (e: React.MouseEvent) => {
    // Only activate if clicking directly on the section content (not on task items)
    if ((e.target as HTMLElement).className === 'section-content' || 
        (e.target as HTMLElement).className === 'empty-state' ||
        (e.target as HTMLElement).className === 'clickable-area') {
      setIsAddingTask(true);
    }
  };

  // Function to reset daily tasks using authAPI
  const resetDailyTasks = useCallback(async () => {
    try {
      // Check if user is authenticated first
      if (!authAPI.isAuthenticated()) {
        setError('Please log in to manage your tasks');
        return;
      }

      // Get all current tasks first
      const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks/`);

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to manage your tasks');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const tasks = await response.json();
      
      // Filter for regular (non-dated) tasks that need to be reset
      const regularTasks = tasks.filter((task: TodoTask) => !task.date || task.date !== "longterm");
      
      // Delete all regular tasks
      for (const task of regularTasks) {
        await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks/${task.id}/`, {
          method: 'DELETE'
        });
      }

      // Recreate all regular tasks
      for (const task of regularTasks) {
        await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks/`, {
          method: 'POST',
          body: JSON.stringify({
            event: task.event,
            date: null
          })
        });
      }

      // Refresh tasks after reset
      await fetchTasks(); // Use fetchTasks instead of refreshAllData to avoid circular dependency
      
    } catch (error) {
      console.error('Error resetting tasks:', error);
      setError('Failed to reset tasks');
    }
  }, [fetchTasks]); // Only depend on fetchTasks

  // Function to check if tasks should be reset
  const checkAndResetTasks = useCallback(async () => {
    // Only proceed if authenticated
    if (!authAPI.isAuthenticated()) {
      return;
    }

    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const lastResetDate = localStorage.getItem(LAST_RESET_KEY);

    // If the last reset date is different from today, reset all tasks
    if (lastResetDate !== todayFormatted) {
      console.log('New day detected. Resetting daily tasks...');
      await resetDailyTasks();
      // Update the last reset date
      localStorage.setItem(LAST_RESET_KEY, todayFormatted);
    }
  }, [resetDailyTasks]);

  // Enhanced task creation with proper refresh
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTaskText.trim()) {
      return; // Don't create empty tasks
    }
    
    try {
      // Check if user is authenticated first
      if (!authAPI.isAuthenticated()) {
        setError('Please log in to create tasks');
        return;
      }

      console.log('Creating new task:', newTaskText);
      const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks/`, {
        method: 'POST',
        body: JSON.stringify({
          event: newTaskText,
          date: null // Regular tasks have no date
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to create tasks');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Reset form
      setNewTaskText('');
      
      // Refresh all sidebar data
      await refreshAllData();
      
      // Refocus the input for continuous adding
      if (taskInputRef.current) {
        taskInputRef.current.focus();
      }
      
      console.log('Task created and sidebar refreshed');
    } catch (error) {
      console.error('Error creating task:', error);
      setError('Failed to create task');
    }
  };

  // Cancel regular task creation
  const handleCancelTask = () => {
    setIsAddingTask(false);
    setNewTaskText('');
  };

  // Improved resize function with throttling and constraints
  const startResize = (section: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    
    setActiveSection(section);
    setIsResizing(true);
    
    activeSectionRef.current = section;
    startYRef.current = e.clientY;
    startHeightRef.current = heightsRef.current[section as keyof typeof sectionHeights];
    
    // Track adjacent section (only eventForm and schedule have resize handles)
    const sections = ['eventForm', 'schedule', 'tasks'];
    const sectionIndex = sections.indexOf(section);
    const nextSectionIndex = sectionIndex + 1;
    const nextSection = nextSectionIndex < sections.length ? sections[nextSectionIndex] : null;
    
    // Show resizing cursor
    document.body.classList.add('resizing');
    
    let lastUpdateTime = 0;
    const THROTTLE_MS = 16; // Roughly 60fps
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const now = Date.now();
      
      // Throttle updates to avoid excessive re-renders
      if (now - lastUpdateTime < THROTTLE_MS) return;
      lastUpdateTime = now;
      
      const delta = moveEvent.clientY - startYRef.current;
      
      // Calculate new heights with constraints
      let newSectionHeight = Math.max(120, startHeightRef.current + delta);
      
      // If next section exists, adjust its height to compensate
      if (nextSection) {
        const nextSectionStartHeight = heightsRef.current[nextSection as keyof typeof sectionHeights];
        const nextSectionNewHeight = Math.max(120, nextSectionStartHeight - delta);
        
        // Ensure next section doesn't go below minimum
        if (nextSectionNewHeight < 120) {
          newSectionHeight = startHeightRef.current + (nextSectionStartHeight - 120);
        }
        
        // Apply changes using refs for smooth tracking
        const newHeights = {
          ...heightsRef.current,
          [section]: newSectionHeight,
          [nextSection]: heightsRef.current[nextSection as keyof typeof sectionHeights] - 
                        (newSectionHeight - heightsRef.current[section as keyof typeof sectionHeights])
        };
        
        // Update ref directly for responsive movement
        heightsRef.current = newHeights;
        
        // Update DOM directly for smoother animation
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
      
      // Update React state once at the end for proper rendering
      setSectionHeights({...heightsRef.current});
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Enhanced task completion with animation and refresh
  const handleTaskComplete = async (taskId: number) => {
    setDeletingTasks(prev => [...prev, taskId]);
    
    // Add delay before deletion to allow animation to play
    setTimeout(async () => {
      try {
        // Check if user is authenticated first
        if (!authAPI.isAuthenticated()) {
          setError('Please log in to manage tasks');
          setDeletingTasks(prev => prev.filter(id => id !== taskId));
          return;
        }

        console.log('Completing task:', taskId);
        const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks/${taskId}/`, {
          method: 'DELETE'
        });

        if (response.ok) {
          await refreshAllData();
          console.log('Task completed and sidebar refreshed');
        } else {
          if (response.status === 401) {
            setError('Please log in to manage tasks');
            return;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.error('Error deleting task:', error);
        setError('Failed to delete task');
      } finally {
        setDeletingTasks(prev => prev.filter(id => id !== taskId));
      }
    }, 400); // Delay to match animation duration
  };

  const formatEventTime = (date: string, time: string): string => {
    return new Date(`${date.split('T')[0]}T${time}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Initial data fetch effect - runs only once when component mounts
  useEffect(() => {
    if (authAPI.isAuthenticated()) {
      refreshAllData();
      checkAndResetTasks();
    } else {
      setTodayEvents([]);
      setTasks([]);
      setError('Please log in to access your data');
    }
  }, []); // Run only once on mount

  // Separate effect for the reset timer to avoid recreation
  useEffect(() => {
    if (!authAPI.isAuthenticated()) return;

    const resetTimer = setInterval(() => {
      checkAndResetTasks();
    }, 60 * 60 * 1000); // Check every hour for date changes

    return () => {
      clearInterval(resetTimer);
    };
  }, []); // Run only once on mount

  // Cleanup effect for resizing
  useEffect(() => {
    return () => {
      document.body.classList.remove('resizing');
    };
  }, []);

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
            <div>
              <EventForm 
                setResult={setEventResults} 
                setError={setEventError}
                onEventResult={handleEventResult}
              />
            </div>
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
          <h3 className="section-title">Today&apos;s Schedule</h3>
          <div className="section-content" style={{ overflowY: 'auto', maxHeight: `${sectionHeights.schedule - 60}px` }}>
            {error ? (
              <div className="error-message">{error}</div>
            ) : todayEvents.length > 0 ? (
              <ul className="event-list">
                {todayEvents.map(event => (
                  <li
                    key={event.id}
                    className="event-item"
                    style={{
                      '--event-color': event.color
                    } as React.CSSProperties}
                  >
                    <span className="event-name">{event.event_name}</span>
                    <span className="event-time">
                      {formatEventTime(event.date, event.start_time)}
                    </span>
                  </li>
                ))}
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
            {tasks.length > 0 && (
              <ul className="task-list">
                {tasks.map((task) => (
                  <li 
                    key={task.id} 
                    className={`task-item ${deletingTasks.includes(task.id) ? 'deleting' : ''}`}
                  >
                    <label className="task-label">
                      <input
                        type="checkbox"
                        onChange={() => handleTaskComplete(task.id)}
                        className="task-checkbox"
                      />
                      <span className="task-text">{task.event}</span>
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
                />
                <div className="task-form-buttons">
                  <button type="submit" className="btn btn-save">Save</button>
                  <button 
                    type="button" 
                    className="btn btn-cancel"
                    onClick={handleCancelTask}
                  >
                    Close
                  </button>
                </div>
              </form>
            ) : (
              <div className="empty-state">Click here to add tasks</div>
            )}
          </div>
        </section>
      </aside>

      <main className="app-content">
        {/* Your main content goes here */}
        {eventError && (
          <div className="error-message" style={{ margin: '20px' }}>
            {eventError}
          </div>
        )}
      </main>
    </div>
  );
};

export default Sidebar;