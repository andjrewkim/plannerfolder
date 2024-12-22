document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const resizer = document.createElement('div');
    resizer.className = 'resize-handle'; // Match CSS class
    sidebar.appendChild(resizer);

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'ew-resize'; // Change cursor during resize
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const container = document.querySelector('.container');
        const newWidth = e.clientX - sidebar.offsetLeft; // Adjust for sidebar position
        const maxWidth = container.offsetWidth - 200; // Prevent overlap

        if (newWidth > 150 && newWidth < maxWidth) { // Ensure within min/max range
            sidebar.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = 'default';
    });
});
