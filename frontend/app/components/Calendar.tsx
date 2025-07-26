import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DateSelectArg,
  EventApi,
  EventDropArg,
  EventSourceInput,
  EventClickArg,
  EventInput,
} from "@fullcalendar/core";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from "@fullcalendar/interaction";
import { RRule } from 'rrule';
import EventModal from './EventModal';
import DayMarkingHighlighter from './DayMarkingHIghlighter';
import CustomCalendarHeader from './CustomCalHeader';
import { authAPI } from '../../lib/auth';
import '../styles/calendar.css';
import '../globals.css';
import { Calendar, Clock, MapPin, Edit3, Trash2, Save, X, Plus } from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';

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

// Custom event input type that matches FullCalendar's expectations
interface CustomEventInput extends EventInput {
  id: string;
  title: string;
  start: string;
  end?: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    originalId: string;
    location: string;
    virtual: boolean;
    urgency: string;
    notes: string;
    event_type: string;
    category: string;
    subcategories: string;
    recurrence_pattern: string;
    isDayMarking: boolean;
    day_marking_title?: string;
  };
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
  refreshTrigger: number;
  onEventChange?: () => void;
  onViewChange?: (newView: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({ onEventChange, onViewChange, refreshTrigger }) => {
  
  // Change to use CustomEventInput[] instead of EventApi[]
  const [currentEvents, setCurrentEvents] = useState<CustomEventInput[]>([]);
  const [dayMarkings, setDayMarkings] = useState<EventSourceInput>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null);
  const [modalPosition, setModalPosition] = useState<ModalPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<DayHoverInfo | null>(null);
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentView, setCurrentView] = useState('dayGridMonth');
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const calendarRef = useRef<FullCalendar | null>(null);
  const currentEventsRef = useRef(currentEvents);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Update the ref whenever currentEvents changes
  useEffect(() => {
    currentEventsRef.current = currentEvents;
  }, [currentEvents]);

  // View mapping for cleaner URLs
  const viewToUrlMap = {
    'dayGridMonth': 'month',
    'timeGridWeek': 'week', 
    'timeGridDay': 'day'
  } as const;

  const urlToViewMap = {
    'month': 'dayGridMonth',
    'week': 'timeGridWeek',
    'day': 'timeGridDay'
  } as const;

  useEffect(() => {
    if (typeof window !== 'undefined' && !hasInitialized) {
      const urlParams = new URLSearchParams(window.location.search);
      const viewFromUrl = urlParams.get('view');
      const dateFromUrl = urlParams.get('date');
      
      let initialView = 'dayGridMonth';
      
      if (viewFromUrl && viewFromUrl in urlToViewMap) {
        initialView = urlToViewMap[viewFromUrl as keyof typeof urlToViewMap];
      } else {
        // Fallback to localStorage if no URL param
        const savedView = localStorage.getItem('calendar-view');
        if (savedView && ['dayGridMonth', 'timeGridWeek', 'timeGridDay'].includes(savedView)) {
          initialView = savedView;
        }
      }
      
      let initialDate = null;
      if (dateFromUrl) {
        const parsedDate = new Date(dateFromUrl + 'T12:00:00'); // 💡 Force into middle of day
        if (!isNaN(parsedDate.getTime())) {
          initialDate = parsedDate;
        }
      }
      // Set both state and mark as initialized atomically
      setCurrentView(initialView);
      if (initialDate) {
        setCurrentDate(initialDate);
      }
      setHasInitialized(true);
    }
  }, []); // Remove hasInitialized dependency

  // Update URL when view changes (but not from FullCalendar events)
  useEffect(() => {
    if (typeof window !== 'undefined' && hasInitialized) {
      const url = new URL(window.location.href);
      const urlView = viewToUrlMap[currentView as keyof typeof viewToUrlMap];
      url.searchParams.set('view', urlView);
      
      if (currentDate) {
        url.searchParams.set('date', currentDate.toISOString().split('T')[0]);
      }
      
      // Update URL without reloading
      window.history.replaceState({}, '', url.toString());
      
      // Also save to localStorage as backup
      localStorage.setItem('calendar-view', currentView);
      
      if (onViewChange) onViewChange(currentView);
    }
  }, [currentView, onViewChange, hasInitialized]);

  // Helper function to expand recurring events
  const expandRecurringEvents = (events: EventDetails[]): EventDetails[] => {
    const expandedEvents: EventDetails[] = [];
    const today = new Date();
    const futureLimit = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());

    events.forEach(event => {
      if (event.recurrence_pattern && event.recurrence_pattern.trim() !== '') {
        try {
          const baseDate = new Date(event.date);
          
          const ruleString = event.recurrence_pattern.includes('DTSTART') 
            ? event.recurrence_pattern 
            : `DTSTART=${baseDate.toISOString().split('T')[0].replace(/-/g, '')}\n${event.recurrence_pattern}`;
          
          const rule = RRule.fromString(ruleString);
          
          const occurrences = rule.between(
            new Date(Math.min(baseDate.getTime(), today.getTime() - 30 * 24 * 60 * 60 * 1000)),
            futureLimit,
            true
          );

          const originalDateString = baseDate.toISOString().split('T')[0];
          const hasOriginalDate = occurrences.some(occ => 
            occ.toISOString().split('T')[0] === originalDateString
          );

          if (!hasOriginalDate) {
            occurrences.unshift(baseDate);
          }

          occurrences.forEach((occurrence, index) => {
            const eventDate = new Date(occurrence);
            
            expandedEvents.push({
              ...event,
              id: `${event.id}_${index}`,
              eventId: event.id,
              date: eventDate.toISOString().split('T')[0],
              start_time: event.start_time,
              end_time: event.end_time
            });
          });
        } catch (error) {
          console.error('Error parsing RRule:', event.recurrence_pattern, error);
          expandedEvents.push(event);
        }
      } else {
        expandedEvents.push(event);
      }
    });

    return expandedEvents;
  };

  const fetchEvents = useCallback(async (preserveView: boolean = false) => {
    try {
      // Save current view state before fetching
      const calendar = calendarRef.current;
      let savedView = currentView;
      let savedDate = currentDate;
      
      if (preserveView && calendar) {
        const calendarApi = calendar.getApi();
        savedView = calendarApi.view.type;
        savedDate = calendarApi.getDate();
      }

      const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/`);
      if (!response.ok) throw new Error('Failed to fetch events');

      const data: EventDetails[] = await response.json();
      const expandedEvents = expandRecurringEvents(data);
      
      const formattedEvents: CustomEventInput[] = expandedEvents.map((event: EventDetails) => ({
        id: String(event.id),
        title: event.day_marking_title || event.event_name,
        start: formatToISOString(event.date, event.start_time),
        end: formatToISOString(event.date, event.end_time),
        backgroundColor: event.color,
        borderColor: event.color,
        extendedProps: {
          originalId: event.eventId || event.id || '',
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

      setCurrentEvents(formattedEvents);
      
      // Restore view state after events are loaded
      if (preserveView && calendar && savedDate) {
        setTimeout(() => {
          const calendarApi = calendar.getApi();
          calendarApi.changeView(savedView);
          calendarApi.gotoDate(savedDate);
        }, 0);
      }
      
      setHasInitialized(true);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }, [currentView, currentDate]);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchEvents(true); // Preserve current view when refreshing
    }
  }, [refreshTrigger, fetchEvents]);

  useEffect(() => {
    fetchEvents(false);
  }, []);

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

  // Update a single event in the events array without full refresh
  const updateEventInPlace = useCallback((updatedEventData: EventDetails, eventId: string) => {
    setCurrentEvents(prevEvents => {
      return prevEvents.map(event => {
        if (event.id === eventId || event.extendedProps?.originalId === eventId) {
          return {
            ...event,
            title: updatedEventData.day_marking_title || updatedEventData.event_name,
            start: formatToISOString(updatedEventData.date, updatedEventData.start_time),
            end: formatToISOString(updatedEventData.date, updatedEventData.end_time),
            backgroundColor: updatedEventData.color,
            borderColor: updatedEventData.color,
            extendedProps: {
              ...event.extendedProps,
              location: updatedEventData.location,
              virtual: updatedEventData.virtual,
              urgency: updatedEventData.urgency,
              notes: updatedEventData.notes,
              event_type: updatedEventData.event_type,
              category: updatedEventData.category,
              subcategories: updatedEventData.subcategories,
              recurrence_pattern: updatedEventData.recurrence_pattern,
              isDayMarking: updatedEventData.event_type === 'marking',
              day_marking_title: updatedEventData.day_marking_title
            }
          };
        }
        return event;
      });
    });
  }, []);

  // Add a new event to the events array without full refresh
  const addEventInPlace = useCallback((newEventData: EventDetails, newEventId: string) => {
    const newEvent: CustomEventInput = {
      id: newEventId,
      title: newEventData.day_marking_title || newEventData.event_name,
      start: formatToISOString(newEventData.date, newEventData.start_time),
      end: formatToISOString(newEventData.date, newEventData.end_time),
      backgroundColor: newEventData.color,
      borderColor: newEventData.color,
      extendedProps: {
        originalId: newEventId,
        location: newEventData.location,
        virtual: newEventData.virtual,
        urgency: newEventData.urgency,
        notes: newEventData.notes,
        event_type: newEventData.event_type,
        category: newEventData.category,
        subcategories: newEventData.subcategories,
        recurrence_pattern: newEventData.recurrence_pattern,
        isDayMarking: newEventData.event_type === 'marking',
        day_marking_title: newEventData.day_marking_title
      }
    };

    setCurrentEvents(prevEvents => [...prevEvents, newEvent]);
  }, []);

  // Remove an event from the events array without full refresh
  const removeEventInPlace = useCallback((eventId: string) => {
    setCurrentEvents(prevEvents => 
      prevEvents.filter(event => 
        event.id !== eventId && event.extendedProps?.originalId !== eventId
      )
    );
  }, []);

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    setIsLoading(true);
    const formattedEvent: Omit<EventDetails, 'id' | 'eventId'> = {
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
      color: selectedEvent.color,
      day_marking_title: selectedEvent.day_marking_title
    };

    try {
      const url = selectedEvent.eventId
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/events/${selectedEvent.eventId}/`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/events/`;

      const response = await authAPI.authenticatedFetch(url, {
        method: selectedEvent.eventId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedEvent),
      });

      if (response.ok) {
        const responseData = await response.json();
        
        // Check if this is a recurring event - if so, do a full refresh
        if (selectedEvent.recurrence_pattern && selectedEvent.recurrence_pattern.trim() !== '') {
          await fetchEvents(true); // Preserve view for recurring events
        } else {
          // For non-recurring events, update in place
          const fullEventData: EventDetails = {
            ...formattedEvent,
            id: selectedEvent.eventId || responseData.id,
            eventId: selectedEvent.eventId
          };
          
          if (selectedEvent.eventId) {
            updateEventInPlace(fullEventData, selectedEvent.eventId);
          } else {
            addEventInPlace(fullEventData, responseData.id);
          }
        }
        
        setIsModalOpen(false);
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

    const eventId = event.extendedProps.originalId || event.id;

    const updatedEvent: EventDetails = {
      event_name: event.title,
      date: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`,
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
      color: event.backgroundColor || '#3788d8',
      day_marking_title: event.extendedProps.day_marking_title
    };

    // Update the event in place immediately for better UX
    updateEventInPlace(updatedEvent, eventId);

    // Then sync with backend
    authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedEvent),
    })
      .then(response => {
        if (!response.ok) {
          // Revert the UI change if backend fails
          dropInfo.revert();
          throw new Error('Failed to update event');
        }
        if (onEventChange) onEventChange();
      })
      .catch(err => {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        console.error('Error:', errorMessage);
        dropInfo.revert();
        setError('Failed to update event position');
      });
  }, [onEventChange, updateEventInPlace]);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    // Hide day hover popup when creating event
    setHoveredDay(null);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

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
      date: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`,
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
      
      // Find the event to check if it's recurring
      const eventToDelete = currentEvents.find(event => 
        event.id === eventId || event.extendedProps?.originalId === eventId
      );
      
      const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Check if this was a recurring event
        if (eventToDelete?.extendedProps?.recurrence_pattern && 
            eventToDelete.extendedProps.recurrence_pattern.trim() !== '') {
          // For recurring events, do a full refresh to update all occurrences
          await fetchEvents(true);
        } else {
          // For non-recurring events, remove from UI immediately
          removeEventInPlace(eventId);
        }
        
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

  const handleViewChange = useCallback((view: any) => {
    // Only update state, don't trigger URL updates from FullCalendar events
    // URL updates will happen from our useEffect above
    const newView = view.view.type;
    const newDate = view.view.currentStart;
    
    if (newView !== currentView) {
      setCurrentView(newView);
    }
    if (newDate.getTime() !== currentDate?.getTime()) {
      setCurrentDate(newDate);
    }
  }, [currentView, currentDate]);

  const handleDayCellDidMount = useCallback((info: { el: HTMLElement; date: Date }) => {
    const cell = info.el;

    const handleMouseEnter = () => {
      // Don't show hover popup if modal is open
      if (isModalOpen) return;
      
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      hoverTimerRef.current = setTimeout(() => {
        // Double check modal isn't open after timeout
        if (isModalOpen) return;
        
        const date = info.date;
        // Get events for this day from the calendar API
        const calendar = calendarRef.current;
        if (!calendar) return;
        
        const calendarApi = calendar.getApi();
        const dayEvents = calendarApi.getEvents().filter(event => {
          const eventDate = event.start ? new Date(event.start) : null;
          return eventDate && eventDate.toDateString() === date.toDateString();
        });

        // Sort events by start time for the popup
        const sortedEvents = dayEvents.sort((a, b) => {
          const aStart = a.start ? new Date(a.start).getTime() : 0;
          const bStart = b.start ? new Date(b.start).getTime() : 0;
          return aStart - bStart;
        });

        if (sortedEvents.length > 0) {
          const rect = cell.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const sidebarWidth = 320; // Width of the right sidebar
          const popupWidth = 295;
          const popupHeight = Math.min(300, sortedEvents.length * 80 + 60);

          // Calculate available width considering the sidebar
          const availableWidth = viewportWidth - sidebarWidth;

          // Position horizontally
          let x = rect.right + 4;
          
          // Check if popup would extend beyond available width (before sidebar)
          if (rect.right + popupWidth + 10 > availableWidth) {
            x = rect.left - popupWidth - 10;
            
            // If it still doesn't fit on the left, clamp it to stay within calendar bounds
            if (x < 0) {
              x = Math.max(10, availableWidth - popupWidth - 10);
            }
          }

          // Position vertically
          let y = rect.top;
          if (y + popupHeight > viewportHeight) {
            y = Math.max(0, viewportHeight - popupHeight - 10);
          }

          setHoveredDay({
            date,
            events: sortedEvents,
            position: {
              x: x + window.scrollX,
              y: y + window.scrollY
            }
          });
        }
      }, 1100);
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
  }, [setHoveredDay, hoverTimerRef, isModalOpen]);

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

  // Enhanced modal handling to clear hover popup
  const handleModalOpen = useCallback(() => {
    setHoveredDay(null);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

interface DayDetailPopupProps {
  info: {
    date: Date;
    events: any[];
    position: { x: number; y: number };
  };
  handleDeleteEvent: (id: string) => Promise<boolean>;
  hoverTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setHoveredDay: (d: Date | null) => void;
}

const DayDetailPopup: React.FC<DayDetailPopupProps> = ({
  info,
  handleDeleteEvent,
  hoverTimerRef,
  setHoveredDay,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  // Parallax tilt
  useEffect(() => {
    const el = popupRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      setTilt({ x: (py - 0.5) * 6, y: (px - 0.5) * -6 });
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  // Updated time formatting function - show minutes only if not :00
  const fmtTime = (d: Date) => {
    const timeStr = d.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    // Remove :00 from times like "12:00 PM" -> "12 PM"
    return timeStr.replace(':00', '');
  };
  
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <motion.div
      ref={popupRef}
      className="popup-details fixed z-50 rounded-xl border"
      style={{
        padding: '4px',
        left: info.position.x,
        top: info.position.y,
        width: 300,
        maxHeight: 360,
        backgroundColor: 'hsl(var(--card) / 0.6)',      // semi‑transparent frosted base
        backdropFilter: 'blur(20px)',
        borderColor: 'hsl(var(--border) / 0.3)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.16)',
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        border: '1px solid hsl(var(--border)',
      }}  
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
    >
      {/* Header */}
      <div
        className="px-3 py-1 border-b"
        style={{
          backgroundColor: 'hsl(var(--accent) / 0.15)',  // light tint for contrast
          borderColor: 'hsl(var(--border) / 0.2)',
          fontWeight: 600,
          color: 'hsl(var(--foreground))',
        }}
      >
        <div className="flex justify-between text-sm">
          {fmtDate(info.date)}
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>
            {info.events.length} {info.events.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {/* Events list with horizontal overflow visible */}
      <div
        className="overflow-y-auto overflow-x-visible rounded-b-xl"
        style={{ 
          overflowX: 'clip', // stops scrollbar without hiding the hover
          maxHeight: 300, 
          position: 'relative', 
          paddingTop: 12, // padding between header and first event
          paddingLeft: 12,
          paddingRight: 12
        }}
      >
        <AnimatePresence>
          {info.events.map((ev, i) => {
            const start = ev.start ? new Date(ev.start) : null;
            const end = ev.end ? new Date(ev.end) : null;
            const eventColor = ev.backgroundColor || ev.borderColor || `hsl(var(--chart${(i % 4) + 1}))`;
            
            return (
              <motion.div
                key={ev.id}
                className="relative mb-2"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: i * 0.08 }}
                onMouseEnter={() => setHoveredEventId(ev.id)}
                onMouseLeave={() => setHoveredEventId(null)}
              >
                {/* Event card */}
                <div
                  className="group flex items-center justify-between px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
                  style={{
                    backgroundColor: 'hsl(var(--card) / 0.85)',
                    border: `1px solid hsl(var(--border) / 0.2)`,
                    borderLeft: `4px solid ${eventColor}`,
                    cursor: 'pointer',
                  }}
                >
                  {/* Left side - Event title */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div
                      className="truncate"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'hsl(var(--foreground))',
                      }}
                      title={ev.title} // Show full title on hover
                    >
                      {ev.title}
                    </div>
                  </div>

                  {/* Right side - Time and actions */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {start && (
                      <div
                        className="text-xs whitespace-nowrap"
                        style={{ color: 'hsl(var(--muted-foreground))' }}
                      >
                        <Clock className="w-3 h-3 inline mr-1" />
                        {fmtTime(start)}
                        {end ? ` – ${fmtTime(end)}` : ''}
                      </div>
                    )}
                    
                    {/* Delete button */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button title="Delete" onClick={() => handleDeleteEvent(ev.id)}>
                        <Trash2 className="w-4 h-4" style={{ color: 'hsl(var(--destructive))' }} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty state */}
        {info.events.length === 0 && (
          <div className="py-6 text-center" style={{ color: 'hsl(var(--muted) / 0.5)' }}>
            <Calendar className="w-6 h-6 mx-auto mb-1" />
            <div style={{ fontSize: 14, fontWeight: 500 }}>No events</div>
            <div className="text-xs">Enjoy your day!</div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Sort events by start time before rendering
const sortEventsByTime = (events: CustomEventInput[]) => {
  return [...events].sort((a, b) => {
    const aStart = new Date(a.start).getTime();
    const bStart = new Date(b.start).getTime();
    return aStart - bStart;
  });
};

const allEvents = [
  ...sortEventsByTime(currentEvents || []).map(event => ({
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
  <div className='big-container'>
    <div className="flex h-screen">
      <div className="w-[306px]">
        {/* Your existing sidebar content */}
      </div>

      <div className="flex-1 flex flex-col">
        <DayMarkingHighlighter
          onMarkingsLoaded={handleDayMarkingsLoaded}
        />

        {/* Custom Header */}
        <CustomCalendarHeader 
          calendarRef={calendarRef}
          currentTitle={currentTitle}
          currentView={currentView}
          onViewChange={onViewChange}
        />

        {/* Calendar Container */}
        <div className="flex-1">
          {hasInitialized && (
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            headerToolbar={false}
            initialView={currentView}
            initialDate={currentDate || undefined}
            editable={!isLoading}
            selectable={!isLoading}
            selectMirror={true}
            dayMaxEvents={true}
            displayEventEnd={false}
            displayEventTime={true}
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short',
              omitZeroMinute: true
            }}
            events={allEvents}
            select={handleDateSelect}
            eventClick={(clickInfo) => {
              if (clickInfo.event.extendedProps?.event_type === 'marking') {
                return;
              }

              // Hide day hover popup when editing event
              setHoveredDay(null);
              if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
                hoverTimerRef.current = null;
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
                date: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`,
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
              handleModalOpen();
            }}
            eventDrop={handleEventDrop}
            height="100%"
            allDaySlot={false}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            dayCellDidMount={handleDayCellDidMount}
            viewDidMount={(viewInfo) => {
              setCurrentTitle(viewInfo.view.title);
              // Don't update view/date state here to avoid loops
            }}
            datesSet={(dateInfo) => {
              setCurrentTitle(dateInfo.view.title);
              // Only update if significantly different to avoid loops
              const newView = dateInfo.view.type;
              const newDate = dateInfo.view.currentStart;
              
              if (newView !== currentView) {
                setCurrentView(newView);
                // Notify parent component about view change
                if (onViewChange) onViewChange(newView);
              }
              if (Math.abs(newDate.getTime() - (currentDate?.getTime() || 0)) > 24 * 60 * 60 * 1000) {
                setCurrentDate(newDate);
              }
            }}
            fixedWeekCount={false}
            dayMaxEventRows={3}
            eventOrder="start,-duration,title"
          />
          )}
        </div>

        {hoveredDay && !isModalOpen && (
          <DayDetailPopup 
            info={hoveredDay} 
            handleDeleteEvent={handleDeleteEvent}
            hoverTimerRef={hoverTimerRef}
            setHoveredDay={setHoveredDay}
          />
        )}

        {selectedEvent && (
          <EventModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
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
  </div>
);
}
export default Calendar;