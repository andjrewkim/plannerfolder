import React, { useState, useEffect, useRef } from 'react';
import { createEvent } from '../services/apiService';
import { Clock, Calendar, MapPin, Tag, Repeat, Check, X } from 'lucide-react';
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
  recurrence_pattern: string;
  color: string;
  is_all_day: boolean;
  day_marking_title?: string;
  type?: string;
}

interface EventFormProps {
  setResult: React.Dispatch<React.SetStateAction<EventData[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  onEventResult?: (results: EventData[]) => void;

}


const recurrenceOptions = [
  { value: 'none', label: "Doesn't repeat" },
  { value: 'daily', label: 'Every day' },
  { value: 'every_other_day', label: 'Every other day' },
  { value: 'weekdays', label: 'Weekdays only (Mon-Fri)' },
  { value: 'weekends', label: 'Weekends only (Sat-Sun)' },
  { value: 'weekly', label: 'Every week' },
  { value: 'every_other_week', label: 'Every other week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' }
];


const EventForm: React.FC<EventFormProps> = ({ setResult, setError, onEventResult }) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isError, setIsError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [parsedEventData, setParsedEventData] = useState<EventData | null>(null);
  const [editedEventData, setEditedEventData] = useState<EventData | null>(null);
  const [isTaskToday, setIsTaskToday] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = (): string => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Helper function to apply default values for missing data
  const applyDefaults = (data: any): EventData => {
    const todayDate = getTodayDate();
    
    return {
      ...data,
      // Set default date to today if missing or invalid
      date: data.date && data.date.trim() !== '' ? data.date : todayDate,
      // Set default times to 09:00 (9 AM) if missing - more user-friendly than 00:00
      start_time: data.start_time && data.start_time.trim() !== '' ? data.start_time : "09:00",
      end_time: data.end_time && data.end_time.trim() !== '' ? data.end_time : "10:00",
      // Ensure other required fields have defaults
      event_name: data.event_name || '',
      location: data.location || '',
      event_type: data.event_type || 'event',
      recurrence_pattern: data.recurrence_pattern || '',
      color: data.color || '#1A73E8',
      is_all_day: data.is_all_day || false
    };
  };

