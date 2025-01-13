import React, { useEffect, useState } from 'react';
import '../styles/container.css';

interface APIEvent {
  id: number;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  color: string;
  location: string | null;
  virtual: boolean;
  urgency: string;
  notes: string | null;
  event_type: string;
  category: string | null;
  subcategories: string;
  recurrence_pattern: string | null;
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

  const getCSRFToken = () => {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1];
    return token || '';
  };
const fetchTodayEvents = async () => {
  try {
    console.log('Attempting to fetch events...');
    const response = await fetch('http://127.0.0.1:8000/api/events/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFToken(),
      },
      credentials: 'include',
    });


    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    
    // Filter events for today
    const today = new Date();
    console.log('Today:', today);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const filteredEvents = data.filter((event: APIEvent) => {
      const eventDate = new Date(event.date);
      console.log('Event date:', eventDate, 'Is today?:', eventDate >= todayStart && eventDate < todayEnd);
      return eventDate >= todayStart && eventDate < todayEnd;
    });

    console.log('Filtered events:', filteredEvents);
    setTodayEvents(filteredEvents);
    setError(null);
  } catch (error) {
    console.error('Detailed error:', error);
    setError('Failed to load events');
  }
};

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/tasks/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Separate tasks into regular and long-term based on date
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

  useEffect(() => {
    fetchTodayEvents();
    fetchTasks();
  }, []);

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
        // Refresh both task lists after deletion
        fetchTasks();
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

  return (
    <aside className="app-sidebar">
      <section className="sidebar-section">
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
      </section>

      <section className="sidebar-section">
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
      </section>

      <section className="sidebar-section">
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
      </section>
    </aside>
  );
};

export default Sidebar;