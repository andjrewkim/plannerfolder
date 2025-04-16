import React, { useState } from 'react'; 
import '../styles/modalstyle.css';

interface EventDetails {
  eventId: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  virtual: boolean;
  urgency: 'low' | 'medium' | 'high';
  notes: string;
  event_type: string;
  category: string;
  recurrence_pattern: string;
  color: string;
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventDetails: EventDetails | null;
  onSave: (e: React.FormEvent<HTMLFormElement>, eventId: string, updatedEvent: EventDetails) => void;
  onDelete: (eventId: string) => void;
}

const EditModal: React.FC<EditModalProps> = ({ isOpen, onClose, eventDetails, onSave, onDelete }) => {
  // Initialize state with empty/default values
  const [event_name, setEventName] = useState('');
  const [start_time, setStartTime] = useState('');
  const [end_time, setEndTime] = useState('');
  const [date, setDate] = useState('');
  const [virtual, setVirtual] = useState(false);
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('low');
  const [notes, setNotes] = useState('');
  const [event_type, setEventType] = useState('');
  const [category, setCategory] = useState('');
  const [recurrence_pattern, setRecurrencePattern] = useState('');
  const [color, setColor] = useState('#000000');

  // Update state values when eventDetails changes
  React.useEffect(() => {
    if (eventDetails) {
      setEventName(eventDetails.event_name);
      setStartTime(eventDetails.start_time);
      setEndTime(eventDetails.end_time);
      setDate(eventDetails.date);
      setVirtual(eventDetails.virtual);
      setUrgency(eventDetails.urgency);
      setNotes(eventDetails.notes);
      setEventType(eventDetails.event_type);
      setCategory(eventDetails.category);
      setRecurrencePattern(eventDetails.recurrence_pattern);
      setColor(eventDetails.color);
    }
  }, [eventDetails]);

  if (!isOpen || !eventDetails) return null;

  const recurrenceOptions = [
    { value: "", label: "No recurrence" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "biweekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
    { value: "weekdays", label: "Every weekday" },
    { value: "custom", label: "Custom" }
  ];

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const updatedEvent = {
      eventId: eventDetails.eventId,
      event_name,
      date,
      start_time,
      end_time,
      virtual,
      urgency,
      notes,
      event_type,
      category,
      recurrence_pattern,
      color
    };
    onSave(e, eventDetails.eventId, updatedEvent);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h2 className="modal-header">Edit Event</h2>
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-grid-full">
              <label className="form-label">Event Name</label>
              <input
                type="text"
                value={event_name}
                onChange={(e) => setEventName(e.target.value)}
                className="modal-input"
              />
            </div>

            <div>
              <label className="form-label">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="modal-input"
              />
            </div>

            {/* Time inputs side by side */}
            <div className="time-inputs">
              <div>
                <label className="form-label">Start Time</label>
                <input
                  type="time"
                  value={start_time}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="modal-input"
                />
              </div>
              <div>
                <label className="form-label">End Time</label>
                <input
                  type="time"
                  value={end_time}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="modal-input"
                />
              </div>
            </div>

            <div className="form-grid-full">
              <label className="form-label">Recurrence</label>
              <select
                value={recurrence_pattern}
                onChange={(e) => setRecurrencePattern(e.target.value)}
                className="modal-select"
              >
                {recurrenceOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Event Type</label>
              <input
                type="text"
                value={event_type}
                onChange={(e) => setEventType(e.target.value)}
                className="modal-input"
              />
            </div>

            <div>
              <label className="form-label">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="modal-input"
              />
            </div>

            <div>
              <label className="form-label">Urgency</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as 'low' | 'medium' | 'high')}
                className="modal-select"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Virtual event checkbox */}
            <div className="form-grid-full">
              <label className="checkbox-wrapper">
                <input
                  type="checkbox"
                  checked={virtual}
                  onChange={(e) => setVirtual(e.target.checked)}
                  className="modal-checkbox"
                />
                <span>Virtual Event</span>
              </label>
            </div>

            {/* Color picker */}
            <div className="form-grid-full">
              <label className="form-label">Color</label>
              <div className="color-picker-wrapper">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="modal-color-picker"
                />
              </div>
            </div>

            <div className="form-grid-full">
              <label className="form-label">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="modal-textarea"
                rows={4}
              />
            </div>
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