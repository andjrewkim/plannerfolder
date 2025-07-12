import React, { useState, useEffect } from 'react';
import { createEvent } from '../services/apiService';
import { Clock, Calendar, MapPin, Tag, Repeat } from 'lucide-react';
import { authAPI } from '../../lib/auth';
import { RRule } from 'rrule';
import '../styles/eventform.css';

export interface EventData {
  id?: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  event_type: string;
  recurrence_pattern: string; // Now stores RRule string
  color: string;
  is_all_day: boolean;
  day_marking_title?: string;
  type?: string; // Backend field
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
  const [isTaskToday, setIsTaskToday] = useState(false);

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = (): string => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Helper function to parse RRule string into a readable format
  const parseRRuleString = (rruleString: string): RRule | null => {
    try {
      if (!rruleString || rruleString.trim() === '') return null;
      return RRule.fromString(rruleString);
    } catch (error) {
      console.error('Error parsing RRule:', error);
      return null;
    }
  };

  // Helper function to convert simple recurrence options to RRule strings
  const convertToRRuleString = (option: string): string => {
    const baseDate = new Date();
    
    switch (option) {
      case 'none':
        return '';
      case 'daily':
        return 'FREQ=DAILY;INTERVAL=1';
      case 'every_other_day':
        return 'FREQ=DAILY;INTERVAL=2';
      case 'weekdays':
        return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
      case 'weekends':
        return 'FREQ=WEEKLY;BYDAY=SA,SU';
      case 'weekly':
        return 'FREQ=WEEKLY;INTERVAL=1';
      case 'every_other_week':
        return 'FREQ=WEEKLY;INTERVAL=2';
      case 'monthly':
        return 'FREQ=MONTHLY;INTERVAL=1';
      case 'yearly':
        return 'FREQ=YEARLY;INTERVAL=1';
      default:
        return '';
    }
  };

  // Helper function to convert RRule string back to simple option for display
  const convertRRuleToSimpleOption = (rruleString: string): string => {
    if (!rruleString || rruleString.trim() === '') return 'none';
    
    try {
      const rrule = RRule.fromString(rruleString);
      const options = rrule.options;
      
      if (options.freq === RRule.DAILY) {
        if (options.interval === 1) return 'daily';
        if (options.interval === 2) return 'every_other_day';
      }
      
      if (options.freq === RRule.WEEKLY) {
        // Check for weekdays pattern
        if (options.byweekday && options.byweekday.length === 5) {
          const weekdayNumbers = options.byweekday.map(day => 
            typeof day === 'number'
              ? day
              : (typeof day === 'object' && 'weekday' in day ? (day as { weekday: number }).weekday : -1)
          ).sort();
          if (JSON.stringify(weekdayNumbers) === JSON.stringify([0, 1, 2, 3, 4])) {
            return 'weekdays';
          }
        }
        
        // Check for weekends pattern
        if (options.byweekday && options.byweekday.length === 2) {
          const weekendNumbers = options.byweekday.map(day => 
            typeof day === 'number' ? day : (typeof day === 'object' && day !== null && 'weekday' in day ? (day as { weekday: number }).weekday : -1)
          ).sort();
          if (JSON.stringify(weekendNumbers) === JSON.stringify([5, 6])) {
            return 'weekends';
          }
        }
        
        if (options.interval === 1) return 'weekly';
        if (options.interval === 2) return 'every_other_week';
      }
      
      if (options.freq === RRule.MONTHLY && options.interval === 1) return 'monthly';
      if (options.freq === RRule.YEARLY && options.interval === 1) return 'yearly';
      
      return 'none';
    } catch (error) {
      console.error('Error converting RRule to simple option:', error);
      return 'none';
    }
  };

