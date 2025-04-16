import React, { useEffect, useRef, useState } from 'react';
import '../styles/modalstyle.css';

interface EventDetails {
  eventId: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  virtual: boolean;
  urgency: 'low' | 'medium' | 'high';
  notes: string;
  event_type: string;
  category: string;
  subcategories: string;
  recurrence_pattern: string;
  color: string;
}

interface Position {
  x: number;
  y: number;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: EventDetails | null;
  position: Position | null;
  onSubmit: (e: React.FormEvent) => void;
  onDelete?: (eventId: string) => void;
  onChange: (field: keyof EventDetails, value: string | boolean) => void;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  selectedEvent,
  position,
  onSubmit,
  onDelete,
  onChange,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [finalPosition, setFinalPosition] = useState<React.CSSProperties>({});
    
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      
      // Wait for the modal to render before calculating position
      setTimeout(() => {
        if (modalRef.current && position) {
          const modalRect = modalRef.current.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          
          // Keep horizontal shift, but increase vertical shift significantly
          let xPos = position.x - 60; // 60px to the left
          let yPos = position.y - 150; // Increased from 80px to 150px upward
          
          // Check right edge
          if (xPos + modalRect.width > viewportWidth) {
            xPos = Math.max(20, viewportWidth - modalRect.width - 40);
          }
          
          // Check left edge
          if (xPos < 20) {
            xPos = 20;
          }
          
          // Check bottom edge - more aggressive repositioning
          if (yPos + modalRect.height > viewportHeight) {
            // Push the modal higher up when it hits the bottom
            yPos = Math.max(20, viewportHeight - modalRect.height - 60);
          }
          
          // Check top edge - but don't let it go completely off-screen
          if (yPos < 20) {
            yPos = 20;
          }
          
          setFinalPosition({
            position: 'absolute',
            top: `${yPos}px`,
            left: `${xPos}px`,
            maxHeight: '80vh',
            overflowY: 'auto'
          });
        }
      }, 10);
    } else {
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup function
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, position]);
  
  // Early return if not open or no selected event
  if (!isOpen || !selectedEvent) return null;
  
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

  const handleClose = () => {
    // Make sure to remove the modal-open class when closing manually
    document.body.classList.remove('modal-open');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div 
        ref={modalRef} 
        className="modal-container" 
        style={finalPosition}
      >
        <h2 className="modal-header">
          {selectedEvent.eventId ? "Edit Event" : "Add New Event"}
        </h2>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="form-grid-full">
              <label className="form-label">Event Name</label>
              <input
                type="text"
                value={selectedEvent.event_name}
                onChange={(e) => onChange('event_name', e.target.value)}
                className="modal-input"
                required
              />
            </div>

            <div>
              <label className="form-label">Date</label>
              <input
                type="date"
                value={selectedEvent.date}
                onChange={(e) => onChange('date', e.target.value)}
                className="modal-input"
                required
              />
            </div>

            {/* Time inputs side by side */}
            <div className="time-inputs">
              <div>
                <label className="form-label">Start Time</label>
                <input
                  type="time"
                  value={selectedEvent.start_time}
                  onChange={(e) => onChange('start_time', e.target.value)}
                  className="modal-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">End Time</label>
                <input
                  type="time"
                  value={selectedEvent.end_time}
                  onChange={(e) => onChange('end_time', e.target.value)}
                  className="modal-input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label">Location</label>
              <input
                type="text"
                value={selectedEvent.location}
                onChange={(e) => onChange('location', e.target.value)}
                className="modal-input"
              />
            </div>

            <div className="form-grid-full">
              <label className="form-label">Recurrence</label>
              <select
                value={selectedEvent.recurrence_pattern}
                onChange={(e) => onChange('recurrence_pattern', e.target.value)}
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
                value={selectedEvent.event_type}
                onChange={(e) => onChange('event_type', e.target.value)}
                className="modal-input"
              />
            </div>

            <div>
              <label className="form-label">Category</label>
              <input
                type="text"
                value={selectedEvent.category}
                onChange={(e) => onChange('category', e.target.value)}
                className="modal-input"
              />
            </div>

            <div>
              <label className="form-label">Urgency</label>
              <select
                value={selectedEvent.urgency}
                onChange={(e) => onChange('urgency', e.target.value as 'low' | 'medium' | 'high')}
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
                  checked={selectedEvent.virtual}
                  onChange={(e) => onChange('virtual', e.target.checked)}
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
                  value={selectedEvent.color || "#000000"}
                  onChange={(e) => onChange('color', e.target.value)}
                  className="modal-color-picker"
                />
              </div>
            </div>

            <div className="form-grid-full">
              <label className="form-label">Notes</label>
              <textarea
                value={selectedEvent.notes}
                onChange={(e) => onChange('notes', e.target.value)}
                className="modal-textarea"
                rows={4}
              />
            </div>
          </div>

          <div className="modal-buttons">
            <button type="submit" className="modal-button modal-button-save">
              {selectedEvent.eventId ? "Update" : "Create"}
            </button>
            {selectedEvent.eventId && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(selectedEvent.eventId)}
                className="modal-button modal-button-delete"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
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

export default EventModal;