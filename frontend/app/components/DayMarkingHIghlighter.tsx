import React, { useState, useEffect, useCallback } from 'react';
import { EventSourceInput } from '@fullcalendar/core';
import '../styles/daymarking.css';
import { useTheme } from '../services/themeContext'; // Import theme context
import { authAPI } from '../../lib/auth'; // Import the auth service

interface DayMarkingHighlighterProps {
  onMarkingsLoaded: (events: EventSourceInput) => void;
  apiEndpoint?: string;
  refreshTrigger?: unknown;
}

// Define interfaces for API response data
interface EventData {
  id: string | number;
  day_marking_title?: string;
  event_name?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  urgency?: 'low' | 'medium' | 'high';
  category?: string;
  description?: string;
}

const DayMarkingHighlighter: React.FC<DayMarkingHighlighterProps> = ({
  onMarkingsLoaded,
  apiEndpoint = 'http://127.0.0.1:8000/api/events/',
  refreshTrigger
}) => {
  // Keep state variables but avoid the linting errors by using them
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentTheme } = useTheme(); // Get current theme from context

  // Apply theme colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    
    // Set theme colors as CSS variables with RGB format for transparency support
    const lowColor = currentTheme.colors[0];
    const mediumColor = currentTheme.colors[1];
    const highColor = currentTheme.colors[2] || '#ff4d4d';
    
    // Set the base color variables
    root.style.setProperty('--day-marking-low-color', lowColor);
    root.style.setProperty('--day-marking-medium-color', mediumColor);
    root.style.setProperty('--day-marking-high-color', highColor);
    
    // Convert hex to rgba for background with transparency
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    
    // Add opacity variants for background usage (using rgba for better cross-browser support)
    root.style.setProperty('--day-marking-low-bg', hexToRgba(lowColor, 0.2));
    root.style.setProperty('--day-marking-medium-bg', hexToRgba(mediumColor, 0.2));
    root.style.setProperty('--day-marking-high-bg', hexToRgba(highColor, 0.2));
  }, [currentTheme]);

  const fetchDayMarkings = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check if user is authenticated first
      if (!authAPI.isAuthenticated()) {
        setError('Please log in to view day markings');
        onMarkingsLoaded([]); // Pass empty array when not authenticated
        return;
      }

      const response = await authAPI.authenticatedFetch(apiEndpoint);
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to view day markings');
          onMarkingsLoaded([]);
          return;
        }
        throw new Error('Failed to fetch day markings');
      }
      
      const data: EventData[] = await response.json();
      
      // Filter for events that have a non-empty day_marking_title
      // Backend handles time filtering, so we only check for valid day marking titles
      const dayMarkings = data.filter(event => 
        event.day_marking_title && 
        event.day_marking_title.trim() !== ''
      );
      
      // Transform the data into FullCalendar compatible format with theme awareness
      const formattedMarkings = dayMarkings.map(event => ({
        id: String(event.id),
        title: event.day_marking_title || event.event_name || '',
        start: event.date,
        display: 'background',
        classNames: [
          'day-marking',
          event.urgency ? `day-marking-${event.urgency.toLowerCase()}` : 'day-marking-low'
        ].filter(Boolean),
        allDay: true,
        extendedProps: {
          isDayMarking: true,
          category: event.category || '',
          urgency: event.urgency || 'low',
          description: event.description || ''
        }
      }));
      
      // Pass the formatted events to the parent component
      onMarkingsLoaded(formattedMarkings);
      setError(null);
    } catch (err) {
      console.error('Error fetching day markings:', err);
      setError('Failed to load day markings');
      onMarkingsLoaded([]); // Pass empty array on error
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint, onMarkingsLoaded]); // Only include stable dependencies

  // Effect for initial load and refresh trigger
  useEffect(() => {
    // Only fetch data if user is authenticated
    if (authAPI.isAuthenticated()) {
      fetchDayMarkings();
    } else {
      // Clear markings and show error if not authenticated
      onMarkingsLoaded([]);
      setError('Please log in to access day markings');
    }
  }, [refreshTrigger]); // Only depend on refreshTrigger, not fetchDayMarkings

  // Separate effect for debugging that doesn't cause re-renders
  useEffect(() => {
    // For debugging - showing that we're using the state variables
    // so TypeScript doesn't complain about unused variables
    if (isLoading) {
      console.debug('Loading day markings...');
    }
    
    if (error) {
      console.debug('Error state:', error);
    }
  }, [isLoading, error]); // This is separate so it doesn't trigger fetches

  // This component doesn't render anything visible
  return null;
};

export default DayMarkingHighlighter;