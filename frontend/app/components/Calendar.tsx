import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DateSelectArg,
  EventApi,
  EventDropArg,
  EventSourceInput,
  EventClickArg,
} from "@fullcalendar/core";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from "@fullcalendar/interaction";
import { RRule } from 'rrule';
import EventModal from './EventModal';
import DayMarkingHighlighter from './DayMarkingHIghlighter';
import { authAPI } from '../../lib/auth';
import '../styles/calendar.css';
import '../globals.css';

interface EventDetails {
  id?: string;
  eventId?: string;
  event_name: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string;
  virtual: boolean;
  urgency: 'low' | 'medium' | 'high';
  notes: string;
  event_type: string;
  category: string;
  subcategories: string;
  recurrence_pattern: string;
  color: string;
  day_marking_title?: string;
}

interface DayHoverInfo {
  date: Date;
  events: EventApi[];
  position: {
    x: number;
    y: number;
  };
}

interface ModalPosition {
  x: number;
  y: number;
}

interface CalendarProps {
  onEventChange?: () => void;
  onViewChange?: (newView: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({ onEventChange, onViewChange }) => {
  const [currentEvents, setCurrentEvents] = useState<EventApi[]>([]);
  const [dayMarkings, setDayMarkings] = useState<EventSourceInput>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null);
  const [modalPosition, setModalPosition] = useState<ModalPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<DayHoverInfo | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const calendarRef = useRef<FullCalendar | null>(null);
  const shouldFetch = useRef(true);
  const currentEventsRef = useRef(currentEvents);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update the ref whenever currentEvents changes
  useEffect(() => {
    currentEventsRef.current = currentEvents;
  }, [currentEvents]);

  // Helper function to expand recurring events
  const expandRecurringEvents = (events: EventDetails[]): EventDetails[] => {
    const expandedEvents: EventDetails[] = [];
    const today = new Date();
    const futureLimit = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()); // 2 years ahead

    events.forEach(event => {
      if (event.recurrence_pattern && event.recurrence_pattern.trim() !== '') {
        try {
          // Parse the RRule with the original event date as the starting point
          const baseDate = new Date(event.date);
          
          // Create RRule with DTSTART set to the original event date
          const ruleString = event.recurrence_pattern.includes('DTSTART') 
            ? event.recurrence_pattern 
            : `DTSTART=${baseDate.toISOString().split('T')[0].replace(/-/g, '')}\n${event.recurrence_pattern}`;
          
          const rule = RRule.fromString(ruleString);
          
          // Generate occurrences starting from the original event date
          const occurrences = rule.between(
            new Date(Math.min(baseDate.getTime(), today.getTime() - 30 * 24 * 60 * 60 * 1000)), // Start from original date or 30 days ago, whichever is earlier
            futureLimit,
            true
          );

          // Always include the original event date if it's not already in occurrences
          const originalDateString = baseDate.toISOString().split('T')[0];
          const hasOriginalDate = occurrences.some(occ => 
            occ.toISOString().split('T')[0] === originalDateString
          );

          if (!hasOriginalDate) {
            occurrences.unshift(baseDate);
          }

          occurrences.forEach((occurrence, index) => {
            const eventDate = new Date(occurrence);
            
            // Create a new event instance for each occurrence
            expandedEvents.push({
              ...event,
              id: `${event.id}_${index}`, // Unique ID for each occurrence
              eventId: event.id, // Keep original ID for editing
              date: eventDate.toISOString().split('T')[0],
              // Preserve original times if they exist
              start_time: event.start_time,
              end_time: event.end_time
            });
          });
        } catch (error) {
          console.error('Error parsing RRule:', event.recurrence_pattern, error);
          // Fall back to single event if RRule parsing fails
          expandedEvents.push(event);
        }
      } else {
        // Non-recurring event
        expandedEvents.push(event);
      }
    });

    return expandedEvents;
  };


