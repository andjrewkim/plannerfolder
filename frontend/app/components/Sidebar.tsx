import React, { useEffect, useState } from 'react';
import '../styles/container.css';

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

const Sidebar: React.FC = () => {
  const [todayEvents, setTodayEvents] = useState<APIEvent[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [longTermTasks, setLongTermTasks] = useState<TodoTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingTasks, setDeletingTasks] = useState<number[]>([]);
  
  // Add state for each section's height
  const [heights, setHeights] = useState({
    schedule: 300,
    tasks: 300,
    longTerm: 300
  });
  const [isDragging, setIsDragging] = useState<string | null>(null);

  const startResize = (section: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(section);
    
    const startY = e.clientY;
    const startHeight = heights[section as keyof typeof heights];
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const newHeight = Math.max(100, startHeight + delta);
      setHeights(prev => ({
        ...prev,
        [section]: newHeight
      }));
    };
    
    const handleMouseUp = () => {
      setIsDragging(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getCSRFToken = () => {
    return document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1] || '';
  };

  // Keep your existing fetch functions
  const fetchTodayEvents = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/events/', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(),
        },
        credentials: 'include',
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const filteredEvents = data.filter((event: APIEvent) => {
        const eventDate = new Date(event.date);
        return eventDate >= todayStart && eventDate < todayEnd;
      });

      setTodayEvents(filteredEvents);
      setError(null);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Failed to load events');
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/tasks/', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(),
        },
        credentials: 'include',
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      const regular: TodoTask[] = [];
      const longTerm: TodoTask[] = [];
      
      data.forEach((task: TodoTask) => {
        if (task.date) {
          longTerm.push(task);
        } else {
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
  };

  const handleTaskComplete = async (taskId: number) => {
    setDeletingTasks(prev => [...prev, taskId]);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/tasks/${taskId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(),
        },
        credentials: 'include',
      });

      if (response.ok) {
        await fetchTasks();
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task');
    } finally {
      setDeletingTasks(prev => prev.filter(id => id !== taskId));
    }
  };

  const formatEventTime = (date: string, time: string): string => {
    return new Date(`${date.split('T')[0]}T${time}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  useEffect(() => {
    fetchTodayEvents();
    fetchTasks();
  }, []);

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <section 
          className="sidebar-section" 
          style={{ 
            marginTop: '60px', 
            height: heights.schedule,
            minHeight: '100px',
            overflow: 'auto',
            position: 'relative'
          }}
        >
          <h3 className="section-title">Today's Schedule</h3>
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
            className="resize-handle" 
            onMouseDown={startResize('schedule')}
            style={{
              cursor: 'ns-resize',
              height: '10px',
              width: '100%',
              background: isDragging === 'schedule' ? '#e0e0e0' : 'transparent',
              position: 'absolute',
              bottom: 0,
              left: 0
            }}
          />
        </section>

        <section 
          className="sidebar-section"
          style={{ 
            height: heights.tasks,
            minHeight: '100px',
            overflow: 'auto',
            position: 'relative'
          }}
        >
          <h3 className="section-title">Tasks</h3>
          <div className="section-content">
            {tasks.length > 0 ? (
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
              <div className="empty-state">No tasks</div>
            )}
          </div>
          <div 
            className="resize-handle" 
            onMouseDown={startResize('tasks')}
            style={{
              cursor: 'ns-resize',
              height: '10px',
              width: '100%',
              background: isDragging === 'tasks' ? '#e0e0e0' : 'transparent',
              position: 'absolute',
              bottom: 0,
              left: 0
            }}
          />
        </section>

        <section 
          className="sidebar-section"
          style={{ 
            height: heights.longTerm,
            minHeight: '100px',
            overflow: 'auto',
            position: 'relative'
          }}
        >
          <h3 className="section-title">Long-term Tasks</h3>
          <div className="section-content">
            {longTermTasks.length > 0 ? (
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
                      {task.date && (
                        <span className="task-date">
                          Due: {new Date(task.date).toLocaleDateString()}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">No long-term tasks</div>
            )}
          </div>
          <div 
            className="resize-handle" 
            onMouseDown={startResize('longTerm')}
            style={{
              cursor: 'ns-resize',
              height: '10px',
              width: '100%',
              background: isDragging === 'longTerm' ? '#e0e0e0' : 'transparent',
              position: 'absolute',
              bottom: 0,
              left: 0
            }}
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