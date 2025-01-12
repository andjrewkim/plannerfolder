import React, { useState } from 'react';
import { createEvent } from '../services/apiService';
import '../styles/eventform.css';

interface EventFormProps {
  setResult: React.Dispatch<React.SetStateAction<any>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const EventForm: React.FC<EventFormProps> = ({ setResult, setError }) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const eventData = await createEvent({ input_text: inputText });
      setResult((prevState) => (Array.isArray(prevState) ? [...prevState, eventData] : [eventData]));
      setError(null);
      setInputText('');
      setIsError(false);
    } catch (err) {
      console.error(err);
      setError('Failed to create event. Please try again.');
      setIsError(true);
      // Remove error shake class after animation
      setTimeout(() => setIsError(false), 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="event-form-container">
      <form 
        onSubmit={handleSubmit} 
        className={`event-form ${isError ? 'error-shake' : ''}`}
      >
        <div className="form-background" />
        <div className="form-content">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter event details"
            className="event-textarea"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting || !inputText.trim()}
          >
            {isSubmitting ? 'Creating...' : 'Create Event'}
            {isSubmitting && <span className="loading-spinner" />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventForm;