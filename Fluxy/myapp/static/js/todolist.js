document.addEventListener('DOMContentLoaded', function () {
    // Fetch events from the API
    fetch('/api/events')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch events');
            }
            return response.json();
        })
        .then(data => {
            // Get today's date (start and end)
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // Midnight
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1); // Next day's midnight

            // Filter events for today
            const todayEvents = data.filter(event => {
                const eventDate = new Date(event.start); // Convert event start to Date object
                return eventDate >= todayStart && eventDate < todayEnd;
            });

            // Update the DOM
            const todayEventsContainer = document.getElementById('today-events');
            todayEventsContainer.innerHTML = ''; // Clear previous events

            if (todayEvents.length > 0) {
                todayEvents.forEach(event => {
                    const listItem = document.createElement('li');
                    const eventTime = new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Format event time

                    // Style the list item with the event's color
                    listItem.textContent = `${event.title} at ${eventTime}`;
                    listItem.style.color = event.color; // Apply color to text
                    listItem.style.borderLeft = `4px solid ${event.color}`; // Add a color indicator (optional)
                    listItem.style.paddingLeft = '8px'; // Adjust padding for better appearance
                    listItem.style.borderLeftColor = event.color; //FROM LXNAR I WROTE IT APPLIES COLOR TO CSS SIDEBAR THING

                    todayEventsContainer.appendChild(listItem);
                });
            } else {
                todayEventsContainer.innerHTML = '<li>No events for today</li>';
            }
        })
        .catch(error => {
            console.error('Error fetching events:', error);
            const todayEventsContainer = document.getElementById('today-events');
            todayEventsContainer.innerHTML = '<li>Failed to load events</li>';
        });
});
