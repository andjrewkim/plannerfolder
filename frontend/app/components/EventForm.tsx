import React, { useState } from 'react';
import { createEvent } from '../services/apiService';
import { Clock, Calendar, MapPin, Tag, Repeat } from 'lucide-react';
import { authAPI } from '../../lib/auth'; // Import the auth service
import '../styles/eventform.css';

export interface RecurrencePattern {
  type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  day?: number;
  days_of_week?: number[];
  end_date?: string;
  count?: number;
}

export interface EventData {
  id?: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  event_type: string;
  recurrence_pattern: RecurrencePattern;
  color: string;
  is_all_day: boolean;
  day_marking_title?: string;
}

interface EventFormProps {
  setResult: React.Dispatch<React.SetStateAction<EventData[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const EventForm: React.FC<EventFormProps> = ({ setResult, setError }) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [parsedEventData, setParsedEventData] = useState<EventData | null>(null);
  const [editedEventData, setEditedEventData] = useState<EventData | null>(null);

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Parse the event data only (not saving to backend yet)
      const response = await authAPI.authenticatedFetch('http://127.0.0.1:8000/api/schedule/parse/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input_text: inputText }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse event details');
      }

      const data = await response.json();
      
      // Process recurrence pattern
      const processedRecurrence =
        !data.recurrence_pattern || data.recurrence_pattern === ''
          ? { type: 'none', interval: 1, day: [] }
          : data.recurrence_pattern;
      
      // Add is_all_day field if it doesn't exist
      const processedData = {
        ...data,
        is_all_day: !data.start_time || !data.end_time || false,
        recurrence_pattern: processedRecurrence,
        event_type: 'event' // Always default to event initially, user can switch to task if needed
      };
      
      // If there's no time specified, set default values
      if (!processedData.start_time) processedData.start_time = "00:00";
      if (!processedData.end_time) processedData.end_time = "23:59";
      
      // Format the date properly to match yyyy-MM-dd
      if (processedData.date && processedData.date.includes('T')) {
        processedData.date = processedData.date.split('T')[0];
      }
      
