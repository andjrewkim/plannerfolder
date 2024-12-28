import React from 'react';
import '../styles/container.css'; // Import the global CSS file

const Sidebar = () => {
  return (
    <div className="sidebar"> {/* Use global class names */}
      <div className="resizeHandle"></div>
      <div className="widget">
        <h3>Today's Schedule</h3>
        <ul id="today-events">
          {/* Populate dynamically */}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
