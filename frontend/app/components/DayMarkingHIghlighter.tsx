import React, { useState, useEffect, useCallback } from 'react';
import { EventSourceInput } from '@fullcalendar/core';
import '../styles/daymarking.css';
import { useTheme } from '../services/themeContext'; // Import theme context

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
      const response = await fetch(apiEndpoint);
      if (!response.ok) throw new Error('Failed to fetch day markings');
      
      const data: EventData[] = await response.json();
      
      // Filter for events that have day_marking_title and no time
      const dayMarkings = data.filter(event => 
        event.day_marking_title && !event.start_time && !event.end_time
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
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint, onMarkingsLoaded]);

  useEffect(() => {
    fetchDayMarkings();
    
    // For debugging - showing that we're using the state variables
    // so TypeScript doesn't complain about unused variables
    if (isLoading) {
      console.debug('Loading day markings...');
    }
    
    if (error) {
      console.debug('Error state:', error);
    }
  }, [fetchDayMarkings, refreshTrigger, isLoading, error]);

  // This component doesn't render anything visible
  return null;
};

export default DayMarkingHighlighter;