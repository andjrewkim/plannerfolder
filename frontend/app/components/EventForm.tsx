import React, { useState } from 'react';
import { createEvent } from '../services/apiService';
import { Clock, Calendar, MapPin, Tag } from 'lucide-react';
import '../styles/eventform.css';

interface EventFormProps {
  setResult: React.Dispatch<React.SetStateAction<any>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

interface EventData {
  id?: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  event_type: string;
  recurrence_pattern: string;
  color: string;
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
      const data = await createEvent({ input_text: inputText });
      setParsedEventData(data);
      setEditedEventData(data);
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

  
  const handleConfirm = () => {
    if (editedEventData) {
      setResult((prevState) => Array.isArray(prevState) ? [...prevState, editedEventData] : [editedEventData]);
      setInputText('');
      setIsModalVisible(false);
      setParsedEventData(null);
      setEditedEventData(null);
    }
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setParsedEventData(null);
    setEditedEventData(null);
  };

  const handleEdit = (field: keyof EventData, value: string) => {
    if (editedEventData) {
      setEditedEventData({ ...editedEventData, [field]: value });
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
              <button onClick={handleConfirm} className="confirm-button">
                Create Event
              </button>
              <button onClick={handleCancel} className="cancel-button">
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