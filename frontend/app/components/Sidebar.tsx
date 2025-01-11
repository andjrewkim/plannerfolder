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

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Received data:', data);
    
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
      const response = await fetch('http://127.0.0.1:8000/api/tasks', {
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
    <div className="sidebar">
      <div className="widget">
        <h3>Today's Schedule</h3>
        <ul id="today-events">
          {error ? (
            <li className="text-red-500">{error}</li>
          ) : todayEvents.length > 0 ? (
            todayEvents.map(event => (
              <li
                key={event.id}
                style={{
                  color: event.color,
                  borderLeft: `4px solid ${event.color}`,
                  paddingLeft: '8px',
                }}
              >
                {event.event_name} at {formatEventTime(event.date, event.start_time)}
              </li>
            ))
          ) : (
            <li>No events for today</li>
          )}
        </ul>
      </div>

      <div className="widget tasks-widget">
        <h3>Tasks</h3>
        <ul className="task-list">
          {tasks.map((task) => (
            <li 
              key={task.id} 
              className={`task-item ${deletingTasks.includes(task.id) ? 'deleting' : ''}`}
            >
              <div className="checkbox-container">
                <input
                  type="checkbox"
                  id={`task-${task.id}`}
                  onChange={() => handleTaskComplete(task.id)}
                  className="task-checkbox"
                />
                <label 
                  htmlFor={`task-${task.id}`}
                  className="task-label"
                >
                  {task.event}
                </label>
              </div>
            </li>
          ))}
          {tasks.length === 0 && (
            <li className="no-tasks">No tasks</li>
          )}
        </ul>
      </div>

      <div className="widget tasks-widget">
        <h3>Long-term Tasks</h3>
        <ul className="task-list">
          {longTermTasks.map((task) => (
            <li 
              key={task.id} 
              className={`task-item ${deletingTasks.includes(task.id) ? 'deleting' : ''}`}
            >
              <div className="checkbox-container">
                <input
                  type="checkbox"
                  id={`long-task-${task.id}`}
                  onChange={() => handleTaskComplete(task.id)}
                  className="task-checkbox"
                />
                <label 
                  htmlFor={`long-task-${task.id}`}
                  className="task-label"
                >
                  <div>{task.event}</div>
                  {task.date && (
                    <div className="task-date">
                      Due: {new Date(task.date).toLocaleDateString()}
                    </div>
                  )}
                </label>
              </div>
            </li>
          ))}
          {longTermTasks.length === 0 && (
            <li className="no-tasks">No long-term tasks</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;