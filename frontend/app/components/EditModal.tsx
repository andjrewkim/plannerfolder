import React, { useState } from 'react';
import '../styles/modalstyle.css';



interface EventDetails {
  eventId: string;
  title: string;
  time: string;
  date: string;
}



interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventDetails: EventDetails | null;
  onSave: (e: React.FormEvent, eventId: string, updatedEvent: EventDetails) => void;
  onDelete: (eventId: string) => void;
}

const EditModal: React.FC<EditModalProps> = ({ isOpen, onClose, eventDetails, onSave, onDelete }) => {
  if (!isOpen || !eventDetails) return null;

  const [title, setTitle] = useState(eventDetails.title);
  const [time, setTime] = useState(eventDetails.time);
  const [date, setDate] = useState(eventDetails.date);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedEvent = { eventId: eventDetails.eventId, title, time, date };
    onSave(e, eventDetails.eventId, updatedEvent);
    console.log("updated event sefewfwfwe", (updatedEvent));
  };


  
  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h2 className="modal-header">Edit Event</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="eventTitle" className="block mb-1">Title:</label>
            <input
              type="text"
              id="eventTitle"
              value={title} // Controlled input
              onChange={(e) => setTitle(e.target.value)} // Update title as user types
              className="modal-input"
            />
          </div>
          <div>
            <label htmlFor="eventTime" className="block mb-1">Time:</label>
            <input
              type="time"
              id="eventTime"
              value={time} // Controlled input
              onChange={(e) => setTime(e.target.value)} // Update time as user types
              className="modal-input"
            />
          </div>
          <div>
            <label htmlFor="eventDate" className="block mb-1">Date:</label>
            <input
              type="date"
              id="eventDate"
              value={date} // Controlled input
              onChange={(e) => setDate(e.target.value)} // Update date as user types
              className="modal-input"
            />
          </div>
          <div className="modal-buttons">
            <button type="submit" className="modal-button modal-button-save">
              Save
            </button>
            <button
              type="button"
              onClick={() => onDelete(eventDetails.eventId)}
              className="modal-button modal-button-delete"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="modal-button modal-button-close"
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditModal;
