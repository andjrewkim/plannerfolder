import React, { useEffect, useState, useRef, useCallback } from 'react';
import '../styles/container.css';
import { authAPI } from '../../lib/auth'; // Import the auth service

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

// Key for storing the last reset date in local storage
const LAST_RESET_KEY = 'tasks_last_reset_date';

const Sidebar: React.FC = () => {
  const [todayEvents, setTodayEvents] = useState<APIEvent[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [longTermTasks, setLongTermTasks] = useState<TodoTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingTasks, setDeletingTasks] = useState<number[]>([]);
  
  // State for regular task creation
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const taskInputRef = useRef<HTMLInputElement>(null);
  
  // State for long-term task creation
  const [isAddingLongTerm, setIsAddingLongTerm] = useState(false);
  const [newLongTermText, setNewLongTermText] = useState('');
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  
  // Store section heights with default values
  const [sectionHeights, setSectionHeights] = useState({
    schedule: 300,
    tasks: 300,
    longTerm: 300
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

  // Focus input when adding a new long-term task
  useEffect(() => {
    if (isAddingLongTerm && newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  }, [isAddingLongTerm]);

  // Handle click on tasks area to initiate task creation
  const handleTaskAreaClick = (e: React.MouseEvent) => {
    // Only activate if clicking directly on the section content (not on task items)
    if ((e.target as HTMLElement).className === 'section-content' || 
        (e.target as HTMLElement).className === 'empty-state' ||
        (e.target as HTMLElement).className === 'clickable-area') {
      setIsAddingTask(true);
    }
  };

  // Handle click on long-term tasks area to initiate task creation
  const handleLongTermAreaClick = (e: React.MouseEvent) => {
    // Only activate if clicking directly on the section content (not on task items)
    if ((e.target as HTMLElement).className === 'section-content' || 
        (e.target as HTMLElement).className === 'empty-state' ||
        (e.target as HTMLElement).className === 'clickable-area') {
      setIsAddingLongTerm(true);
    }
  };

  // Fetch tasks function using authAPI
  const fetchTasks = useCallback(async () => {
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
      
      const regular: TodoTask[] = [];
      const longTerm: TodoTask[] = [];
      
      data.forEach((task: TodoTask) => {
        // Consider tasks with "longterm" marker as long term goals
        if (task.date === "longterm") {
          longTerm.push(task);
        } else if (!task.date) {
          regular.push(task);
        }
      });

      setTasks(regular);
      setLongTermTasks(longTerm);
      setError(null);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to load tasks');
    }
  }, []);

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
      const regularTasks = tasks.filter((task: TodoTask) => !task.date);
      
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
      fetchTasks();
      
    } catch (error) {
      console.error('Error resetting tasks:', error);
      setError('Failed to reset tasks');
    }
  }, [fetchTasks]);

  // Function to check if tasks should be reset wrapped in useCallback
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

  // Updated fetchTodayEvents function with better date handling
  const fetchTodayEvents = useCallback(async () => {
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
      
      console.log('Today string:', todayString); // Debug log
      console.log('Events data:', data); // Debug log
      
      const filteredEvents = data.filter((event: APIEvent) => {
        // Extract just the date part from the event date
        const eventDateString = event.date.split('T')[0];
        console.log('Event date string:', eventDateString, 'vs today:', todayString); // Debug log
        return eventDateString === todayString;
      });

      console.log('Filtered events:', filteredEvents); // Debug log
      setTodayEvents(filteredEvents);
      setError(null);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Failed to load events');
    }
  }, []);

  // Handle regular task creation using authAPI
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
      
      // Reset only the text, keep the form open
      setNewTaskText('');
      // Don't set isAddingTask to false - keep the form open
      
      // Refresh tasks
      await fetchTasks();
      
      // Refocus the input for continuous adding
      if (taskInputRef.current) {
        taskInputRef.current.focus();
      }
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

  // Handle long term goal creation using authAPI
  const handleCreateLongTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newLongTermText.trim()) {
      return; // Don't create empty tasks
    }
    
    try {
      // Check if user is authenticated first
      if (!authAPI.isAuthenticated()) {
        setError('Please log in to create tasks');
        return;
      }

      // For long-term goals, we'll use a special marker in the database
      // We'll set date to "longterm" string which our API can interpret
      const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks/`, {
        method: 'POST',
        body: JSON.stringify({
          event: newLongTermText,
          date: "longterm" // Special marker for long-term goals without dates
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to create tasks');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Reset only the text, keep the form open
      setNewLongTermText('');
      // Don't set isAddingLongTerm to false - keep the form open
      
      // Refresh tasks
      await fetchTasks();
      
      // Refocus the input for continuous adding
      if (newTaskInputRef.current) {
        newTaskInputRef.current.focus();
      }
    } catch (error) {
      console.error('Error creating long-term goal:', error);
      setError('Failed to create long-term goal');
    }
  };

  // Cancel long-term task creation
  const handleCancelLongTerm = () => {
    setIsAddingLongTerm(false);
    setNewLongTermText('');
  };

  // Improved resize function with throttling and constraints
  const startResize = (section: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    
    setActiveSection(section);
    setIsResizing(true);
    
    activeSectionRef.current = section;
    startYRef.current = e.clientY;
    startHeightRef.current = heightsRef.current[section as keyof typeof sectionHeights];
    
    // Track adjacent section
    const sections = ['schedule', 'tasks', 'longTerm'];
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

  // Enhanced task completion with animation using authAPI
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

        const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks/${taskId}/`, {
          method: 'DELETE'
        });

        if (response.ok) {
          await fetchTasks();
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

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (authAPI.isAuthenticated()) {
      fetchTodayEvents();
      fetchTasks();
      
      // Check for daily reset when component loads
      checkAndResetTasks();
      
      // Set up a timer to check for date change (useful for when app is left open overnight)
      const timer = setInterval(() => {
        checkAndResetTasks();
      }, 60 * 60 * 1000); // Check every hour
      
      return () => {
        clearInterval(timer);
        document.body.classList.remove('resizing');
      };
    } else {
      // Clear data and show login message if not authenticated
      setTodayEvents([]);
      setTasks([]);
      setLongTermTasks([]);
      setError('Please log in to access your data');
    }

    return () => {
      document.body.classList.remove('resizing');
    };
  }, [checkAndResetTasks, fetchTasks, fetchTodayEvents]); // Now correctly referencing stable function references

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <section 
          className={`sidebar-section ${activeSection === 'schedule' ? 'resizing' : ''}`}
          data-section="schedule"
          style={{ 
            marginTop: '60px', 
            height: `${sectionHeights.schedule}px`,
            minHeight: '120px',
            transition: isResizing ? 'none' : 'height 0.2s ease-out'
          }}
        >
          <h3 className="section-title">Today&apos;s Schedule</h3>
          <div className="section-content">
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

        <section 
          className={`sidebar-section ${activeSection === 'tasks' ? 'resizing' : ''}`}
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
          >
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
                    Cancel
                  </button>
                </div>
              </form>
            ) : tasks.length > 0 ? (
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
            ) : (
              <div className="empty-state">Click here to add tasks</div>
            )}
            {isAddingTask && tasks.length > 0 && (
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
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
          <div 
            className={`resize-handle ${activeSection === 'tasks' ? 'active' : ''}`}
            onMouseDown={startResize('tasks')}
          />
        </section>

        <section 
          className={`sidebar-section ${activeSection === 'longTerm' ? 'resizing' : ''}`}
          data-section="longTerm"
          style={{ 
            height: `${sectionHeights.longTerm}px`,
            minHeight: '120px',
            transition: isResizing ? 'none' : 'height 0.2s ease-out'
          }}
        >
          <h3 className="section-title">Long-term Goals</h3>
          <div 
            className="section-content clickable-area"
            onClick={handleLongTermAreaClick}
          >
            {isAddingLongTerm ? (
              <form onSubmit={handleCreateLongTerm} className="task-form">
                <input
                  type="text"
                  ref={newTaskInputRef}
                  value={newLongTermText}
                  onChange={(e) => setNewLongTermText(e.target.value)}
                  placeholder="Enter new long-term goal..."
                  className="task-input"
                />
                <div className="task-form-buttons">
                  <button type="submit" className="btn btn-save">Save</button>
                  <button 
                    type="button" 
                    className="btn btn-cancel"
                    onClick={handleCancelLongTerm}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : longTermTasks.length > 0 ? (
              <ul className="task-list">
                {longTermTasks.map((task) => (
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
            ) : (
              <div className="empty-state">Click here to add long-term goals</div>
            )}
            {isAddingLongTerm && longTermTasks.length > 0 && (
              <form onSubmit={handleCreateLongTerm} className="task-form">
                <input
                  type="text"
                  ref={newTaskInputRef}
                  value={newLongTermText}
                  onChange={(e) => setNewLongTermText(e.target.value)}
                  placeholder="Enter new long-term goal..."
                  className="task-input"
                />
                <div className="task-form-buttons">
                  <button type="submit" className="btn btn-save">Save</button>
                  <button 
                    type="button" 
                    className="btn btn-cancel"
                    onClick={handleCancelLongTerm}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
          <div 
            className={`resize-handle ${activeSection === 'longTerm' ? 'active' : ''}`}
            onMouseDown={startResize('longTerm')}
          />
        </section>
      </aside>

      <main className="app-content">
        {/* Your main content goes here */}
      </main>
    </div>
  );
};

export default Sidebar;