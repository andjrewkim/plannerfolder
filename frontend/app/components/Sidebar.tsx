import React, { useEffect, useState } from 'react';
import '../styles/container.css';

interface Event {
  id: string;
  title: string;
  start: string; // ISO 8601 datetime string
  color: string; // Event color
}

const Sidebar: React.FC = () => {
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<string[]>([]); // State for To-Do List

  // Fetch today's events from the API
  useEffect(() => {
    const fetchTodayEvents = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/events/'); // Replace with your Django API URL
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        const events: Event[] = await response.json();

        // Get today's date range
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        // Filter events for today
        const filteredEvents = events.filter(event => {
          const eventDate = new Date(event.start);
          return eventDate >= todayStart && eventDate < todayEnd;
        });

        setTodayEvents(filteredEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
        setError('Failed to load events');
      }
    };

    fetchTodayEvents();
  }, []);

  // Add a task to the To-Do list
  const addTask = (task: string) => {
    if (task) {
      setTasks([...tasks, task]);
    }
  };

  return (
    <div className="sidebar">
      <div className="resizeHandle"></div>
      
      <div className="widget">
        <h3>Today's Schedule</h3>
        <ul id="today-events">
          {error ? (
            <li>{error}</li>
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
                {event.title} at{' '}
                {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </li>
            ))
          ) : (
            <li>No events for today</li>
          )}
        </ul>
      </div>

      {/* To-Do List Section */}
      <div className="widget todo-widget">
        <h3>To-Do List</h3>
        <ul id="todo-list">
          {tasks.length > 0 ? (
            tasks.map((task, index) => (
              <li key={index}>
                <input type="checkbox" id={`task-${index}`} />
                <label htmlFor={`task-${index}`}>{task}</label>
              </li>
            ))
          ) : (
            <li>No tasks to do</li>
          )}
        </ul>
        <div className="add-task">
          <input
            type="text"
            placeholder="Add a new task"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addTask((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = ''; // Clear input after adding
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
