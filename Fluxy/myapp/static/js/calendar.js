// Import FullCalendar modules
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';

// FullCalendar Initialization
document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');

    const calendar = new Calendar(calendarEl, {
        plugins: [dayGridPlugin],
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
        },
        events: '/api/events/', // Fetch events from your API

        // Handle event click (to delete)
        eventClick: function (info) {
            if (confirm("Do you want to delete this event?")) {
                const eventId = info.event.id; // Get the event ID
                
                console.log(`Event ID to delete: ${eventId}`);

                // Make a DELETE request to the backend
                fetch(`/api/events/${eventId}/`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken(),  // Pass the CSRF token if needed
                    },
                    credentials: 'include',  // Include cookies for cross-origin requests if necessary
                })
                .then(response => {
                    if (response.ok) {
                        calendar.refetchEvents(); // Refresh events after deletion
                    } else {
                        alert('Failed to delete event.');
                    }
                })
                .catch(error => console.error('Error:', error));
            }
        },
    });

    calendar.render();
});

// CSRF token function for security
function getCSRFToken() {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    return csrfToken;
}
