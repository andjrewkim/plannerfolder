import React, { useState, useEffect, useCallback } from 'react';
import { EventSourceInput } from '@fullcalendar/core';

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
      
      // Transform the data into FullCalendar compatible format
      const formattedMarkings = dayMarkings.map((event: any) => ({
        id: event.id,
        title: event.day_marking_title || event.event_name,
        start: event.date,
        display: 'background',
        backgroundColor: event.color || '#3788d8',
        classNames: ['day-marking'],
        allDay: true,
        extendedProps: {
          isDayMarking: true,
          category: event.category,
          urgency: event.urgency
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