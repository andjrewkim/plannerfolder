// components/Calendar.tsx
import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import '../styles/calendar.css'; // Your CSS for calendar

const Calendar = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [eventDetails, setEventDetails] = useState(null);

  const [events, setEvents] = useState([]);
  const calendarRef = useRef(null);

  useEffect(() => {
    // Fetch events from Django backend
    const fetchEvents = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/events/'); // Replace with your Django server URL
        const data = await response.json();
        setEvents(data); // Set fetched events to the state
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };

    fetchEvents(); // Fetch events when the component mounts
  }, []);

  return (
    <div>
      <div id="calendar">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          events={events} // Use the fetched events
        />
      </div>
    </div>
  );



  // CSRF Token function (you need to implement this method in your Next.js)
  const getCSRFToken = () => {
    // Replace with your method of obtaining the CSRF token (e.g. from cookies or an API)
    return document.querySelector('[name=csrfmiddlewaretoken]').value;
  };

  // Modal Show function (to show the modal when clicking an event)
  const showModal = () => {
    setModalOpen(true);
  };

  // Handle form submission
  const handleFormSubmit = (eventId, eventDetails) => {
    const titleInput = document.getElementById('eventTitle').value;
    const timeInput = document.getElementById('eventTime').value;
    const dateInput = document.getElementById('eventDate').value;

    const updatedEvent = {
      title: titleInput,
      start: `${dateInput}T${timeInput}:00`,
    };

    // Send PUT request to update the event
    fetch(`/api/events/${eventId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFToken(),
      },
      credentials: 'include',
      body: JSON.stringify(updatedEvent),
    })
    .then(response => {
      if (response.ok) {
        setModalOpen(false);
        calendarRef.current.getApi().refetchEvents(); // Refresh events after update
      } else {
        alert('Failed to update event.');
      }
    })
    .catch(error => console.error('Error:', error));
  };

  // Handle event deletion
  const handleEventDelete = (eventId) => {
    if (confirm('Do you want to delete this event?')) {
      fetch(`/api/events/${eventId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(),
        },
        credentials: 'include',
      })
      .then(response => {
        if (response.ok) {
          setModalOpen(false);
          calendarRef.current.getApi().refetchEvents(); // Refresh events after deletion
        } else {
          alert('Failed to delete event.');
        }
      })
      .catch(error => console.error('Error:', error));
    }
  };

  // FullCalendar setup and event click handling
  useEffect(() => {
    const calendarApi = calendarRef.current.getApi();

    calendarApi.on('eventClick', (info) => {
      const event = info.event;
      const localDate = new Date(event.start);

      setEventDetails({
        eventId: event.id,
        title: event.title,
        time: localDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        date: `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`,
      });

      showModal();
    });
  }, []);

  return (
    <div>
      <div id="calendar">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          height="auto"
          events="/api/events/" // Fetch events from your API
        />
      </div>

      {/* Modal to edit event */}
      {modalOpen && eventDetails && (
        <div className="modal">
          <div className="modal-content">
            <h2>Edit Event</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleFormSubmit(eventDetails.eventId, eventDetails); }}>
              <label htmlFor="eventTitle">Title:</label>
              <input type="text" id="eventTitle" defaultValue={eventDetails.title} />
              <label htmlFor="eventTime">Time:</label>
              <input type="time" id="eventTime" defaultValue={eventDetails.time} />
              <label htmlFor="eventDate">Date:</label>
              <input type="date" id="eventDate" defaultValue={eventDetails.date} />
              <button type="submit">Save</button>
            </form>
            <button onClick={() => handleEventDelete(eventDetails.eventId)}>Delete Event</button>
            <button onClick={() => setModalOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