      setParsedEventData(processedData);
      setEditedEventData(processedData);
      setIsModalVisible(true); // Remove the delay that was causing animation issues
      setError(null);
      setIsError(false);
    } catch (err) {
      console.error(err);
      setError('Failed to parse event details. Please try again.');
      setIsError(true);
      setTimeout(() => setIsError(false), 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (editedEventData) {
      setIsSubmitting(true);
      
      try {
        // Format date before submission if needed
        const formattedData = { ...editedEventData };
        
        // Handle different event types
        if (editedEventData.event_type === 'task') {
          // Tasks don't need end_time or location
          if (!formattedData.start_time) {
            formattedData.start_time = "00:00";
          }
          formattedData.end_time = formattedData.start_time; // Set end time same as start for tasks
          formattedData.type = 'task'; // Send as 'type' not 'event_type'
        } else if (editedEventData.event_type === 'event') {
          // Regular events
          formattedData.type = 'event'; // Send as 'type' not 'event_type'
        } else if (editedEventData.event_type === 'marking') {
          // All-day events (markings)
          formattedData.start_time = "00:00";
          formattedData.end_time = "23:59";
          formattedData.day_marking_title = formattedData.event_name;
          formattedData.type = 'marking'; // Send as 'type' not 'event_type'
        }
        
        // Keep event_type for frontend consistency but also send type for backend
        formattedData.event_type = editedEventData.event_type;
        
        // Now save to backend using the original endpoint
        console.log('Sending event data to backend:', { input_text: inputText, ...formattedData });
        const response = await authAPI.authenticatedFetch('http://127.0.0.1:8000/api/schedule/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input_text: inputText, ...formattedData }),
        });

        if (!response.ok) {
          throw new Error('Failed to save event');
        }

        const savedData = await response.json();
        
        setResult((prevState) => Array.isArray(prevState) ? [...prevState, savedData] : [savedData]);
        setInputText('');
        setIsModalVisible(false);
        setParsedEventData(null);
        setEditedEventData(null);
      } catch (err) {
        console.error(err);
        setError('Failed to save event. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setParsedEventData(null);
    setEditedEventData(null);
  };

  const handleEdit = (field: keyof EventData, value: string | boolean) => {
    if (editedEventData) {
      const updatedData = { ...editedEventData, [field]: value };
      
      // If event_name is being changed and it's marked as all-day, update day_marking_title too
      if (field === 'event_name' && editedEventData.is_all_day) {
        updatedData.day_marking_title = value as string;
      }
      
      setEditedEventData(updatedData);
    }
  };

  const handleSimpleRecurrenceChange = (value: string) => {
    if (!editedEventData) return;
    
    let recurrencePattern: RecurrencePattern;
    
    switch (value) {
      case 'none':
        recurrencePattern = { type: 'none', interval: 1 };
        break;
      case 'daily':
        recurrencePattern = { type: 'daily', interval: 1 };
        break;
      case 'every_other_day':
        recurrencePattern = { type: 'daily', interval: 2 };
        break;
      case 'weekdays':
        recurrencePattern = { type: 'weekly', interval: 1, days_of_week: [1, 2, 3, 4, 5] }; // Mon-Fri
        break;
      case 'weekends':
        recurrencePattern = { type: 'weekly', interval: 1, days_of_week: [0, 6] }; // Sat-Sun
        break;
      case 'weekly':
        recurrencePattern = { type: 'weekly', interval: 1 };
        break;
      case 'every_other_week':
        recurrencePattern = { type: 'weekly', interval: 2 };
        break;
      case 'monthly':
        recurrencePattern = { type: 'monthly', interval: 1 };
        break;
      case 'yearly':
        recurrencePattern = { type: 'yearly', interval: 1 };
        break;
      default:
        recurrencePattern = { type: 'none', interval: 1 };
    }
    
    setEditedEventData({
      ...editedEventData,
      recurrence_pattern: recurrencePattern
    });
  };

  const getRecurrenceDisplayValue = (): string => {
    if (!editedEventData?.recurrence_pattern) return 'none';
    
    const pattern = editedEventData.recurrence_pattern;
    
    if (pattern.type === 'none') return 'none';
    
    if (pattern.type === 'daily') {
      if (pattern.interval === 1) return 'daily';
      if (pattern.interval === 2) return 'every_other_day';
    }
    
    if (pattern.type === 'weekly') {
      if (pattern.days_of_week && pattern.days_of_week.length === 5 && 
          pattern.days_of_week.includes(1) && pattern.days_of_week.includes(5)) {
        return 'weekdays';
      }
      if (pattern.days_of_week && pattern.days_of_week.length === 2 && 
          pattern.days_of_week.includes(0) && pattern.days_of_week.includes(6)) {
        return 'weekends';
      }
      if (pattern.interval === 1) return 'weekly';
      if (pattern.interval === 2) return 'every_other_week';
    }
    
    if (pattern.type === 'monthly' && pattern.interval === 1) return 'monthly';
    if (pattern.type === 'yearly' && pattern.interval === 1) return 'yearly';
    
    return 'none';
  };

  const handleEventTypeChange = (newType: 'event' | 'task') => {
    if (editedEventData) {
      const updatedData = { ...editedEventData, event_type: newType };
      
      // If switching to task, clear end_time and location, set sensible defaults
      if (newType === 'task') {
        updatedData.end_time = '';
        updatedData.location = '';
        updatedData.is_all_day = false;
        updatedData.day_marking_title = '';
      }
      // If switching to event, ensure we have end_time
      else if (newType === 'event') {
        if (!updatedData.end_time) {
          updatedData.end_time = "23:59";
        }
      }
      
      setEditedEventData(updatedData);
    }
  };

  const toggleAllDayEvent = () => {
    if (editedEventData) {
      const newValue = !editedEventData.is_all_day;
      const updatedData = { 
        ...editedEventData, 
        is_all_day: newValue,
      };
      
      // If marking as all-day (important day), set day_marking_title to event_name
      if (newValue) {
        updatedData.day_marking_title = editedEventData.event_name;
        updatedData.event_type = 'marking';
      } else {
        updatedData.day_marking_title = '';
        updatedData.event_type = 'event';
      }
      
      setEditedEventData(updatedData);
    }
  };

  const formatRecurrenceText = (pattern: RecurrencePattern): string => {
    if (!pattern || pattern.type === 'none') return 'Doesn\'t repeat';
    
    switch (pattern.type) {
      case 'daily':
        if (pattern.interval === 1) return 'Every day';
        if (pattern.interval === 2) return 'Every other day';
        return `Every ${pattern.interval} days`;
      case 'weekly':
        if (pattern.days_of_week && pattern.days_of_week.length === 5 && 
            pattern.days_of_week.includes(1) && pattern.days_of_week.includes(5)) {
          return 'Weekdays only (Mon-Fri)';
        }
        if (pattern.days_of_week && pattern.days_of_week.length === 2 && 
            pattern.days_of_week.includes(0) && pattern.days_of_week.includes(6)) {
          return 'Weekends only (Sat-Sun)';
        }
        if (pattern.interval === 1) return 'Every week';
        if (pattern.interval === 2) return 'Every other week';
        return `Every ${pattern.interval} weeks`;
      case 'monthly':
        return 'Every month';
      case 'yearly':
        return 'Every year';
      default:
        return 'Doesn\'t repeat';
    }
  };

  return (
    <div className="event-form-container ml-[320px] w-[calc(100%-320px)]">
      <form 
        onSubmit={handleInitialSubmit} 
        className={`event-form ${isError ? 'error-shake' : ''}`}
      >
        <div className="form-content">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter event details..."
            className="event-textarea"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting || !inputText.trim()}
          >
            {isSubmitting ? 'Processing...' : 'Process Event'}
            {isSubmitting && <span className="loading-spinner" />}
          </button>
        </div>
      </form>

      {parsedEventData && (
        <div className={`event-confirmation-modal ${isModalVisible ? 'show' : ''}`}>
          <div className="modal-content">
            <h3>Confirm Event Details</h3>
            
            {/* Event Type Switcher */}
            <div className="event-type-switcher">
              <button
                type="button"
                className={`type-tab ${editedEventData?.event_type === 'event' ? 'active' : ''}`}
                onClick={() => handleEventTypeChange('event')}
              >
                Event
              </button>
              <button
                type="button"
                className={`type-tab ${editedEventData?.event_type === 'task' ? 'active' : ''}`}
                onClick={() => handleEventTypeChange('task')}
              >
                Task
              </button>
            </div>
            
            <div className="detail-group">
              <div className="detail-row">
                <Tag className="icon" />
                <input
                  value={editedEventData?.event_name || ''}
                  onChange={(e) => handleEdit('event_name', e.target.value)}
                  className="detail-input"
                  placeholder={editedEventData?.event_type === 'task' ? 'Task name' : 'Event name'}
                />
              </div>

              {/* Show date for both events and tasks */}
              <div className="detail-row">
                <Calendar className="icon" />
                <input
                  type="date"
                  value={editedEventData?.date || ''}
                  onChange={(e) => handleEdit('date', e.target.value)}
                  className="detail-input"
                />
              </div>
              
              {/* For Events: Show all-day toggle and full time controls */}
              {(editedEventData?.event_type === 'event' || editedEventData?.event_type === 'marking') && (
                <>
                  {/* All-day event toggle - ALWAYS shown for events */}
                  <div className="detail-row all-day-toggle">
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={editedEventData?.is_all_day || false}
                        onChange={toggleAllDayEvent}
                      />
                      <span className="custom-checkbox"></span>
                      Mark as all-day event
                    </label>
                  </div>

                  {/* Show time inputs only if not an all-day event */}
                  {!editedEventData?.is_all_day && (
                    <div className="detail-row">
                      <Clock className="icon" />
                      <div className="time-inputs">
                        <input
                          type="time"
                          value={editedEventData?.start_time || ''}
                          onChange={(e) => handleEdit('start_time', e.target.value)}
                          className="detail-input"
                        />
                        <span>to</span>
                        <input
                          type="time"
                          value={editedEventData?.end_time || ''}
                          onChange={(e) => handleEdit('end_time', e.target.value)}
                          className="detail-input"
                        />
                      </div>
                    </div>
                  )}

                  <div className="detail-row">
                    <MapPin className="icon" />
                    <input
                      value={editedEventData?.location || ''}
                      onChange={(e) => handleEdit('location', e.target.value)}
                      className="detail-input"
                      placeholder="Location"
                    />
                  </div>
                </>
              )}

              {/* For Tasks: Show optional start time only */}
              {editedEventData?.event_type === 'task' && (
                <div className="detail-row">
                  <Clock className="icon" />
                  <div className="task-time-input">
                    <input
                      type="time"
                      value={editedEventData?.start_time || ''}
                      onChange={(e) => handleEdit('start_time', e.target.value)}
                      className="detail-input"
                      placeholder="Start time (optional)"
                    />
                    <span className="time-help">Start time (optional)</span>
                  </div>
                </div>
              )}

              {/* Recurrence Pattern Section - ONLY for events */}
              {(editedEventData?.event_type === 'event' || editedEventData?.event_type === 'marking') && (
                <div className="detail-row recurrence-section">
                  <Repeat className="icon" />
                  <div className="recurrence-controls">
                    <select
                      value={getRecurrenceDisplayValue()}
                      onChange={(e) => handleSimpleRecurrenceChange(e.target.value)}
                      className="detail-input"
                    >
                      <option value="none">Doesn't repeat</option>
                      <option value="daily">Every day</option>
                      <option value="every_other_day">Every other day</option>
                      <option value="weekdays">Weekdays only (Mon-Fri)</option>
                      <option value="weekends">Weekends only (Sat-Sun)</option>
                      <option value="weekly">Every week</option>
                      <option value="every_other_week">Every other week</option>
                      <option value="monthly">Every month</option>
                      <option value="yearly">Every year</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="button-group">
              <button 
                onClick={handleConfirm} 
                className="confirm-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Create Event'}
              </button>
              <button 
                onClick={handleCancel} 
                className="cancel-button"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventForm;