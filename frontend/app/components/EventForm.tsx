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
}

const EventForm: React.FC<EventFormProps> = ({ setResult, setError }) => {
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
      
      // Process the data
      const processedData = {
        ...data,
        is_all_day: !data.start_time || !data.end_time || false,
        recurrence_pattern: processedRecurrence,
        event_type: isTask ? 'task' : (data.event_type || 'event')
      };
      
      // Set default times
      if (!processedData.start_time) processedData.start_time = "00:00";
      if (!processedData.end_time && !isTask) processedData.end_time = "23:59";
      if (isTask && !processedData.end_time) processedData.end_time = "";
      
      // Format date
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
          formattedData.start_time = "00:00";
          if (!formattedData.end_time) {
            formattedData.end_time = "00:00";
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
    <div className="event-form-container" style={{ padding: '4px' }}>
      {/* Input Field - Only show when not showing details */}
      {!showDetails && (
        <div className={`event-form-wrapper ${isError ? 'error-shake' : ''}`} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '4px',
          padding: '8px'
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
              lineHeight: '1.4'
            }}
          />
          <button
            onClick={handleInitialSubmit}
            className="submit-button"
            disabled={isSubmitting || !inputText.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: (!inputText.trim() || isSubmitting) ? '#e9ecef' : '#007bff',
              color: (!inputText.trim() || isSubmitting) ? '#6c757d' : 'white',
              cursor: (!inputText.trim() || isSubmitting) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
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
          backgroundColor: '#d4edda',
          color: '#155724',
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
      {showDetails && editedEventData && (
        <div className="event-details-section" style={{
          marginTop: '-14px',
          padding: '0px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          border: 'none',
          width: '100%'
        }}>
          
          {/* Event Type Switcher */}
          <div className="event-type-switcher" style={{
            display: 'flex',
            marginBottom: '2px',
            backgroundColor: '#e9ecef',
            borderRadius: '4px',
            padding: '2px'
          }}>
            <button
              type="button"
              className={`type-tab ${editedEventData.event_type === 'event' ? 'active' : ''}`}
              onClick={() => handleEventTypeChange('event')}
              style={{
                flex: 1,
                padding: '2px 16px',
                border: 'none',
                borderRadius: '2px',
                backgroundColor: editedEventData.event_type === 'event' ? '#007bff' : 'transparent',
                color: editedEventData.event_type === 'event' ? 'white' : '#495057',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Event
            </button>
            <button
              type="button"
              className={`type-tab ${editedEventData.event_type === 'task' ? 'active' : ''}`}
              onClick={() => handleEventTypeChange('task')}
              style={{
                flex: 1,
                padding: '2px 16px',
                border: 'none',
                borderRadius: '2px',
                backgroundColor: editedEventData.event_type === 'task' ? '#007bff' : 'transparent',
                color: editedEventData.event_type === 'task' ? 'white' : '#495057',
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
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            {/* Event Name */}
            <div
              className="detail-row"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px' }}
            >
              <Tag size={14} color="#6c757d" />
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
                  border: '1px solid #ddd',
                  borderRadius: '2px',
                  fontSize: '13px',
                  minHeight: '20px',
                  lineHeight: '1.3',
                  margin: 0,
                  backgroundColor: 'white'
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
                <Calendar size={14} color="#6c757d" />
                <input
                  type="date"
                  value={editedEventData.date || ''}
                  onChange={(e) => handleEdit('date', e.target.value)}
                  className="detail-input"
                  style={{
                    flex: 1,
                    padding: '2px 4px',
                    border: '1px solid #ddd',
                    borderRadius: '2px',
                    fontSize: '13px',
                    minHeight: '20px',
                    margin: 0,
                    backgroundColor: 'white'
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
                  gap: '4px',
                  padding: '4px'
                }}>
                  <Tag size={14} color="transparent" style={{ visibility: 'hidden' }} />
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '3px', 
                    cursor: 'pointer', 
                    fontSize: '13px' 
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
                    <Clock size={14} color="#6c757d" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                      <input
                        type="time"
                        value={editedEventData.start_time || ''}
                        onChange={(e) => handleEdit('start_time', e.target.value)}
                        style={{
                          padding: '2px 4px',
                          border: '1px solid #ddd',
                          borderRadius: '2px',
                          fontSize: '13px',
                          flex: 1,
                          minHeight: '20px',
                          backgroundColor: 'white'
                        }}
                      />
                      <span style={{ color: '#6c757d', fontSize: '12px' }}>to</span>
                      <input
                        type="time"
                        value={editedEventData.end_time || ''}
                        onChange={(e) => handleEdit('end_time', e.target.value)}
                        style={{
                          padding: '2px 4px',
                          border: '1px solid #ddd',
                          borderRadius: '2px',
                          fontSize: '13px',
                          flex: 1,
                          minHeight: '20px',
                          backgroundColor: 'white'
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
                  <Repeat size={14} color="#6c757d" />
                  <select
                    value={getRecurrenceDisplayValue()}
                    onChange={(e) => handleSimpleRecurrenceChange(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '2px 4px',
                      border: '1px solid #ddd',
                      borderRadius: '2px',
                      fontSize: '13px',
                      minHeight: '20px',
                      backgroundColor: 'white'
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
                backgroundColor: '#e9ecef',
                color: '#495057',
                cursor: 'pointer',
                fontSize: '12px',
                minHeight: '24px',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm} 
              className="confirm-button"
              disabled={isSubmitting}
              style={{
                padding: '4px 10px',
                border: 'none',
                borderRadius: '2px',
                backgroundColor: '#007bff',
                color: 'white',
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
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .error-shake {
          animation: shake 0.5s;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
};

export default EventForm;