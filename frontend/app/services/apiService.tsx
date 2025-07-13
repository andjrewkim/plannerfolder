import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { authAPI } from '../../lib/auth'; // Import your existing auth service

const API_URL = 'NEXT_PUBLIC_API_URL/api/schedule/';  // Django API endpoint

// Create an axios instance with default configuration
const apiClient = axios.create({
  baseURL: 'NEXT_PUBLIC_API_URL/api',
  withCredentials: true, // Important for Django session auth
});

// Add request interceptor to include auth headers
apiClient.interceptors.request.use(
  (config) => {
    const token = authAPI.getToken();
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid or expired
      authAPI.clearAuthData();
      if (typeof window !== 'undefined') {
        window.location.href = '/userlogin';
      }
    }
    return Promise.reject(error);
  }
);

// Create Event - Sends the raw input text to the backend for processing
export const createEvent = async (data: { input_text: string }) => {
  try {
    const response = await apiClient.post('/schedule/', data);
    return response.data;  // Return the event data that the backend processes
  } catch (error) {
    if (error instanceof AxiosError) {
      // More detailed error handling
      if (error.response?.data?.error) {
        throw new Error('Error creating event: ' + error.response.data.error);
      } else if (error.response?.data?.message) {
        throw new Error('Error creating event: ' + error.response.data.message);
      } else {
        throw new Error('Error creating event: ' + error.message);
      }
    }
    throw new Error('Error creating event: An unknown error occurred');
  }
};

// Get Events - Fetch all events for the authenticated user
export const getEvents = async () => {
  try {
    const response = await apiClient.get('/schedule/');
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.data?.error) {
        throw new Error('Error fetching events: ' + error.response.data.error);
      } else if (error.response?.data?.message) {
        throw new Error('Error fetching events: ' + error.response.data.message);
      } else {
        throw new Error('Error fetching events: ' + error.message);
      }
    }
    throw new Error('Error fetching events: An unknown error occurred');
  }
};

// Update Event - Update an existing event
export const updateEvent = async (eventId: string | number, data: { input_text?: string; [key: string]: any }) => {
  try {
    const response = await apiClient.put(`/schedule/${eventId}/`, data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.data?.error) {
        throw new Error('Error updating event: ' + error.response.data.error);
      } else if (error.response?.data?.message) {
        throw new Error('Error updating event: ' + error.response.data.message);
      } else {
        throw new Error('Error updating event: ' + error.message);
      }
    }
    throw new Error('Error updating event: An unknown error occurred');
  }
};

// Delete Event - Delete an existing event
export const deleteEvent = async (eventId: string | number) => {
  try {
    const response = await apiClient.delete(`/schedule/${eventId}/`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.data?.error) {
        throw new Error('Error deleting event: ' + error.response.data.error);
      } else if (error.response?.data?.message) {
        throw new Error('Error deleting event: ' + error.response.data.message);
      } else {
        throw new Error('Error deleting event: ' + error.message);
      }
    }
    throw new Error('Error deleting event: An unknown error occurred');
  }
};

// Get Single Event - Fetch a specific event by ID
export const getEvent = async (eventId: string | number) => {
  try {
    const response = await apiClient.get(`/schedule/${eventId}/`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.data?.error) {
        throw new Error('Error fetching event: ' + error.response.data.error);
      } else if (error.response?.data?.message) {
        throw new Error('Error fetching event: ' + error.response.data.message);
      } else {
        throw new Error('Error fetching event: ' + error.message);
      }
    }
    throw new Error('Error fetching event: An unknown error occurred');
  }
};

// Generic API call function for custom endpoints
export const apiCall = async (endpoint: string, options: AxiosRequestConfig = {}) => {
  try {
    const response = await apiClient(endpoint, options);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.data?.error) {
        throw new Error('API Error: ' + error.response.data.error);
      } else if (error.response?.data?.message) {
        throw new Error('API Error: ' + error.response.data.message);
      } else {
        throw new Error('API Error: ' + error.message);
      }
    }
    throw new Error('API Error: An unknown error occurred');
  }
};