  // Helper function to get additional details for recurrence (e.g., specific days)
  const getRecurrenceDetails = (rruleString: string): string => {
    if (!rruleString || rruleString.trim() === '') return '';
    
    try {
      const rrule = RRule.fromString(rruleString);
      const options = rrule.options;
      
      if (options.freq === RRule.WEEKLY && options.byweekday && options.byweekday.length === 1) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let dayIndex: number;
        if (typeof options.byweekday[0] === 'number') {
          dayIndex = options.byweekday[0];
        } else if (
          typeof options.byweekday[0] === 'object' &&
          options.byweekday[0] !== null &&
          'weekday' in options.byweekday[0]
        ) {
          dayIndex = (options.byweekday[0] as { weekday: number }).weekday;
        } else {
          dayIndex = -1;
        }
        return dayIndex >= 0 && dayIndex < dayNames.length ? `(${dayNames[dayIndex]})` : '';
      }
      
      if (options.freq === RRule.MONTHLY && options.bymonthday && options.bymonthday.length === 1) {
        const day = options.bymonthday[0];
        const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
        return `(${day}${suffix})`;
      }
      
      return '';
    } catch (error) {
      console.error('Error getting recurrence details:', error);
      return '';
    }
  };

  // Helper function to format RRule string for display
  const formatRRuleText = (rruleString: string): string => {
    if (!rruleString || rruleString.trim() === '') return 'Doesn\'t repeat';
    
    try {
      const rrule = RRule.fromString(rruleString);
      const options = rrule.options;
      
      if (options.freq === RRule.DAILY) {
        if (options.interval === 1) return 'Every day';
        if (options.interval === 2) return 'Every other day';
        return `Every ${options.interval} days`;
      }
      
      if (options.freq === RRule.WEEKLY) {
        // Check for weekdays pattern
        if (options.byweekday && options.byweekday.length === 5) {
          const weekdayNumbers = options.byweekday.map(day => 
            typeof day === 'number'
              ? day
              : (typeof day === 'object' && day !== null && 'weekday' in day
                  ? (day as { weekday: number }).weekday
                  : -1)
          ).sort();
          if (JSON.stringify(weekdayNumbers) === JSON.stringify([0, 1, 2, 3, 4])) {
            return 'Weekdays only (Mon-Fri)';
          }
        }
        
        // Check for weekends pattern
        if (options.byweekday && options.byweekday.length === 2) {
          const weekendNumbers = options.byweekday.map(day => 
            typeof day === 'number'
              ? day
              : (typeof day === 'object' && day !== null && 'weekday' in day
                  ? (day as { weekday: number }).weekday
                  : -1)
          ).sort();
          if (JSON.stringify(weekendNumbers) === JSON.stringify([5, 6])) {
            return 'Weekends only (Sat-Sun)';
          }
        }
        
        if (options.interval === 1) return 'Every week';
        if (options.interval === 2) return 'Every other week';
        return `Every ${options.interval} weeks`;
      }
      
      if (options.freq === RRule.MONTHLY) {
        return 'Every month';
      }
      
      if (options.freq === RRule.YEARLY) {
        return 'Every year';
      }
      
      // For complex rules, show the actual RRule string
      return rrule.toText();
    } catch (error) {
      console.error('Error formatting RRule:', error);
      return 'Custom recurrence pattern';
    }
  };

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
      
      // Process recurrence pattern - now expecting RRule string
      const processedRecurrence = 
        !data.recurrence_pattern || data.recurrence_pattern === ''
          ? ''
          : data.recurrence_pattern;
      
      // Determine if this is a task based on the parsed data
      const isTask = data.type === 'task' || data.event_type === 'task';
      
      // Add is_all_day field if it doesn't exist
      const processedData = {
        ...data,
        is_all_day: !data.start_time || !data.end_time || false,
        recurrence_pattern: processedRecurrence,
        event_type: isTask ? 'task' : (data.event_type || 'event') // Set event_type based on parsed data
      };
      
      // If there's no time specified, set default values
      if (!processedData.start_time) processedData.start_time = "00:00";
      if (!processedData.end_time && !isTask) processedData.end_time = "23:59";
      
      // For tasks, if no end time is specified, leave it empty (user can set it)
      if (isTask && !processedData.end_time) {
        processedData.end_time = "";
      }
      
      // Format the date properly to match yyyy-MM-dd
      if (processedData.date && processedData.date.includes('T')) {
        processedData.date = processedData.date.split('T')[0];
      }
      
      // Check if task date is today
      const todayDate = getTodayDate();
      const taskIsToday = processedData.date === todayDate;
      setIsTaskToday(taskIsToday);
      
      setParsedEventData(processedData);
      setEditedEventData(processedData);
      setIsModalVisible(true);
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
          // For tasks, set start_time to "00:00" and use end_time as the actual time
          formattedData.start_time = "00:00";
          // If no end time specified, set it to "00:00"
          if (!formattedData.end_time) {
            formattedData.end_time = "00:00";
          }
          formattedData.type = 'task'; // Send as 'type' not 'event_type'
          formattedData.location = ''; // Tasks don't have location
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
        setIsTaskToday(false);
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
    setIsTaskToday(false);
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
    
    const rruleString = convertToRRuleString(value);
    
    setEditedEventData({
      ...editedEventData,
      recurrence_pattern: rruleString
    });
  };

  const getRecurrenceDisplayValue = (): string => {
    if (!editedEventData?.recurrence_pattern) return 'none';
    return convertRRuleToSimpleOption(editedEventData.recurrence_pattern);
  };

  const handleEventTypeChange = (newType: 'event' | 'task') => {
    if (editedEventData) {
      const updatedData = { ...editedEventData, event_type: newType };
      
      // If switching to task, clear location, set sensible defaults
      if (newType === 'task') {
        updatedData.location = '';
        updatedData.is_all_day = false;
        updatedData.day_marking_title = '';
        updatedData.recurrence_pattern = ''; // Tasks don't have recurrence
        // Keep existing end_time if it exists, otherwise leave empty
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

  const handleTaskTodayToggle = () => {
    if (editedEventData) {
      const newValue = !isTaskToday;
      setIsTaskToday(newValue);
      
      const updatedData = { 
        ...editedEventData, 
        date: newValue ? getTodayDate() : editedEventData.date
      };
      
      setEditedEventData(updatedData);
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

              {/* Date and Today checkbox for tasks */}
              {editedEventData?.event_type === 'task' && (
                <>
                  <div className="detail-row task-today-toggle">
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={isTaskToday}
                        onChange={handleTaskTodayToggle}
                      />
                      <span className="custom-checkbox"></span>
                      Today task
                    </label>
                  </div>
                  
                    
                  {!isTaskToday && (
                    <div className="detail-row">
                      IN DEVELOPMENT
                      <Calendar className="icon" />
                      <input
                        type="date"
                        value={editedEventData?.date || ''}
                        onChange={(e) => handleEdit('date', e.target.value)}
                        className="detail-input"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Show date for events */}
              {editedEventData?.event_type !== 'task' && (
                <div className="detail-row">
                  <Calendar className="icon" />
                  <input
                    type="date"
                    value={editedEventData?.date || ''}
                    onChange={(e) => handleEdit('date', e.target.value)}
                    className="detail-input"
                  />
                </div>
              )}
              
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
                      All-day event
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
                      placeholder="Location (optional)"
                    />
                  </div>
                </>
              )}

              {/* For Tasks: No time input - tasks don't have specific times */}

              {/* Recurrence Pattern Section - ONLY for events */}
              {(editedEventData?.event_type === 'event' || editedEventData?.event_type === 'marking') && (
                <div className="detail-row recurrence-section">
                  <Repeat className="icon" />
                  <div className="recurrence-controls">
                    <div className="recurrence-input-group">
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
                </div>
              )}
            </div>

            <div className="button-group">
              <button 
                onClick={handleConfirm} 
                className="confirm-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : `Create ${editedEventData?.event_type === 'task' ? 'Task' : 'Event'}`}
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