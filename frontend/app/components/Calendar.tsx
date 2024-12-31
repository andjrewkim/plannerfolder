import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import '../styles/calendar.css';
import EditModal from './EditModal'; // Import the EditModal

interface EventDetails {
  eventId: string;
  title: string;
  time: string;
  date: string;
}

const Calendar = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [events, setEvents] = useState([]);
  const calendarRef = useRef(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/events/');
      const data = await response.json();
      setEvents(data.map((event: any) => ({
        ...event,
        start: formatEventDate(event.start),
      })));
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
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
    return token || '';
  };

  const handleSave = async (e: React.FormEvent, eventId: string, updatedEvent: EventDetails) => {
    e.preventDefault();

    const formattedEvent = {
      title: updatedEvent.title,
      start: `${updatedEvent.date}T${updatedEvent.time}:00`,
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
      } else {
        alert('Failed to update event.');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleEventDelete = async (eventId: string) => {
    //if (!confirm('Do you want to delete this event?')) return;   USE MAYBE THIS ALERTS FOR DELETE EVENT

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
        fetchEvents();
      } else {
        alert('Failed to delete event.');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleEventClick = (info: any) => {
    const event = info.event;
    const localDate = new Date(event.start);

    setEventDetails({
      eventId: event.id,
      title: event.title,
      time: localDate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
      date: localDate.toISOString().split('T')[0],
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
          height="auto"
          events={events}
          eventClick={handleEventClick}
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
