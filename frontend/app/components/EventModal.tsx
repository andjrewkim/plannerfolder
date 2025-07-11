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
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);
  const [customRecurrenceInput, setCustomRecurrenceInput] = useState('');
  
  // Day mapping for custom recurrence
  const dayMapping: { [key: string]: string } = {
    'MO': 'Monday',
    'TU': 'Tuesday', 
    'WE': 'Wednesday',
    'TH': 'Thursday',
    'FR': 'Friday',
    'SA': 'Saturday',
    'SU': 'Sunday'
  };
  
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
  
  // Simplified recurrence options - removed individual days
  const recurrenceOptions = [
    { value: "", label: "No recurrence" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "biweekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
    { value: "weekdays", label: "Every weekday" },
    { value: "weekends", label: "Every weekend" },
    { value: "custom", label: "Custom" }
  ];

  const handleClose = () => {
    // Make sure to remove the modal-open class when closing manually
    document.body.classList.remove('modal-open');
    setShowCustomRecurrence(false);
    setCustomRecurrenceInput('');
    onClose();
  };

  // Convert RRULE back to human-readable format for display
  const rruleToHumanReadable = (rrule: string): string => {
    if (!rrule) return "";
    
    if (rrule === "FREQ=DAILY") return "daily";
    if (rrule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") return "weekdays";
    if (rrule === "FREQ=WEEKLY;BYDAY=SA,SU") return "weekends";
    if (rrule.startsWith("FREQ=WEEKLY;BYDAY=")) {
      const days = rrule.split("BYDAY=")[1];
      if (days.split(",").length === 1) {
        // Single day weekly recurrence - just return "weekly"
        return "weekly";
      }
      return "custom";
    }
    if (rrule.startsWith("FREQ=WEEKLY;INTERVAL=2")) return "biweekly";
    if (rrule.startsWith("FREQ=MONTHLY")) return "monthly";
    if (rrule.startsWith("FREQ=YEARLY")) return "yearly";
    
    return "custom";
  };

  // Convert human-readable to RRULE
  const humanReadableToRRULE = (input: string, eventDate: string): string => {
    if (!input || input === "") return "";
    
    const text = input.toLowerCase().trim();
    const eventDateObj = new Date(eventDate);
    
    switch (text) {
      case "daily":
        return "FREQ=DAILY";
      case "weekdays":
        return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
      case "weekends":
        return "FREQ=WEEKLY;BYDAY=SA,SU";
      case "weekly":
        // Use the day of the week from the event date
        const dayAbbrevs = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const eventDay = dayAbbrevs[eventDateObj.getDay()];
        return `FREQ=WEEKLY;BYDAY=${eventDay}`;
      case "biweekly":
        const biweeklyDay = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][eventDateObj.getDay()];
        return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${biweeklyDay}`;
      case "monthly":
        return `FREQ=MONTHLY;BYMONTHDAY=${eventDateObj.getDate()}`;
      case "yearly":
        return `FREQ=YEARLY;BYMONTH=${eventDateObj.getMonth() + 1};BYMONTHDAY=${eventDateObj.getDate()}`;
      default:
        return "";
    }
  };

  // Handle recurrence pattern change
  const handleRecurrenceChange = (value: string) => {
    if (value === "custom") {
      setShowCustomRecurrence(true);
      setCustomRecurrenceInput(selectedEvent.recurrence_pattern || '');
    } else {
      setShowCustomRecurrence(false);
      const rrule = humanReadableToRRULE(value, selectedEvent.date);
      onChange('recurrence_pattern', rrule);
    }
  };

  // Handle custom recurrence input
  const handleCustomRecurrenceSubmit = () => {
    const rrule = humanReadableToRRULE(customRecurrenceInput, selectedEvent.date);
    onChange('recurrence_pattern', rrule);
    setShowCustomRecurrence(false);
  };

  // Parse RRULE for display
  const parseRRULEForDisplay = (rrule: string): string => {
    if (!rrule) return "No recurrence";
    
    if (rrule === "FREQ=DAILY") return "Daily";
    if (rrule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") return "Every weekday";
    if (rrule === "FREQ=WEEKLY;BYDAY=SA,SU") return "Every weekend";
    
    if (rrule.startsWith("FREQ=WEEKLY;BYDAY=")) {
      const days = rrule.split("BYDAY=")[1];
      if (days.includes(",")) {
        const dayList = days.split(",").map(day => dayMapping[day] || day).join(", ");
        return `Every ${dayList}`;
      } else {
        return `Weekly on ${dayMapping[days] || days}`;
      }
    }
    
    if (rrule.startsWith("FREQ=WEEKLY;INTERVAL=2")) {
      const days = rrule.split("BYDAY=")[1];
      return `Bi-weekly on ${dayMapping[days] || days}`;
    }
    
    if (rrule.startsWith("FREQ=MONTHLY")) {
      const dayMatch = rrule.match(/BYMONTHDAY=(\d+)/);
      if (dayMatch) {
        return `Monthly on the ${dayMatch[1]}${getOrdinalSuffix(parseInt(dayMatch[1]))}`;
      }
      return "Monthly";
    }
    
    if (rrule.startsWith("FREQ=YEARLY")) {
      const monthMatch = rrule.match(/BYMONTH=(\d+)/);
      const dayMatch = rrule.match(/BYMONTHDAY=(\d+)/);
      if (monthMatch && dayMatch) {
        const monthNames = ["", "January", "February", "March", "April", "May", "June",
                           "July", "August", "September", "October", "November", "December"];
        const month = monthNames[parseInt(monthMatch[1])];
        const day = parseInt(dayMatch[1]);
        return `Yearly on ${month} ${day}${getOrdinalSuffix(day)}`;
      }
      return "Yearly";
    }
    
    return rrule; // Show raw RRULE for complex patterns
  };

  // Helper function for ordinal suffixes
  const getOrdinalSuffix = (day: number): string => {
    if (day >= 11 && day <= 13) return "th";
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  const currentRecurrenceValue = rruleToHumanReadable(selectedEvent.recurrence_pattern);

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
                value={showCustomRecurrence ? "custom" : currentRecurrenceValue}
                onChange={(e) => handleRecurrenceChange(e.target.value)}
                className="modal-select"
              >
                {recurrenceOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              
              {/* Show current recurrence pattern */}
              {selectedEvent.recurrence_pattern && !showCustomRecurrence && (
                <div className="recurrence-display">
                  <small>Current: {parseRRULEForDisplay(selectedEvent.recurrence_pattern)}</small>
                </div>
              )}
            </div>

            {/* Custom recurrence input */}
            {showCustomRecurrence && (
              <div className="form-grid-full">
                <label className="form-label">Custom Recurrence</label>
                <div className="custom-recurrence-container">
                  <input
                    type="text"
                    value={customRecurrenceInput}
                    onChange={(e) => setCustomRecurrenceInput(e.target.value)}
                    className="modal-input"
                    placeholder="e.g., 'every Monday and Wednesday', 'every 2 weeks', 'monthly on the 15th'"
                  />
                  <div className="custom-recurrence-buttons">
                    <button
                      type="button"
                      onClick={handleCustomRecurrenceSubmit}
                      className="modal-button modal-button-save"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomRecurrence(false)}
                      className="modal-button modal-button-close"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <div className="custom-recurrence-help">
                  <small>
                    Examples: "daily", "weekdays", "weekly", "biweekly", 
                    "monthly", "yearly"
                  </small>
                </div>
              </div>
            )}

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