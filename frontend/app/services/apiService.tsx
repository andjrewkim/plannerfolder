import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api/schedule/';  // Django API endpoint

// Create Event - Sends the raw input text to the backend for processing
export const createEvent = async (data: { input_text: string }) => {
  try {
    const response = await axios.post(API_URL, data);
    return response.data;  // Return the event data that the backend processes
  } catch (error) {
    throw new Error('Error creating event');
  }
};
