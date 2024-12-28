import React, { useState } from 'react';
import '../styles/modalstyle.css'; // Import as a global CSS file

const EditModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="modal"> {/* Use global class names */}
      <div className="modalContent">
        <button onClick={onClose} className="close">×</button>
        <h2>Edit Event</h2>
        <form id="editEventForm">
          <label htmlFor="eventTitle">Event Title:</label>
          <input type="text" id="eventTitle" name="eventTitle" required />
          <label htmlFor="eventTime">Time:</label>
          <input type="time" id="eventTime" name="eventTime" required />
          <label htmlFor="eventDate">Date:</label>
          <input type="date" id="eventDate" name="eventDate" required />
          <button type="submit">Save</button>
        </form>
        <button className="deleteButton">Delete Event</button>
      </div>
    </div>
  );
};

export default EditModal;
