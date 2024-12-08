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
        events: '/api/events/', // Fetch events from your API endpoint

        // Handle event click (to edit/delete)
        eventClick: function (info) {
            const modal = document.getElementById('editEventModal');
            modal.style.display = 'block';

            // Populate modal with event details
            const eventId = info.event.id; // Get the event ID
            const titleInput = document.getElementById('eventTitle');
            const timeInput = document.getElementById('eventTime');
            const dateInput = document.getElementById('eventDate');

            titleInput.value = info.event.title;
            timeInput.value = info.event.start.toISOString().substring(11, 16); // Format time (HH:mm)
            dateInput.value = info.event.start.toISOString().substring(0, 10); // Format date (YYYY-MM-DD)

            // Save changes to the event
            const form = document.getElementById('editEventForm');
            form.onsubmit = function (e) {
                e.preventDefault();

                const updatedEvent = {
                    event: titleInput.value,
                    time: timeInput.value,
                    date: dateInput.value,
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
                        modal.style.display = 'none';
                        calendar.refetchEvents(); // Refresh events after update
                    } else {
                        alert('Failed to update event.');
                    }
                })
                .catch(error => console.error('Error:', error));
            };

            // Handle delete event
            const deleteButton = document.getElementById('deleteEventButton');
            deleteButton.onclick = function () {
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
                            modal.style.display = 'none';
                            calendar.refetchEvents(); // Refresh events after deletion
                        } else {
                            alert('Failed to delete event.');
                        }
                    })
                    .catch(error => console.error('Error:', error));
                }
            };
        },
    });

    calendar.render();

    // Close modal when clicking the close button
    const closeModal = document.querySelector('.close');
    closeModal.addEventListener('click', () => {
        const modal = document.getElementById('editEventModal');
        modal.style.display = 'none';
    });
});

// CSRF token function for security
function getCSRFToken() {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    return csrfToken;
}
