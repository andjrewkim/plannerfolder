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
  const [selectedWeeklyDays, setSelectedWeeklyDays] = useState<string[]>([]);
  const [customInterval, setCustomInterval] = useState<number>(1);
  
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

  const dayOptions = [
    { value: 'MO', label: 'Mon' },
    { value: 'TU', label: 'Tue' },
    { value: 'WE', label: 'Wed' },
    { value: 'TH', label: 'Thu' },
    { value: 'FR', label: 'Fri' },
    { value: 'SA', label: 'Sat' },
    { value: 'SU', label: 'Sun' }
  ];

  // Utility function to get day of week from date string (YYYY-MM-DD)
  const getDayOfWeekFromDateString = (dateString: string): string => {
    // Parse the date string directly without creating a Date object to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    // Create date in local timezone
    const date = new Date(year, month - 1, day);
    const dayAbbrevs = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    return dayAbbrevs[date.getDay()];
  };

  // Utility function to get day and month from date string
  const getDayAndMonthFromDateString = (dateString: string): { day: number, month: number } => {
    const [year, month, day] = dateString.split('-').map(Number);
    return { day, month };
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
  
  // Simplified recurrence options
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
    setSelectedWeeklyDays([]);
    setCustomInterval(1);
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
      const dayList = days.split(",");
      
      // Check if it's a single day weekly recurrence
      if (dayList.length === 1) {
        return "weekly";
      }
      
      // Check if it's weekdays or weekends
      if (dayList.sort().join(",") === "MO,TU,WE,TH,FR") return "weekdays";
      if (dayList.sort().join(",") === "SA,SU") return "weekends";
      
      // Otherwise it's a custom selection
      return "custom";
    }
    if (rrule.startsWith("FREQ=WEEKLY;INTERVAL=2")) return "biweekly";
    if (rrule.startsWith("FREQ=MONTHLY")) return "monthly";
    if (rrule.startsWith("FREQ=YEARLY")) return "yearly";
    if (rrule.startsWith("FREQ=WEEKLY") && !rrule.includes("BYDAY=")) return "weekly";
    
    return "custom";
  };

  // Convert human-readable to RRULE - FIXED VERSION
  const humanReadableToRRULE = (input: string, eventDate: string): string => {
    if (!input || input === "") return "";
    
    const text = input.toLowerCase().trim();
    
    switch (text) {
      case "daily":
        return "FREQ=DAILY";
      case "weekdays":
        return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
      case "weekends":
        return "FREQ=WEEKLY;BYDAY=SA,SU";
      case "weekly":
        // Use the day of the week from the event date - FIXED
        const eventDay = getDayOfWeekFromDateString(eventDate);
        return `FREQ=WEEKLY;BYDAY=${eventDay}`;
      case "biweekly":
        // Use the day of the week from the event date - FIXED
        const biweeklyDay = getDayOfWeekFromDateString(eventDate);
        return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${biweeklyDay}`;
      case "monthly":
        // Use the day of the month from the event date - FIXED
        const { day } = getDayAndMonthFromDateString(eventDate);
        return `FREQ=MONTHLY;BYMONTHDAY=${day}`;
      case "yearly":
        // Use the day and month from the event date - FIXED
        const { day: yearlyDay, month: yearlyMonth } = getDayAndMonthFromDateString(eventDate);
        return `FREQ=YEARLY;BYMONTH=${yearlyMonth};BYMONTHDAY=${yearlyDay}`;
      default:
        return "";
    }
  };

  // Handle recurrence pattern change
  const handleRecurrenceChange = (value: string) => {
    if (value === "custom") {
      setShowCustomRecurrence(true);
      
      // Pre-populate with current selected days if they exist
      if (selectedEvent.recurrence_pattern && selectedEvent.recurrence_pattern.includes("BYDAY=")) {
        const daysPart = selectedEvent.recurrence_pattern.split("BYDAY=")[1];
        const days = daysPart.split(";")[0]; // Handle case where there might be more parameters after BYDAY
        setSelectedWeeklyDays(days.split(","));
      } else {
        setSelectedWeeklyDays([]);
      }
      
      // Extract interval if it exists
      if (selectedEvent.recurrence_pattern && selectedEvent.recurrence_pattern.includes("INTERVAL=")) {
        const interval = selectedEvent.recurrence_pattern.match(/INTERVAL=(\d+)/);
        if (interval) {
          setCustomInterval(parseInt(interval[1]));
        }
      } else {
        setCustomInterval(1);
      }
    } else {
      setShowCustomRecurrence(false);
      const rrule = humanReadableToRRULE(value, selectedEvent.date);
      onChange('recurrence_pattern', rrule);
    }
  };

  // Handle weekly days selection
  const handleWeeklyDayToggle = (day: string) => {
    setSelectedWeeklyDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  // Apply custom recurrence
  const handleCustomRecurrenceApply = () => {
    if (selectedWeeklyDays.length > 0) {
      let rrule = "FREQ=WEEKLY";
      if (customInterval > 1) {
        rrule += `;INTERVAL=${customInterval}`;
      }
      rrule += `;BYDAY=${selectedWeeklyDays.join(",")}`;
      onChange('recurrence_pattern', rrule);
    }
    setShowCustomRecurrence(false);
  };

  // Parse RRULE for display - IMPROVED VERSION
  const parseRRULEForDisplay = (rrule: string): string => {
    if (!rrule) return "No recurrence";
    
    if (rrule === "FREQ=DAILY") return "Daily";
    if (rrule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") return "Every weekday";
    if (rrule === "FREQ=WEEKLY;BYDAY=SA,SU") return "Every weekend";
    
    if (rrule.startsWith("FREQ=WEEKLY;BYDAY=")) {
      const daysPart = rrule.split("BYDAY=")[1];
      const days = daysPart.split(";")[0]; // Handle additional parameters
      const dayList = days.split(",");
      
      if (dayList.length === 1) {
        return `Weekly on ${dayMapping[dayList[0]] || dayList[0]}`;
      } else {
        const dayNames = dayList.map(day => dayMapping[day] || day).join(", ");
        return `Weekly on ${dayNames}`;
      }
    }
    
    if (rrule.includes("FREQ=WEEKLY;INTERVAL=2")) {
      const daysPart = rrule.split("BYDAY=")[1];
      const days = daysPart ? daysPart.split(";")[0] : "";
      if (days) {
        return `Bi-weekly on ${dayMapping[days] || days}`;
      }
      return "Bi-weekly";
    }
    
    if (rrule.startsWith("FREQ=WEEKLY") && !rrule.includes("BYDAY=")) {
      return "Weekly";
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
    
    // Handle complex custom patterns
    if (rrule.includes("FREQ=WEEKLY") && rrule.includes("BYDAY=")) {
      const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
      const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
      
      const daysPart = rrule.split("BYDAY=")[1];
      const days = daysPart.split(";")[0];
      const dayList = days.split(",");
      
      const dayNames = dayList.map(day => dayMapping[day] || day).join(", ");
      
      if (interval === 1) {
        return `Weekly on ${dayNames}`;
      } else {
        return `Every ${interval} weeks on ${dayNames}`;
      }
    }
    
    return rrule; // Show raw RRULE for very complex patterns
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

            {/* Custom recurrence selector */}
            {showCustomRecurrence && (
              <div className="form-grid-full">
                <label className="form-label">Repeat every</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={customInterval}
                    onChange={(e) => setCustomInterval(parseInt(e.target.value) || 1)}
                    style={{ width: '60px', padding: '5px' }}
                  />
                  <span>weeks on:</span>
                </div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {dayOptions.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleWeeklyDayToggle(day.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: selectedWeeklyDays.includes(day.value) ? '#007bff' : '#fff',
                        color: selectedWeeklyDays.includes(day.value) ? '#fff' : '#000',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleCustomRecurrenceApply}
                    className="modal-button modal-button-save"
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                    disabled={selectedWeeklyDays.length === 0}
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