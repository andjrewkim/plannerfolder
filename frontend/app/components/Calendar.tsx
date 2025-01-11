import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import '../styles/calendar.css';
import EditModal from './EditModal'; // Import the EditModal

interface EventDetails {
  eventId: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  virtual: boolean;
  urgency: 'low' | 'medium' | 'high';
  notes: string;
  event_type: string;
  category: string;
  subcategories: string;
  recurrence_pattern: string;
  color: string;
}

interface CalendarProps {
  onEventChange: () => void; // Callback to notify parent of event changes
}

const Calendar: React.FC<CalendarProps> = ({ onEventChange }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [events, setEvents] = useState([]);
  const calendarRef = useRef(null);

  useEffect(() => {
    // Fetch events when the component mounts
    fetchEvents();

    //-----CHANGE CALENDAR HEIGHT BASED ON HEIGHT OF WINDOW BECAUSE CSS DOESN'T WORK----------------------------------------------------------------------------------------------

    // Set the calendar height initially and on window resize
    const updateCalendarHeight = () => {
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        const calendarEl = calendarApi.el;

        // Adjust the height of the calendar based on the window height
        calendarEl.style.height = `${window.innerHeight * 0.8}px`; // 80% of the viewport height
        calendarApi.updateSize(); // Update the calendar size
      }
    };

    // Initial call to set the height
    updateCalendarHeight();

    // Add resize event listener to adjust the height dynamically
    window.addEventListener('resize', updateCalendarHeight);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('resize', updateCalendarHeight);
    };
  }, []);

  //-----------------------------------------------------------------------------------------------------------------------------------------------------------

  const fetchEvents = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/events/');
      const data = await response.json();
      setEvents(
        data.map((event: any) => ({
          id: event.id,
          title: event.event_name,
          start: `${event.date.split('T')[0]}T${event.start_time}`,
          end: `${event.date.split('T')[0]}T${event.end_time}`,
          backgroundColor: event.color,
          extendedProps: {
            location: event.location,
            virtual: event.virtual,
            urgency: event.urgency,
            notes: event.notes,
            event_type: event.event_type,
            category: event.category,
            subcategories: event.subcategories,
            recurrence_pattern: event.recurrence_pattern
          }
        }))
      );
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const formatEventDate = (dateString: string) => {
    const localDate = new Date(dateString);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0'); // Month is zero-based
    const day = String(localDate.getDate()).padStart(2, '0');
    const time = localDate.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${year}-${month}-${day}T${time}:00`;
  };

  const getCSRFToken = () => {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1];
    return token || '';
  };

  const handleSave = async (
    e: React.FormEvent,
    eventId: string,
    updatedEvent: EventDetails
  ) => {
    e.preventDefault();

    const formattedEvent = {
      event_name: updatedEvent.event_name,
      date: updatedEvent.date,
      start_time: updatedEvent.start_time,
      end_time: updatedEvent.end_time,
      location: updatedEvent.location,
      virtual: updatedEvent.virtual,
      urgency: updatedEvent.urgency,
      notes: updatedEvent.notes,
      event_type: updatedEvent.event_type,
      category: updatedEvent.category,
      subcategories: updatedEvent.subcategories,
      recurrence_pattern: updatedEvent.recurrence_pattern,
      color: updatedEvent.color
    };

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/events/${eventId}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(),
        },
        credentials: 'include',
        body: JSON.stringify(formattedEvent),
      });

      if (response.ok) {
        setModalOpen(false);
        fetchEvents(); // Refresh events
        onEventChange(); // Notify parent of event change
      } else {
        alert('Failed to update event.');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleEventDelete = async (eventId: string) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/events/${eventId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(),
        },
        credentials: 'include',
      });

      if (response.ok) {
        setModalOpen(false);
        fetchEvents(); // Refresh events
        onEventChange(); // Notify parent of event change
      } else {
        alert('Failed to delete event.');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleEventClick = (info: any) => {
    const event = info.event;
    const startDate = new Date(event.start);
    const endDate = event.end ? new Date(event.end) : startDate;

    setEventDetails({
      eventId: event.id,
      event_name: event.title,
      date: startDate.toISOString().split('T')[0],
      start_time: startDate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
      end_time: endDate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
      location: event.extendedProps.location || '',
      virtual: event.extendedProps.virtual || false,
      urgency: event.extendedProps.urgency || 'medium',
      notes: event.extendedProps.notes || '',
      event_type: event.extendedProps.event_type || '',
      category: event.extendedProps.category || '',
      subcategories: event.extendedProps.subcategories || '',
      recurrence_pattern: event.extendedProps.recurrence_pattern || '',
      color: event.backgroundColor || '#000'
    });

    setModalOpen(true);
  };

  return (
    <div className="relative">
      <div id="calendar" className="mb-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          events={events}
          eventClick={handleEventClick}
          eventBackgroundColor="var(--event-color)"
          eventBorderColor="var(--event-border-color)"
        />
      </div>

      <EditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        eventDetails={eventDetails}
        onSave={handleSave}
        onDelete={handleEventDelete}
      />
    </div>
  );
};

export default Calendar;