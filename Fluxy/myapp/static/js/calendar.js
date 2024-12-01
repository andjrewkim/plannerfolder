
/*
document.addEventListener("DOMContentLoaded", function () {
    const calendarEl = document.getElementById("calendar");

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth", // Month view
        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
        },
        events: "/api/events/", // Fetch events from your API
        editable: true,         // Allow drag-and-drop editing
        selectable: true,       // Allow selecting time slots
        dateClick: function (info) {
            const eventName = prompt("Enter Event Name:");
            if (eventName) {
                const eventData = {
                    event: eventName,
                    date: info.dateStr,  // FullCalendar provides the clicked date
                    time: "00:00",       // Default time; you can enhance this
                };

                fetch("/api/events/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCSRFToken(), // Add CSRF token
                    },
                    body: JSON.stringify(eventData),
                })
                .then(response => {
                    if (response.ok) {
                        alert("Event created successfully!");
                        calendar.refetchEvents(); // Refresh events
                    } else {
                        alert("Failed to create event.");
                    }
                })
                .catch(error => console.error("Error:", error));
            }
        },
    });

    calendar.render();
});

// Function to get CSRF token from the page
function getCSRFToken() {
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;
    return csrfToken;
}
*/