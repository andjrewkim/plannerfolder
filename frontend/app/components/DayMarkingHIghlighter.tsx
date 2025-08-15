import React, { useEffect, useCallback } from 'react';
import { EventSourceInput } from '@fullcalendar/core';
import '../styles/daymarking.css';
import { useTheme } from '../services/themeContext';
import { useAppState } from '../hooks/useAppState';

interface DayMarkingHighlighterProps {
  onMarkingsLoaded: (events: EventSourceInput) => void;
  refreshTrigger?: unknown;
}

const DayMarkingHighlighter: React.FC<DayMarkingHighlighterProps> = ({
  onMarkingsLoaded,
  refreshTrigger
}) => {
  const { currentTheme } = useTheme();
  const { events, isLoading, error, initialized } = useAppState();

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

  // Process events and extract day markings
  const processEvents = useCallback(() => {
    if (!events || events.length === 0) {
      onMarkingsLoaded([]);
      return;
    }

    // Filter for events that have a non-empty day_marking_title
    const dayMarkings = events.filter(event => 
      event.day_marking_title && 
      event.day_marking_title.trim() !== ''
    );
    
    // Transform the data into FullCalendar compatible format with theme awareness
    const formattedMarkings = dayMarkings.map(event => ({
      id: String(event.frontendId || event.eventId || event.id || ''),
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
        description: event.notes || ''
      }
    }));
    
    onMarkingsLoaded(formattedMarkings);
  }, [events, onMarkingsLoaded]);

  // Process events whenever events data changes or refreshTrigger is updated
  useEffect(() => {
    if (initialized && !isLoading) {
      processEvents();
    } else if (!initialized) {
      // Clear markings while initializing
      onMarkingsLoaded([]);
    }
  }, [events, initialized, isLoading, processEvents, refreshTrigger]);

  // Handle errors by clearing markings
  useEffect(() => {
    if (error) {
      console.debug('DayMarkingHighlighter error:', error);
      onMarkingsLoaded([]);
    }
  }, [error, onMarkingsLoaded]);

  // Debug logging
  useEffect(() => {
    if (isLoading) {
      console.debug('DayMarkingHighlighter: Loading day markings...');
    }
  }, [isLoading]);

  // This component doesn't render anything visible
  return null;
};

export default DayMarkingHighlighter;