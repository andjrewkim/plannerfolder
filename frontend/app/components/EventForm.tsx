import React, { useState } from 'react';
import { createEvent } from '../services/apiService';
import { Clock, Calendar, MapPin, Tag } from 'lucide-react';
import { authAPI } from '../../lib/auth'; // Import the auth service
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
      
      // Add is_all_day field if it doesn't exist
      const processedData = {
        ...data,
        is_all_day: !data.start_time || !data.end_time || false
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
      
      // Add a small delay before showing the modal
      setTimeout(() => {
        setIsModalVisible(true);
      }, 50);
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
        
        // If it's an all-day event and we're using placeholder times, update them
        if (formattedData.is_all_day) {
          formattedData.start_time = "00:00";
          formattedData.end_time = "23:59";
          formattedData.day_marking_title = formattedData.event_name;
          formattedData.event_type = 'marking';
        } else {
          formattedData.event_type = 'event';
        }
        
        // Now save to backend using the original endpoint
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

  return (
    <div className="event-form-container">
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
            
            <div className="detail-group">
              <div className="detail-row">
                <Tag className="icon" />
                <input
                  value={editedEventData?.event_name || ''}
                  onChange={(e) => handleEdit('event_name', e.target.value)}
                  className="detail-input"
                  placeholder="Event name"
                />
              </div>

              <div className="detail-row">
                <Calendar className="icon" />
                <input
                  type="date"
                  value={editedEventData?.date || ''}
                  onChange={(e) => handleEdit('date', e.target.value)}
                  className="detail-input"
                />
              </div>
              
              {/* All-day event toggle */}
              <div className="detail-row all-day-toggle">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={editedEventData?.is_all_day || false}
                    onChange={toggleAllDayEvent}
                  />
                  <span className="custom-checkbox"></span>
                  Mark important day
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