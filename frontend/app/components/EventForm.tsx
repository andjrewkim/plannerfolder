import React, { useState } from 'react';
import { createEvent } from '../services/apiService';  // Import the API service

interface EventFormProps {
  setResult: React.Dispatch<React.SetStateAction<any>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const EventForm: React.FC<EventFormProps> = ({ setResult, setError }) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Send the raw inputText to the backend
      const eventData = await createEvent({ input_text: inputText });

      // Trigger the parent to update the result state
      setResult((prevState: any) => [...prevState, eventData]);  // Optionally, append the new event to existing results
      setError(null);  // Clear any previous errors
      setInputText(''); // Reset input field after submission
    } catch (err) {
      setError('Failed to create event. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Enter event details"
      />
      <button type="submit">Create Event</button>
    </form>
  );
};

export default EventForm;