  const fetchEvents = useCallback(async () => {
    if (!shouldFetch.current) return;
    shouldFetch.current = false;

    try {
      const response = await authAPI.authenticatedFetch('http://127.0.0.1:8000/api/events/');
      if (!response.ok) throw new Error('Failed to fetch events');

      const data: EventDetails[] = await response.json();
      
      // Expand recurring events
      const expandedEvents = expandRecurringEvents(data);
      
      // Process all events, including day markings
      const formattedEvents = expandedEvents.map((event: EventDetails) => ({
        id: String(event.id),
        title: event.day_marking_title || event.event_name,
        start: formatToISOString(event.date, event.start_time),
        end: formatToISOString(event.date, event.end_time),
        backgroundColor: event.color,
        borderColor: event.color,
        extendedProps: {
          originalId: event.eventId || event.id, // Store original ID for editing
          location: event.location,
          virtual: event.virtual,
          urgency: event.urgency,
          notes: event.notes,
          event_type: event.event_type,
          category: event.category,
          subcategories: event.subcategories,
          recurrence_pattern: event.recurrence_pattern,
          isDayMarking: event.event_type === 'marking',
          day_marking_title: event.day_marking_title
        }
      }));

      setCurrentEvents(formattedEvents as unknown as EventApi[]);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, []);

  const refreshEvents = useCallback(() => {
    shouldFetch.current = true;
    fetchEvents();
    setRefreshTrigger(prev => prev + 1);
  }, [fetchEvents]);

  const formatToISOString = (date: string, time: string | null): string => {
    if (!date) return new Date().toISOString();

    const [year, month, day] = date.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    if (time) {
      const [hours, minutes] = time.split(':');
      dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
    }

    return dateObj.toISOString();
  };

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

      const response = await authAPI.authenticatedFetch(url, {
        method: selectedEvent.eventId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedEvent),
      });

      if (response.ok) {
        setIsModalOpen(false);
        refreshEvents();
        if (onEventChange) onEventChange();
        setError(null);
      } else {
        throw new Error('Failed to save event');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventDrop = useCallback((dropInfo: EventDropArg) => {
    const event = dropInfo.event;
    const startDate = new Date(event.start!);
    const endDate = event.end ? new Date(event.end) : startDate;

    // Use originalId for recurring events
    const eventId = event.extendedProps.originalId || event.id;

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

    authAPI.authenticatedFetch(`http://127.0.0.1:8000/api/events/${eventId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedEvent),
    })
      .then(response => {
        if (!response.ok) {
          dropInfo.revert();
          throw new Error('Failed to update event');
        }
        refreshEvents();
        if (onEventChange) onEventChange();
      })
      .catch(err => {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        console.error('Error:', errorMessage);
        dropInfo.revert();
        setError('Failed to update event position');
      });
  }, [onEventChange, refreshEvents]);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    const startDate = selectInfo.start;

    const rect = selectInfo.jsEvent?.target ? (selectInfo.jsEvent.target as Element).getBoundingClientRect() : null;

    if (rect) {
      const viewportWidth = window.innerWidth;
      const modalWidth = 400;

      let x = rect.right + 10;
      if (rect.right + modalWidth + 20 > viewportWidth) {
        x = Math.max(10, rect.left - modalWidth - 10);
      }

      setModalPosition({
        x: x + window.scrollX,
        y: rect.top + window.scrollY
      });
    }

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

  const handleDeleteEvent = async (eventId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await authAPI.authenticatedFetch(`http://127.0.0.1:8000/api/events/${eventId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        refreshEvents();
        if (onEventChange) onEventChange();
        setError(null);
        return true;
      } else {
        throw new Error('Failed to delete event');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('Error:', errorMessage);
      setError('Failed to delete event');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDayCellDidMount = useCallback((info: { el: HTMLElement; date: Date }) => {
    const cell = info.el;

    const handleMouseEnter = () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      hoverTimerRef.current = setTimeout(() => {
        const date = info.date;
        const dayEvents = currentEventsRef.current.filter(event => {
          const eventDate = event.start ? new Date(event.start) : null;
          return eventDate && eventDate.toDateString() === date.toDateString();
        });

        if (dayEvents.length > 0) {
          const rect = cell.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const popupWidth = 320;
          const popupHeight = Math.min(300, dayEvents.length * 80 + 60);

          let x = rect.right + 10;
          if (rect.right + popupWidth + 10 > viewportWidth) {
            x = rect.left - popupWidth - 10;
          }

          let y = rect.top;
          if (y + popupHeight > viewportHeight) {
            y = Math.max(0, viewportHeight - popupHeight);
          }

          setHoveredDay({
            date,
            events: dayEvents,
            position: {
              x: x + window.scrollX,
              y: y + window.scrollY
            }
          });
        }
      }, 300);
    };

    const handleMouseLeave = () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }

      setTimeout(() => {
        const popupElement = document.querySelector('.popup-details');
        const isHoveringPopup = popupElement?.matches(':hover');
        if (!isHoveringPopup) {
          setHoveredDay(null);
        }
      }, 100);
    };

    cell.addEventListener('mouseenter', handleMouseEnter);
    cell.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cell.removeEventListener('mouseenter', handleMouseEnter);
      cell.removeEventListener('mouseleave', handleMouseLeave);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, [currentEventsRef, setHoveredDay, hoverTimerRef]);

  const handleEventChange = (field: keyof EventDetails, value: string | boolean | null) => {
    if (selectedEvent) {
      setSelectedEvent({
        ...selectedEvent,
        [field]: value
      });
    }
  };

  const handleDayMarkingsLoaded = useCallback((markings: EventSourceInput) => {
    setDayMarkings(markings);
  }, []);

  interface DayDetailPopupProps {
    info: DayHoverInfo;
  }

  const DayDetailPopup: React.FC<DayDetailPopupProps> = ({ info }) => {
    const [editMode, setEditMode] = useState<string | null>(null);
    const [updatedMarking, setUpdatedMarking] = useState<{ id: string; day_marking_title: string; urgency: string } | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const dayMarkings = info.events.filter(event =>
      event.extendedProps && event.extendedProps.event_type === 'marking'
    );

    const regularEvents = info.events.filter(event =>
      !event.extendedProps || event.extendedProps.event_type !== 'marking'
    );

    const handleEditMarking = (event: EventApi) => {
      setEditMode(event.id);
      setDeleteConfirmId(null);
      setUpdatedMarking({
        id: event.id,
        day_marking_title: event.extendedProps?.day_marking_title || event.title,
        urgency: event.extendedProps?.urgency || 'low'
      });
    };

    const handleSaveMarking = async (event: EventApi) => {
      if (!updatedMarking) return;

      try {
        const originalEvent = info.events.find(e => e.id === event.id);
        if (!originalEvent) return;

        const updatedData: EventDetails = {
          event_name: updatedMarking.day_marking_title,
          date: new Date(originalEvent.start!).toISOString().split('T')[0],
          start_time: null,
          end_time: null,
          location: originalEvent.extendedProps?.location || '',
          virtual: originalEvent.extendedProps?.virtual || false,
          notes: originalEvent.extendedProps?.notes || '',
          event_type: 'marking',
          category: originalEvent.extendedProps?.category || '',
          subcategories: originalEvent.extendedProps?.subcategories || '',
          recurrence_pattern: originalEvent.extendedProps?.recurrence_pattern || '',
          day_marking_title: updatedMarking.day_marking_title,
          urgency: updatedMarking.urgency as 'low' | 'medium' | 'high',
          color: originalEvent.backgroundColor || '#3788d8'
        };

        // Use originalId for recurring events
        const eventId = originalEvent.extendedProps?.originalId || event.id;

        const response = await authAPI.authenticatedFetch(`http://127.0.0.1:8000/api/events/${eventId}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedData),
        });

        if (response.ok) {
          refreshEvents();
          if (onEventChange) onEventChange();
          setEditMode(null);
          setUpdatedMarking(null);
        } else {
          throw new Error('Failed to update day marking');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        console.error('Error updating day marking:', errorMessage);
        setError('Failed to update day marking');
      }
    };

    const handleCancel = () => {
      setEditMode(null);
      setUpdatedMarking(null);
      setDeleteConfirmId(null);
    };

    const handleDeleteMarkingClick = (eventId: string) => {
      setDeleteConfirmId(eventId);
      setEditMode(null);
    };

    const confirmDelete = async (eventId: string) => {
      // Find the event to get originalId for recurring events
      const event = info.events.find(e => e.id === eventId);
      const actualEventId = event?.extendedProps?.originalId || eventId;
      
      const success = await handleDeleteEvent(actualEventId);
      if (success) {
        setDeleteConfirmId(null);
      }
    };

    return (
      <div
        className="popup-details fixed z-50 bg-white shadow-lg rounded-lg p-4 border border-gray-200"
        style={{
          left: `${info.position.x}px`,
          top: `${info.position.y}px`,
          width: '320px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}
        onMouseEnter={() => {
          if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        }}
        onMouseLeave={() => {
          if (!document.querySelector('.fc-daygrid-day')?.matches(':hover')) {
            setHoveredDay(null);
          }
        }}
      >
        <h3 className="text-lg font-semibold mb-3">
          {info.date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })}
        </h3>

        {dayMarkings.length > 0 && (
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-gray-600 mb-1">Day Markings</h4>
            {dayMarkings.map((event) => (
              <div
                key={event.id}
                className={`p-2 rounded mb-2 day-marking-${event.extendedProps?.urgency?.toLowerCase() || 'low'}`}
                style={{
                  borderLeft: `4px solid var(--day-marking-${event.extendedProps?.urgency?.toLowerCase() || 'low'}-color)`,
                  backgroundColor: `var(--day-marking-${event.extendedProps?.urgency?.toLowerCase() || 'low'}-bg)`
                }}
              >
                {editMode === event.id && updatedMarking ? (
                  <div className="marking-edit-form">
                    <div className="mb-2">
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={updatedMarking.day_marking_title}
                        onChange={(e) => setUpdatedMarking({...updatedMarking, day_marking_title: e.target.value})}
                        placeholder="Marking Title"
                      />
                    </div>
                    <div className="mb-2">
                      <select
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={updatedMarking.urgency}
                        onChange={(e) => setUpdatedMarking({...updatedMarking, urgency: e.target.value})}
                      >
                        <option value="low">Low Importance</option>
                        <option value="medium">Medium Importance</option>
                        <option value="high">High Importance</option>
                      </select>
                    </div>
                    <div className="flex justify-end space-x-2 mt-2">
                      <button
                        className="px-3 py-1 bg-gray-200 text-gray-800 rounded text-xs"
                        onClick={handleCancel}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-3 py-1 bg-blue-500 text-white rounded text-xs"
                        onClick={() => handleSaveMarking(event)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : deleteConfirmId === event.id ? (
                  <div className="delete-confirmation">
                    <p className="text-sm mb-2">Delete this day marking?</p>
                    <div className="flex justify-end space-x-2">
                      <button
                        className="px-3 py-1 bg-gray-200 text-gray-800 rounded text-xs"
                        onClick={handleCancel}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-3 py-1 bg-red-500 text-white rounded text-xs"
                        onClick={() => confirmDelete(event.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="font-medium">
                      {event.extendedProps?.day_marking_title || event.title}
                    </div>
                    <div className="flex space-x-1">
                      <button
                        className="text-gray-500 hover:text-blue-500"
                        onClick={() => handleEditMarking(event)}
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        className="text-gray-500 hover:text-red-500"
                        onClick={() => handleDeleteMarkingClick(event.id)}
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {regularEvents.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-1">Events</h4>
            {regularEvents.map((event) => (
              <div
                key={event.id}
                className="p-2 rounded mb-2"
                style={{
                  borderLeft: `4px solid ${event.backgroundColor}`,
                  backgroundColor: `${event.backgroundColor}15`
                }}
              >
                <div className="font-medium">{event.title}</div>
                <div className="text-sm text-gray-600">
                  {new Date(event.start!).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                  {event.end && ` - ${new Date(event.end).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}`}
                </div>
                {event.extendedProps?.location && (
                  <div className="text-sm text-gray-600 mt-1">
                    📍 {event.extendedProps.location}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const allEvents = [
    ...(currentEvents || []).map(event => ({
      id: event.id,
      title: event.title,
      start: event.start ? new Date(event.start).toISOString() : undefined,
      end: event.end ? new Date(event.end).toISOString() : undefined,
      backgroundColor: event.backgroundColor,
      borderColor: event.borderColor,
      extendedProps: event.extendedProps,
    })),
    ...(Array.isArray(dayMarkings) ? dayMarkings : [])
  ];

  return (
    <div className="flex">
      <div className="w-[320px] bg-gray-100">
      </div>

      <div className="flex-1">
        <DayMarkingHighlighter
          onMarkingsLoaded={handleDayMarkingsLoaded}
          refreshTrigger={refreshTrigger}
        />

        <div className="w-full">
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
          dayMaxEventRows={false}
          displayEventEnd={false}
          events={allEvents}
          select={handleDateSelect}
          eventClick={(clickInfo: EventClickArg) => {
            if (clickInfo.event.extendedProps?.event_type === 'marking') {
              return;
            }

            const event = clickInfo.event;
            const startDate = new Date(event.start!);
            const endDate = event.end ? new Date(event.end) : startDate;

            const eventEl = clickInfo.el;
            const rect = eventEl.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const modalWidth = 400;

            let x = rect.right + 10;
            if (rect.right + modalWidth + 20 > viewportWidth) {
              x = Math.max(10, rect.left - modalWidth - 10);
            }

            setModalPosition({
              x: x + window.scrollX,
              y: rect.top + window.scrollY
            });

            setSelectedEvent({
              eventId: event.extendedProps?.originalId || event.id,
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
              location: event.extendedProps?.location || '',
              virtual: event.extendedProps?.virtual || false,
              urgency: event.extendedProps?.urgency || 'medium',
              notes: event.extendedProps?.notes || '',
              event_type: event.extendedProps?.event_type || '',
              category: event.extendedProps?.category || '',
              subcategories: event.extendedProps?.subcategories || '',
              recurrence_pattern: event.extendedProps?.recurrence_pattern || '',
              color: event.backgroundColor || '#3788d8'
            });
            setIsModalOpen(true);
          }}
          eventDrop={handleEventDrop}
          height="85vh"
          allDaySlot={false}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          dayCellDidMount={handleDayCellDidMount}
          viewDidMount={(viewInfo) => {
            if (onViewChange) {
              onViewChange(viewInfo.view.type);
            }
          }}
        />
      </div>

      {hoveredDay && <DayDetailPopup info={hoveredDay} />}

      {selectedEvent && (
        <EventModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          selectedEvent={{
            ...selectedEvent,
            eventId: selectedEvent.eventId || '',
            start_time: selectedEvent.start_time ?? '',
            end_time: selectedEvent.end_time ?? ''
          }}
          position={modalPosition}
          onChange={handleEventChange}
          onSubmit={handleEventSubmit}
          onDelete={handleDeleteEvent}
        />
      )}
      </div>
    </div>
  );
};

export default Calendar;