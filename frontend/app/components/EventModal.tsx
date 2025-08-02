import React, { useEffect, useRef, useState } from 'react';
import '../styles/modalstyle.css';

interface EventDetails {
  eventId: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
  recurrence_pattern: string;
  color: string;
  all_day: boolean;
  day_marking_title?: string;
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
  calendarContainerRef?: React.RefObject<HTMLElement>; // Add this prop
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  selectedEvent,
  position,
  onSubmit,
  onDelete,
  onChange,
  calendarContainerRef, // Add this prop
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [finalPosition, setFinalPosition] = useState<React.CSSProperties>({});
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);
  const [selectedWeeklyDays, setSelectedWeeklyDays] = useState<string[]>([]);
  const [customInterval, setCustomInterval] = useState<number>(1);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLocationNotes, setShowLocationNotes] = useState(false);
  
  // Preset color options
  const presetColors = [
    '#FF3B30', // Red
    '#FF9500', // Orange
    '#FFCC00', // Yellow
    '#34C759', // Green
    '#007AFF', // Blue
    '#5856D6', // Indigo
    '#AF52DE', // Violet
    '#FF2D55'  // Pink 
  ];

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

  const getDayOfWeekFromDateString = (dateString: string): string => {
    const [year, month, day] = dateString.split('-').map(Number);
    
    let q = day;
    let m = month;
    let y = year;
    
    if (m < 3) {
      m += 12;
      y -= 1;
    }
    
    const k = y % 100;
    const j = Math.floor(y / 100);
    
    const h = (q + Math.floor((13 * (m + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) - 2 * j) % 7;
    
    const dayAbbrevs = ['SA', 'SU', 'MO', 'TU', 'WE', 'TH', 'FR'];
    return dayAbbrevs[h];
  };

  const getDayAndMonthFromDateString = (dateString: string): { day: number, month: number } => {
    const [year, month, day] = dateString.split('-').map(Number);
    return { day, month };
  };

  // Updated function to calculate position with smart left/right positioning
  const calculateModalPosition = (): React.CSSProperties => {
    if (!position || !modalRef.current) {
      return { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    // Get container bounds (calendar or viewport)
    let containerRect;
    if (calendarContainerRef?.current) {
      containerRect = calendarContainerRef.current.getBoundingClientRect();
    } else {
      containerRect = {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
        width: window.innerWidth,
        height: window.innerHeight
      };
    }

    // Get modal dimensions
    const modalRect = modalRef.current.getBoundingClientRect();
    const modalWidth = modalRect.width || 340; // fallback width
    const modalHeight = modalRect.height || 411; // fallback height

    // Define consistent offset distances
    const horizontalOffset = 50; // Distance from event horizontally
    const verticalOffset = 150; // Distance from event vertically (upward)
    const padding = 20; // Minimum distance from container edges

    // Calculate preferred position (right side of event, above it)
    let xPos = position.x - horizontalOffset;
    let yPos = position.y - verticalOffset;

    // Check if modal would go outside the right boundary
    const wouldExceedRight = (position.x - horizontalOffset + modalWidth) > (containerRect.right - padding);
    
    // If it would exceed the right boundary, position it on the left side of the event
    if (wouldExceedRight) {
      xPos = position.x - modalWidth - + horizontalOffset; // Left side, maintaining same distance
    }

    // Vertical positioning with boundary checks
    if (yPos + modalHeight > containerRect.bottom - padding) {
      yPos = containerRect.bottom - modalHeight - padding;
    }
    
    if (yPos < containerRect.top + padding) {
      yPos = containerRect.top + padding;
    }

    // Final horizontal boundary checks (in case left positioning also doesn't fit)
    if (xPos < containerRect.left + padding) {
      xPos = containerRect.left + padding;
    }
    
    if (xPos + modalWidth > containerRect.right - padding) {
      xPos = containerRect.right - modalWidth - padding;
    }

    // If using calendar container, convert to absolute positioning within the container
    if (calendarContainerRef?.current) {
      const containerStyle = window.getComputedStyle(calendarContainerRef.current);
      const containerPosition = containerStyle.position;
      
      if (containerPosition === 'relative' || containerPosition === 'absolute') {
        // Position relative to the container
        xPos = xPos - containerRect.left;
        yPos = yPos - containerRect.top;
      }
    }

    return {
      position: 'absolute',
      top: `${Math.max(0, yPos)}px`,
      left: `${Math.max(0, xPos)}px`,
      maxHeight: `${Math.min(containerRect.height * 0.8, 600)}px`,
      overflowY: 'auto'
    };
  };
  
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      
      // Calculate position immediately without delay
      if (modalRef.current && position) {
        const newPosition = calculateModalPosition();
        setFinalPosition(newPosition);
      } else {
        // Fallback for initial render
        setFinalPosition({
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxHeight: '80vh',
          overflowY: 'auto'
        });
      }
    } else {
      document.body.classList.remove('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, position]);

  // Additional useEffect to recalculate position after modal content loads
  useEffect(() => {
    if (isOpen && modalRef.current && position) {
      // Small delay only for recalculation after content loads
      const timeoutId = setTimeout(() => {
        const newPosition = calculateModalPosition();
        setFinalPosition(newPosition);
      }, 1);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, position, showCustomRecurrence]); // Recalculate when content changes
  
  if (!isOpen || !selectedEvent) return null;
  
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
    document.body.classList.remove('modal-open');
    setShowCustomRecurrence(false);
    setSelectedWeeklyDays([]);
    setCustomInterval(1);
    setShowColorPicker(false);
    setShowLocationNotes(false);
    onClose();
  };

  const rruleToHumanReadable = (rrule: string): string => {
    if (!rrule) return "";
    
    if (rrule === "FREQ=DAILY") return "daily";
    if (rrule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") return "weekdays";
    if (rrule === "FREQ=WEEKLY;BYDAY=SA,SU") return "weekends";
    if (rrule.startsWith("FREQ=WEEKLY;BYDAY=")) {
      const days = rrule.split("BYDAY=")[1];
      const dayList = days.split(",");
      
      if (dayList.length === 1) {
        return "weekly";
      }
      
      if (dayList.sort().join(",") === "MO,TU,WE,TH,FR") return "weekdays";
      if (dayList.sort().join(",") === "SA,SU") return "weekends";
      
      return "custom";
    }
    if (rrule.startsWith("FREQ=WEEKLY;INTERVAL=2")) return "biweekly";
    if (rrule.startsWith("FREQ=MONTHLY")) return "monthly";
    if (rrule.startsWith("FREQ=YEARLY")) return "yearly";
    if (rrule.startsWith("FREQ=WEEKLY") && !rrule.includes("BYDAY=")) return "weekly";
    
    return "custom";
  };

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
        const eventDay = getDayOfWeekFromDateString(eventDate);
        return `FREQ=WEEKLY;BYDAY=${eventDay}`;
      case "biweekly":
        const biweeklyDay = getDayOfWeekFromDateString(eventDate);
        return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${biweeklyDay}`;
      case "monthly":
        const { day } = getDayAndMonthFromDateString(eventDate);
        return `FREQ=MONTHLY;BYMONTHDAY=${day}`;
      case "yearly":
        const { day: yearlyDay, month: yearlyMonth } = getDayAndMonthFromDateString(eventDate);
        return `FREQ=YEARLY;BYMONTH=${yearlyMonth};BYMONTHDAY=${yearlyDay}`;
      default:
        return "";
    }
  };

  const handleRecurrenceChange = (value: string) => {
    if (value === "custom") {
      setShowCustomRecurrence(true);
      
      if (selectedEvent.recurrence_pattern && selectedEvent.recurrence_pattern.includes("BYDAY=")) {
        const daysPart = selectedEvent.recurrence_pattern.split("BYDAY=")[1];
        const days = daysPart.split(";")[0];
        setSelectedWeeklyDays(days.split(","));
      } else {
        setSelectedWeeklyDays([]);
      }
      
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

  const handleWeeklyDayToggle = (day: string) => {
    setSelectedWeeklyDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

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

  const handleColorSelect = (color: string) => {
    onChange('color', color);
    setShowColorPicker(false);
  };

  const currentRecurrenceValue = rruleToHumanReadable(selectedEvent.recurrence_pattern);

  return (
    <div className="overflow-hidden">
      <div className="modal-overlay">
        <div 
          ref={modalRef} 
          className="modal-container compact-modal" 
          style={finalPosition}
        >
          <h2 className="modal-header">
            {selectedEvent.eventId ? "Edit Event" : "Add New Event"}
          </h2>
          <form onSubmit={onSubmit}>
            <div className="form-row">
              <div className="form-field-full">
                <label className="form-label">Event Name</label>
                <input
                  type="text"
                  value={selectedEvent.event_name}
                  onChange={(e) => onChange('event_name', e.target.value)}
                  className="modal-input"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  value={selectedEvent.date}
                  onChange={(e) => onChange('date', e.target.value)}
                  className="modal-input"
                  required
                />
              </div>
              <div className="form-field">
                <label className="checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={selectedEvent.all_day}
                    onChange={(e) => onChange('all_day', e.target.checked)}
                    className="modal-checkbox"
                  />
                  <span>All Day</span>
                </label>
              </div>
            </div>

            {!selectedEvent.all_day && (
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    value={selectedEvent.start_time}
                    onChange={(e) => onChange('start_time', e.target.value)}
                    className="modal-input"
                    required={!selectedEvent.all_day}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    value={selectedEvent.end_time}
                    onChange={(e) => onChange('end_time', e.target.value)}
                    className="modal-input"
                    required={!selectedEvent.all_day}
                  />
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-field">
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
              </div>
              <div className="form-field">
                <label className="form-label">Color</label>
                <div className="color-picker-container">
                  <div 
                    className="color-swatch"
                    style={{ backgroundColor: selectedEvent.color || "#FF6B6B" }}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                  />
                  {showColorPicker && (
                    <div className="color-picker-modal">
                      <div className="color-grid">
                        {presetColors.map((color) => (
                          <div
                            key={color}
                            className="color-option"
                            style={{ backgroundColor: color }}
                            onClick={() => handleColorSelect(color)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {showCustomRecurrence && (
              <div className="custom-recurrence-section">
                <label className="form-label">Repeat every</label>
                <div className="custom-recurrence-controls">
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={customInterval}
                    onChange={(e) => setCustomInterval(parseInt(e.target.value) || 1)}
                    className="interval-input"
                  />
                  <span>weeks on:</span>
                </div>
                <div className="day-selector">
                  {dayOptions.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleWeeklyDayToggle(day.value)}
                      className={`day-button ${selectedWeeklyDays.includes(day.value) ? 'selected' : ''}`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <div className="custom-recurrence-buttons">
                  <button
                    type="button"
                    onClick={handleCustomRecurrenceApply}
                    className="apply-button"
                    disabled={selectedWeeklyDays.length === 0}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomRecurrence(false)}
                    className="cancel-button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showLocationNotes && (
              <div className="poopface">
                <div className="form-row">
                  <div className="form-field-full">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      value={selectedEvent.location}
                      onChange={(e) => onChange('location', e.target.value)}
                      className="modal-input"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field-full">
                    <label className="form-label">Notes</label>
                    <textarea
                      value={selectedEvent.notes}
                      onChange={(e) => onChange('notes', e.target.value)}
                      className="modal-textarea"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="modal-buttons">
              <button type="submit" className="modal-button modal-button-save">
                {selectedEvent.eventId ? "Save" : "Create"}
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
    </div>
  );
};

export default EventModal;