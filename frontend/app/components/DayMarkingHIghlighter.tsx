import React, { useState, useEffect, useCallback } from 'react';
import { EventSourceInput } from '@fullcalendar/core';
import '../styles/daymarking.css';
import { useTheme } from '../services/themeContext'; // Import theme context

interface DayMarkingHighlighterProps {
  onMarkingsLoaded: (events: EventSourceInput) => void;
  apiEndpoint?: string;
  refreshTrigger?: any;
}

const DayMarkingHighlighter: React.FC<DayMarkingHighlighterProps> = ({
  onMarkingsLoaded,
  apiEndpoint = 'http://127.0.0.1:8000/api/events/',
  refreshTrigger
}) => {
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
      
      const data = await response.json();
      
      // Filter for events that have day_marking_title and no time
      const dayMarkings = data.filter((event: any) => 
        event.day_marking_title && !event.start_time && !event.end_time
      );
      
      // Transform the data into FullCalendar compatible format with theme awareness
      const formattedMarkings = dayMarkings.map((event: any) => ({
        id: event.id,
        title: event.day_marking_title || event.event_name,
        start: event.date,
        display: 'background',
        classNames: [
          'day-marking',
          event.urgency ? `day-marking-${event.urgency.toLowerCase()}` : 'day-marking-low'
        ].filter(Boolean),
        allDay: true,
        extendedProps: {
          isDayMarking: true,
          category: event.category,
          urgency: event.urgency || 'low',
          description: event.description || ''
        }
      }));
      
      // Pass the formatted events to the parent component
      onMarkingsLoaded(formattedMarkings);
      setError(null);
    } catch (error) {
      console.error('Error fetching day markings:', error);
      setError('Failed to load day markings');
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint, onMarkingsLoaded]);

  useEffect(() => {
    fetchDayMarkings();
  }, [fetchDayMarkings, refreshTrigger]);

  // This component doesn't render anything visible
  return null;
};

export default DayMarkingHighlighter;