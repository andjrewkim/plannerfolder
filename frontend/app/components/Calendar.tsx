"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DateSelectArg,
  EventClickArg,
  EventApi,
  EventDropArg
} from "@fullcalendar/core";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from "@fullcalendar/interaction";
import EventModal from './EventModal';
import '../styles/calendar.css';
import '../globals.css';

interface EventDetails {
  eventId: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  virtual: boolean;
  urgency: 'low' | 'medium' | 'high';
  notes: string;
  event_type: string;
  category: string;
  subcategories: string;
  recurrence_pattern: string;
  color: string;
}

interface CalendarProps {
  onEventChange?: () => void;
}

// Add this interface to match your EventModal component
interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: EventDetails;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
}

const Calendar: React.FC<CalendarProps> = ({ onEventChange }) => {
  const [currentEvents, setCurrentEvents] = useState<EventApi[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const calendarRef = useRef(null);

  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const fetchEvents = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/events/');
      if (!response.ok) throw new Error('Failed to fetch events');
      
      const data = await response.json();
      const formattedEvents = data.map((event: any) => ({
        id: event.id,
        title: event.event_name,
        start: formatToISOString(event.date, event.start_time),
        end: formatToISOString(event.date, event.end_time),
        backgroundColor: event.color,
        borderColor: event.color,
        extendedProps: {
          location: event.location,
          virtual: event.virtual,
          urgency: event.urgency,
          notes: event.notes,
          event_type: event.event_type,
          category: event.category,
          subcategories: event.subcategories,
          recurrence_pattern: event.recurrence_pattern
        }
      }));

      setCurrentEvents(formattedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const formatToISOString = (date: string, time: string) => {
    const [hours, minutes] = time.split(':');
    const dateObj = new Date(date);
    dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
    return dateObj.toISOString();
  };

  const getCSRFToken = () => {
    return document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1] || '';
  };

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    const startDate = selectInfo.start;
    setSelectedEvent({
      eventId: '',
      event_name: '',
      date: startDate.toISOString().split('T')[0],
      start_time: startDate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }),
      end_time: new Date(startDate.getTime() + 3600000).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }),
      location: '',
      virtual: false,
      urgency: 'medium',
      notes: '',
      event_type: '',
      category: '',
      subcategories: '',
      recurrence_pattern: '',
      color: '#3788d8'
    });
    setIsModalOpen(true);
  }, []);

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    setIsLoading(true);
    const formattedEvent = {
      event_name: selectedEvent.event_name,
      date: selectedEvent.date,
      start_time: selectedEvent.start_time,
      end_time: selectedEvent.end_time,
      location: selectedEvent.location,
      virtual: selectedEvent.virtual,
      urgency: selectedEvent.urgency,
      notes: selectedEvent.notes,
      event_type: selectedEvent.event_type,
      category: selectedEvent.category,
      subcategories: selectedEvent.subcategories,
      recurrence_pattern: selectedEvent.recurrence_pattern,
      color: selectedEvent.color
    };

    try {
      const url = selectedEvent.eventId 
        ? `http://127.0.0.1:8000/api/events/${selectedEvent.eventId}/`
        : 'http://127.0.0.1:8000/api/events/';
        
      const response = await fetch(url, {
        method: selectedEvent.eventId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(),
        },
        credentials: 'include',
        body: JSON.stringify(formattedEvent),
      });

      if (response.ok) {
        setIsModalOpen(false);
        await fetchEvents();
        if (onEventChange) onEventChange();
      } else {
        throw new Error('Failed to save event');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventDrop = useCallback(debounce(async (dropInfo: EventDropArg) => {
    const event = dropInfo.event;
    const startDate = new Date(event.start!);
    const endDate = event.end ? new Date(event.end) : startDate;

    const updatedEvent = {
      event_name: event.title,
      date: startDate.toISOString().split('T')[0],
      start_time: startDate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }),
      end_time: endDate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }),
      location: event.extendedProps.location || '',
      virtual: event.extendedProps.virtual || false,
      urgency: event.extendedProps.urgency || 'medium',
      notes: event.extendedProps.notes || '',
      event_type: event.extendedProps.event_type || '',
      category: event.extendedProps.category || '',
      subcategories: event.extendedProps.subcategories || '',
      recurrence_pattern: event.extendedProps.recurrence_pattern || '',
      color: event.backgroundColor || '#3788d8'
    };

    try {
      setIsLoading(true);
      const response = await fetch(`http://127.0.0.1:8000/api/events/${event.id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(),
        },
        credentials: 'include',
        body: JSON.stringify(updatedEvent),
      });

      if (!response.ok) {
        dropInfo.revert();
        throw new Error('Failed to update event');
      }
      
      await fetchEvents();
      if (onEventChange) onEventChange();
    } catch (error) {
      console.error('Error:', error);
      dropInfo.revert();
    } finally {
      setIsLoading(false);
    }
  }, 500), [fetchEvents, onEventChange]);

  const handleEventDelete = async (eventId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`http://127.0.0.1:8000/api/events/${eventId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(),
        },
        credentials: 'include',
      });

      if (response.ok) {
        setIsModalOpen(false);
        await fetchEvents();
        if (onEventChange) onEventChange();
      } else {
        throw new Error('Failed to delete event');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bahahhaha">
      <div className="adadadadad">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          initialView="dayGridMonth"
          editable={!isLoading}
          selectable={!isLoading}
          selectMirror={true}
          dayMaxEvents={true}
          events={currentEvents}
          select={handleDateSelect}
          eventClick={useCallback((clickInfo: EventClickArg) => {
            const event = clickInfo.event;
            const startDate = new Date(event.start!);
            const endDate = event.end ? new Date(event.end) : startDate;

            setSelectedEvent({
              eventId: event.id,
              event_name: event.title,
              date: startDate.toISOString().split('T')[0],
              start_time: startDate.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
              }),
              end_time: endDate.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
              }),
              location: event.extendedProps.location || '',
              virtual: event.extendedProps.virtual || false,
              urgency: event.extendedProps.urgency || 'medium',
              notes: event.extendedProps.notes || '',
              event_type: event.extendedProps.event_type || '',
              category: event.extendedProps.category || '',
              subcategories: event.extendedProps.subcategories || '',
              recurrence_pattern: event.extendedProps.recurrence_pattern || '',
              color: event.backgroundColor || '#3788d8'
            });
            setIsModalOpen(true);
          }, [])}
          eventDrop={handleEventDrop}
          height="85vh"
          allDaySlot={false}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
        />
      </div>

      {selectedEvent && (
        <EventModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          selectedEvent={selectedEvent}
          onSubmit={handleEventSubmit}
          onDelete={handleEventDelete}
        />
      )}
    </div>
  );
};

export default Calendar;