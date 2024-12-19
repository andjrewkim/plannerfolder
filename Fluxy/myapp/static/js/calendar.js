// Import FullCalendar modules
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';

// Show modal and backdrop when needed
const showModal = () => {
    const modalBackdrop = document.querySelector('.modal');
    const modalContent = document.querySelector('.modal-content');

    modalBackdrop.style.display = 'block';  // Show backdrop
    modalContent.style.display = 'flex';    // Show modal content
};

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

        // Handle event click (to edit/delete)
        eventClick: function (info) {
            const modal = document.getElementById('editEventModal');
            showModal(); // Show modal and backdrop

            // Populate modal with event details
            const eventId = info.event.id; // Get the event ID
            const titleInput = document.getElementById('eventTitle');
            const timeInput = document.getElementById('eventTime');
            const dateInput = document.getElementById('eventDate');

            titleInput.value = info.event.title;

            // Format time correctly
            const eventDate = new Date(info.event.start);
            timeInput.value = eventDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

            // Format date correctly
            const localDate = new Date(info.event.start);
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0'); // Month is zero-based
            const day = String(localDate.getDate()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}`;

            // Save changes to the event
            const form = document.getElementById('editEventForm');
            form.onsubmit = function (e) {
                e.preventDefault();

                const updatedEvent = {
                    title: `${titleInput.value}`,
                    start: `${dateInput.value}T${timeInput.value}:00`,
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

        // Hide the backdrop as well
        const modalBackdrop = document.querySelector('.modal');
        modalBackdrop.style.display = 'none';
    });
});

// CSRF token function for security
function getCSRFToken() {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    return csrfToken;
}