  // Helper function to convert simple recurrence options to RRule strings
  const convertToRRuleString = (option: string): string => {
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

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    
    try {
      // Parse the event data
      const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/schedule/parse/`, {
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
          ? ''
          : data.recurrence_pattern;
      
      // Determine if this is a task
      const isTask = data.type === 'task' || data.event_type === 'task';
      
      // Process the data with defaults applied
      let processedData = {
        ...data,
        is_all_day: !data.start_time || !data.end_time || false,
        recurrence_pattern: processedRecurrence,
        event_type: isTask ? 'task' : (data.event_type || 'event')
      };
      
      // Apply defaults for missing data
      processedData = applyDefaults(processedData);
      
      // Handle task-specific logic
      if (isTask && !processedData.end_time) {
        processedData.end_time = "";
      }
      
      // Format date if it includes time
      if (processedData.date && processedData.date.includes('T')) {
        processedData.date = processedData.date.split('T')[0];
      }
      
      // Check if task is today
      const todayDate = getTodayDate();
      const taskIsToday = processedData.date === todayDate;
      setIsTaskToday(taskIsToday);
      
      setParsedEventData(processedData);
      setEditedEventData(processedData);
      setShowDetails(true);
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
        // Format data for backend
        const formattedData = { ...editedEventData };
        
        if (editedEventData.event_type === 'task') {
          formattedData.start_time = "09:00";
          if (!formattedData.end_time) {
            formattedData.end_time = "09:00";
          }
          formattedData.type = 'task';
          formattedData.location = '';
        } else if (editedEventData.event_type === 'event') {
          formattedData.type = 'event';
        } else if (editedEventData.event_type === 'marking') {
          formattedData.start_time = "00:00";
          formattedData.end_time = "23:59";
          formattedData.day_marking_title = formattedData.event_name;
          formattedData.type = 'marking';
        }
        
        formattedData.event_type = editedEventData.event_type;
        
        // Save to backend
        const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/schedule/`, {
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
        setSuccessMessage(`${editedEventData.event_type === 'task' ? 'Task' : 'Event'} created successfully!`);
        
        if (onEventResult) {
          onEventResult([savedData]); // or whatever format you need
        }

        // Clear form after successful submission
        setTimeout(() => {
          setInputText('');
          setShowDetails(false);
          setParsedEventData(null);
          setEditedEventData(null);
          setIsTaskToday(false);
          setSuccessMessage(null);
        }, 1500);
        
      } catch (err) {
        console.error(err);
        setError('Failed to save event. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCancel = () => {
    setShowDetails(false);
    setParsedEventData(null);
    setEditedEventData(null);
    setIsTaskToday(false);
    setSuccessMessage(null);
  };

  const handleEdit = (field: keyof EventData, value: string | boolean) => {
    if (editedEventData) {
      const updatedData = { ...editedEventData, [field]: value };
      
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
      
      if (newType === 'task') {
        updatedData.location = '';
        updatedData.is_all_day = false;
        updatedData.day_marking_title = '';
        updatedData.recurrence_pattern = '';
      } else if (newType === 'event') {
        if (!updatedData.end_time) {
          updatedData.end_time = "10:00";
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
      
      if (newValue) {
        // For all-day events, set times to 00:00
        updatedData.start_time = "00:00";
        updatedData.end_time = "00:00";
        updatedData.day_marking_title = editedEventData.event_name;
        updatedData.event_type = 'marking';
      } else {
        updatedData.day_marking_title = '';
        updatedData.event_type = 'event';
        // Set default times to 9:00 AM and 10:00 AM when switching back from all-day
        updatedData.start_time = "09:00";
        updatedData.end_time = "10:00";
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
    <div className="event-form-container" style={{ padding: '4px' }}>
      {/* Input Field - Only show when not showing details */}
      {!showDetails && (
        <div className={`event-form-wrapper ${isError ? 'error-shake' : ''}`} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          backgroundColor: 'hsl(var(--input-bg))',
          border: '1px solid hsl(var(--border-color))',
          borderRadius: '4px',
          padding: '8px',
          animation: isError ? 'shake 0.5s' : 'none'
        }}>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter event details..."
            className="event-textarea"
            disabled={isSubmitting}
            style={{
              flex: 1,
              minHeight: '24px',
              resize: 'none',
              overflow: 'hidden',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '14px',
              fontFamily: 'inherit',
              lineHeight: '1.4',
              color: 'hsl(var(--text-color))'
            }}
          />
          <button
            onClick={handleInitialSubmit}
            disabled={isSubmitting || !inputText.trim()}
            className="p-3 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
            style={{
              backgroundColor: !inputText.trim() || isSubmitting 
                ? 'hsl(var(--muted))' 
                : '#1A73E8',
              color: !inputText.trim() || isSubmitting 
                ? 'hsl(var(--muted-foreground))' 
                : 'hsl(var(--primary-foreground))',
              ':hover': {
                backgroundColor: 'hsl(var(--primary) / 0.9)'
              }
            } as React.CSSProperties}
          >
            {isSubmitting ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid transparent',
                borderTop: '2px solid currentColor',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <Check size={16} />
            )}
          </button>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="success-message" style={{
          backgroundColor: 'hsl(var(--success-bg))',
          color: 'hsl(var(--success-text))',
          padding: '8px 12px',
          borderRadius: '4px',
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px'
        }}>
          <Check size={16} />
          {successMessage}
        </div>
      )}

      {/* Event Details Section */}
      {showDetails && editedEventData && (() => {
        const activeType =
          editedEventData.event_type === 'marking'
            ? 'event'
            : editedEventData.event_type;

        return (
        <div className="event-details-section" style={{
          marginTop: '-14px',
          padding: '0px',
          backgroundColor: 'hsl(var(--input-bg))',
          borderRadius: '4px',
          border: 'none',
          width: '100%'
        }}>
                    
          {/* Event Type Switcher */}
          <div className="event-type-switcher" style={{
            display: 'flex',
            marginBottom: '2px',
            backgroundColor: 'hsl(var(--tab-bg))',
            borderRadius: '4px',
            padding: '2px'
          }}>
            <button
              type="button"
              className={`type-tab ${activeType === 'event' ? 'active' : ''}`}
              onClick={() => handleEventTypeChange('event')}
              style={{
                flex: 1,
                padding: '2px 16px',
                border: 'none',
                borderRadius: '2px',
                backgroundColor: activeType === 'event' ? 'hsl(var(--muted-foreground) / 0.4)' : 'hsl(var(--background))',
                color: activeType === 'event' ? 'hsl(var(--primary-text))' : 'hsl(var(--text-muted))',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Event
            </button>
            <button
              type="button"
              className={`type-tab ${activeType === 'task' ? 'active' : ''}`}
              onClick={() => handleEventTypeChange('task')}
              style={{
                flex: 1,
                padding: '2px 16px',
                border: 'none',
                borderRadius: '2px',
                backgroundColor: activeType === 'task' ? 'hsl(var(--muted-foreground) / 0.4)' : 'hsl(var(--background))',
                color: activeType === 'task' ? 'hsl(var(--primary-text))' : 'hsl(var(--text-muted))',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Task
            </button>
          </div>
          
          <div
            className="detail-group"
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '4px',
              backgroundColor: 'hsl(var(--input-bg))',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            {/* Event Name */}
            <div
              className="detail-row"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px' }}
            >
              <Tag size={14} color="hsl(var(--border))" />
              <input
                value={editedEventData.event_name || ''}
                onChange={(e) => handleEdit('event_name', e.target.value)}
                className="detail-input"
                placeholder={
                  editedEventData.event_type === 'task' ? 'Task name' : 'Event name'
                }
                style={{
                  flex: 1,
                  padding: '2px 4px',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '13px',
                  minHeight: '20px',
                  margin: 0,
                  backgroundColor: 'hsl(var(--input-field-bg))',
                  color: 'hsl(var(--text-color))'
                }}
              />
            </div>

            {/* Task Today Toggle */}
            {editedEventData.event_type === 'task' && (
              <div
                className="detail-row"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  padding: '4px'
                }}
              >
                <Tag size={14} color="transparent" style={{ visibility: 'hidden' }} />
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    margin: 0,
                    padding: 0,
                    color: 'hsl(var(--text-color))'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isTaskToday}
                    onChange={handleTaskTodayToggle}
                    style={{ width: '14px', height: '14px', margin: 0, padding: 0 }}
                  />
                  Today task
                </label>
              </div>
            )}

            {/* Date */}
            {(editedEventData.event_type !== 'task' || !isTaskToday) && (
              <div
                className="detail-row"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  padding: '4px'
                }}
              >
                <Calendar size={14} color="hsl(var(--border))" />
                <input
                  type="date"
                  value={editedEventData.date || ''}
                  onChange={(e) => handleEdit('date', e.target.value)}
                  className="detail-input date-input"
                  style={{
                    flex: 1,
                    padding: '2px 4px',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '13px',
                    minHeight: '20px',
                    margin: 0,
                    backgroundColor: 'hsl(var(--input-field-bg))',
                    color: 'hsl(var(--text-color))',
                    colorScheme: 'dark'
                  }}
                />
              </div>
            )}
         
            {/* Event-specific fields */}
            {(editedEventData.event_type === 'event' || editedEventData.event_type === 'marking') && (
              <>
                {/* All-day toggle */}
                <div className="detail-row" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  padding: '2px'
                }}>
                  <Tag size={14} color="transparent" style={{ visibility: 'hidden' }} />
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '3px', 
                    cursor: 'pointer', 
                    fontSize: '13px',
                    color: 'hsl(var(--text-color))'
                  }}>
                    <input
                      type="checkbox"
                      checked={editedEventData.is_all_day || false}
                      onChange={toggleAllDayEvent}
                      style={{ width: '14px', height: '14px' }}
                    />
                    All-day event
                  </label>
                </div>

                {/* Time inputs */}
                {!editedEventData.is_all_day && (
                  <div className="detail-row" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    padding: '4px'
                  }}>
                    <Clock size={14} color="hsl(var(--border))" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                      <input
                        type="time"
                        value={editedEventData.start_time || ''}
                        onChange={(e) => handleEdit('start_time', e.target.value)}
                        className="time-input"
                        style={{
                          padding: '2px 4px',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          fontSize: '13px',
                          flex: 1,
                          minHeight: '20px',
                          backgroundColor: 'hsl(var(--input-field-bg))',
                          color: 'hsl(var(--text-color))',
                          colorScheme: 'dark'
                        }}
                      />
                      <span style={{ color: 'hsl(var(--text-muted))', fontSize: '12px' }}>to</span>
                      <input
                        type="time"
                        value={editedEventData.end_time || ''}
                        onChange={(e) => handleEdit('end_time', e.target.value)}
                        className="time-input"
                        style={{
                          padding: '2px 4px',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          fontSize: '13px',
                          flex: 1,
                          minHeight: '20px',
                          backgroundColor: 'hsl(var(--input-field-bg))',
                          color: 'hsl(var(--text-color))',
                          colorScheme: 'dark'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Recurrence */}
                <div className="detail-row" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  padding: '4px'
                }}>
                  <Repeat size={14} color="hsl(var(--border))" />
                  <select
                    value={getRecurrenceDisplayValue()}
                    onChange={(e) => handleSimpleRecurrenceChange(e.target.value)}
                    className="recurrence-select"
                    style={{
                      flex: 1,
                      padding: '2px 4px',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '13px',
                      minHeight: '20px',
                      backgroundColor: 'hsl(var(--input-field-bg))',
                      color: 'hsl(var(--text-color))'
                    }}
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
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="button-group" style={{
            display: 'flex',
            gap: '4px',
            marginTop: '-20px',
            justifyContent: 'flex-end'
          }}>
            <button 
              onClick={handleCancel} 
              className="cancel-button"
              disabled={isSubmitting}
              style={{
                padding: '4px 10px',
                border: 'none',
                borderRadius: '2px',
                backgroundColor: 'hsl(var(--accent-foreground)/0.1)',
                color: 'hsl(var(--button-secondary-text))',
                cursor: 'pointer',
                fontSize: '12px',
                minHeight: '24px',
                fontWeight: '500'
              }}
            >
              {isSubmitting ? 'Saving...' : `Create ${editedEventData.event_type === 'task' ? 'Task' : 'Event'}`}
            </button>
          </div>
        </div>
        );
      })()}

      {/* Add global styles for animations and date/time picker styling */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }

          /* Date and Time picker icon styling with transparent background */
          .date-input::-webkit-calendar-picker-indicator,
          .time-input::-webkit-calendar-picker-indicator {
            background: transparent !important;
            border: none !important;
            cursor: pointer;
            opacity: 0.8;
            padding: 2px;
            border-radius: 2px;
            transition: opacity 0.2s;
          }

          .date-input::-webkit-calendar-picker-indicator:hover,
          .time-input::-webkit-calendar-picker-indicator:hover {
            opacity: 1;
          }

          /* Custom SVG icons for date and time pickers */
          .date-input::-webkit-calendar-picker-indicator {
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3e%3c/rect%3e%3cline x1='16' y1='2' x2='16' y2='6'%3e%3c/line%3e%3cline x1='8' y1='2' x2='8' y2='6'%3e%3c/line%3e%3cline x1='3' y1='10' x2='21' y2='10'%3e%3c/line%3e%3c/svg%3e") !important;
            background-repeat: no-repeat !important;
            background-position: center !important;
            background-size: 14px 14px !important;
            width: 16px !important;
            height: 16px !important;
          }

          .time-input::-webkit-calendar-picker-indicator {
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3ccircle cx='12' cy='12' r='10'%3e%3c/circle%3e%3cpolyline points='12,6 12,12 16,14'%3e%3c/polyline%3e%3c/svg%3e") !important;
            background-repeat: no-repeat !important;
            background-position: center !important;
            background-size: 14px 14px !important;
            width: 16px !important;
            height: 16px !important;
          }

          /* Enhanced select dropdown styling for dark mode */
          .recurrence-select {
            appearance: none;
            background-color: hsl(var(--input-field-bg)) !important;
            color: hsl(var(--text-color)) !important;
            border: 1px solid hsl(var(--border)) !important;
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 4px center;
            background-size: 16px;
            padding-right: 24px;
          }

          /* Force dark mode for select options */
          .recurrence-select option {
            background-color: #1a1a1a !important;
            color: #ffffff !important;
            padding: 8px !important;
          }

          .recurrence-select option:checked,
          .recurrence-select option:hover {
            background-color: #333333 !important;
            color: #ffffff !important;
          }

          /* Firefox specific styles */
          @-moz-document url-prefix() {
            .recurrence-select {
              background: hsl(var(--input-field-bg)) !important;
              color: hsl(var(--text-color)) !important;
            }
            
            .recurrence-select option {
              background-color: #1a1a1a !important;
              color: #ffffff !important;
            }
          }

          .recurrence-select:hover {
            border-color: hsl(var(--border));
            background-color: hsl(var(--input-field-bg)) !important;
          }

          .recurrence-select:focus {
            outline: none;
            border-color: hsl(var(--accent-foreground));
            box-shadow: 0 0 0 1px hsl(var(--accent-foreground)/0.2);
            background-color: hsl(var(--input-field-bg)) !important;
          }

          /* Dark theme calendar and time picker popup styling */
          input[type="date"]::-webkit-datetime-edit,
          input[type="time"]::-webkit-datetime-edit {
            color: hsl(var(--text-color));
          }

          input[type="date"]::-webkit-datetime-edit-fields-wrapper,
          input[type="time"]::-webkit-datetime-edit-fields-wrapper {
            background: hsl(var(--input-field-bg));
          }

          input[type="date"]::-webkit-datetime-edit-text,
          input[type="time"]::-webkit-datetime-edit-text {
            color: hsl(var(--text-muted));
            padding: 0 1px;
          }

          input[type="date"]::-webkit-datetime-edit-month-field,
          input[type="date"]::-webkit-datetime-edit-day-field,
          input[type="date"]::-webkit-datetime-edit-year-field,
          input[type="time"]::-webkit-datetime-edit-hour-field,
          input[type="time"]::-webkit-datetime-edit-minute-field {
            color: hsl(var(--text-color));
          }

          input[type="date"]::-webkit-datetime-edit-month-field:focus,
          input[type="date"]::-webkit-datetime-edit-day-field:focus,
          input[type="date"]::-webkit-datetime-edit-year-field:focus,
          input[type="time"]::-webkit-datetime-edit-hour-field:focus,
          input[type="time"]::-webkit-datetime-edit-minute-field:focus {
            background-color: hsl(var(--accent-foreground)/0.1);
            color: hsl(var(--text-color));
          }
        `
      }} />
    </div>
  );
};

export default EventForm;