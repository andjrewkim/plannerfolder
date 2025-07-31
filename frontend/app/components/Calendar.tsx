import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { DateSelectArg, EventApi, EventDropArg, EventSourceInput, EventClickArg, EventInput } from '@fullcalendar/core';
import { RRule } from 'rrule';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, MapPin, Edit3, Trash2, Save, X, Plus } from 'lucide-react';

import { useAppState, EventDetails, TaskData } from '../hooks/useAppState';

import EventModal from './EventModal';
import DayMarkingHighlighter from './DayMarkingHIghlighter';
import CustomCalendarHeader from './CustomCalHeader';

import { authAPI } from '../../lib/auth';

import '../styles/calendar.css';
import '../globals.css';

// Move helper functions to the top of the file
function hexToHSL(hex) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h = h * 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Move formatToISOString to top level function
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

// Helper functions to save and restore scroll position (moved to top, single definition)
const saveScrollPosition = (calendarRef: React.RefObject<FullCalendar>) => {
  const calendar = calendarRef.current;
  if (!calendar) return null;
  
  const calendarApi = calendar.getApi();
  const view = calendarApi.view;
  
  // Find the scrollable container based on the view type
  let scrollContainer: HTMLElement | null = null;
  
  if (view.type === 'timeGridWeek' || view.type === 'timeGridDay') {
    // For time grid views, find the scroll container
    const calendarEl = calendar.elRef.current;
    if (calendarEl) {
      scrollContainer = calendarEl.querySelector('.fc-scroller-liquid-absolute') as HTMLElement;
      if (!scrollContainer) {
        scrollContainer = calendarEl.querySelector('.fc-scroller') as HTMLElement;
      }
      if (!scrollContainer) {
        scrollContainer = calendarEl.querySelector('.fc-timegrid-body') as HTMLElement;
      }
    }
  }
  
  if (scrollContainer) {
    return {
      scrollTop: scrollContainer.scrollTop,
      scrollLeft: scrollContainer.scrollLeft
    };
  }
  
  return null;
};

const restoreScrollPosition = (calendarRef: React.RefObject<FullCalendar>, scrollPos: { scrollTop: number; scrollLeft: number } | null) => {
  if (!scrollPos) return;
  
  const calendar = calendarRef.current;
  if (!calendar) return;
  
  const calendarApi = calendar.getApi();
  const view = calendarApi.view;
  
  // Use multiple RAF to ensure calendar is fully rendered
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      let scrollContainer: HTMLElement | null = null;
      
      if (view.type === 'timeGridWeek' || view.type === 'timeGridDay') {
        const calendarEl = calendar.elRef.current;
        if (calendarEl) {
          scrollContainer = calendarEl.querySelector('.fc-scroller-liquid-absolute') as HTMLElement;
          if (!scrollContainer) {
            scrollContainer = calendarEl.querySelector('.fc-scroller') as HTMLElement;
          }
          if (!scrollContainer) {
            scrollContainer = calendarEl.querySelector('.fc-timegrid-body') as HTMLElement;
          }
        }
      }
      
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollPos.scrollTop;
        scrollContainer.scrollLeft = scrollPos.scrollLeft;
      }
    });
  });
};

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
  all_day?: boolean;
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
  
  // Use the centralized app state hook
  const {
    events: hookEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    isLoading: appStateLoading,
    error: appStateError,
  } = useAppState();

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
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedEventPosition, setDraggedEventPosition] = useState(null);
  const [draggedEventId, setDraggedEventId] = useState(null);
  const [originalEventPosition, setOriginalEventPosition] = useState(null);

  const handleSidebarTaskCreate = (newTask: any) => {
    // This will be called by your sidebar when a task is created
    // No need to refresh calendar since tasks are separate from events
    if (onEventChange) onEventChange(); // Only call this if tasks affect calendar display
  };

  const handleSidebarTaskUpdate = (taskId: string, updates: any) => {
    // Handle task updates from sidebar
    if (onEventChange) onEventChange(); // Only if needed
  };

  const handleSidebarTaskDelete = (taskId: string) => {
    // Handle task deletion from sidebar
    if (onEventChange) onEventChange(); // Only if needed
  };

  const handleCalendarChange = () => {
    // This will be called by the Calendar component when it makes changes
    setRefreshSidebar((prev) => prev + 1);
  };

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

  // Initialize from URL params and localStorage only once
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasInitialized) {
      const urlParams = new URLSearchParams(window.location.search);
      const viewFromUrl = urlParams.get('view');
      
      // Get today's date - this was working perfectly
      const today = new Date();
      console.log('Today is:', today);
      
      // Only read VIEW from URL, ignore any date params
      let initialView = 'dayGridMonth';
      
      if (viewFromUrl && viewFromUrl in urlToViewMap) {
        initialView = urlToViewMap[viewFromUrl as keyof typeof urlToViewMap];
        console.log('Using view from URL:', initialView);
      } else {
        // Fallback to sessionStorage for view only (avoid localStorage for persistence across sessions)
        const savedView = sessionStorage.getItem('calendar-view');
        if (savedView && ['dayGridMonth', 'timeGridWeek', 'timeGridDay'].includes(savedView)) {
          initialView = savedView;
          console.log('Using view from sessionStorage:', initialView);
        }
      }
      
      // ALWAYS use today's date - this was working
      setCurrentView(initialView);
      setCurrentDate(today);
      setHasInitialized(true);
      
      console.log('Initialization - view:', initialView, 'date:', today);
    }
  }, []);

  // Update URL when view changes with debouncing to avoid excessive updates
  useEffect(() => {
    if (typeof window !== 'undefined' && hasInitialized && currentDate) {
      const timeoutId = setTimeout(() => {
        const url = new URL(window.location.href);
        const urlView = viewToUrlMap[currentView as keyof typeof viewToUrlMap];
        url.searchParams.set('view', urlView);
        
        // Ensure we're using the correct date format
        const dateString = currentDate.toISOString().split('T')[0];
        url.searchParams.set('date', dateString);
        
        console.log('Updating URL with view:', urlView, 'and date:', dateString);
        
        // Update URL without reloading
        window.history.replaceState({}, '', url.toString());
        
        // Save to sessionStorage instead of localStorage for current session only
        sessionStorage.setItem('calendar-view', currentView);
        
        if (onViewChange) onViewChange(currentView);
      }, 100); // Debounce URL updates

      return () => clearTimeout(timeoutId);
    }
  }, [currentView, currentDate, onViewChange, hasInitialized]);

  // Helper function to expand recurring events - memoized for performance
  const expandRecurringEvents = useMemo(() => {
    return (events: EventDetails[]): EventDetails[] => {
      if (!events.length) return [];
      
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
  }, []);

  // Convert events from useAppState to FullCalendar format - optimized with useMemo
  const formattedEvents = useMemo(() => {
    if (!hookEvents.length) return [];
    
    const expandedEvents = expandRecurringEvents(hookEvents);
    
    const formatted = expandedEvents.map((event: EventDetails) => ({
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

    // If we're dragging, show both the original (ghost) and the dragged event
    if (isDragging && draggedEventPosition && originalEventPosition) {
      const events = [];
      formatted.forEach(event => {
        const eventId = event.extendedProps?.originalId || event.id;
        
        if (eventId === draggedEventId) {
          // Add the ghost version (original position with lower opacity)
          events.push({
            ...event,
            id: `${event.id}_ghost`,
            start: originalEventPosition.start,
            end: originalEventPosition.end,
            backgroundColor: event.backgroundColor + '40', // Add 40 for ~25% opacity
            borderColor: event.borderColor + '40',
            extendedProps: {
              ...event.extendedProps,
              isGhost: true
            }
          });
          
          // Add the dragged version (new position)
          events.push({
            ...event,
            start: draggedEventPosition.start,
            end: draggedEventPosition.end
          });
        } else {
          events.push(event);
        }
      });
      return events;
    }

    return formatted;
  }, [hookEvents, expandRecurringEvents, isDragging, draggedEventPosition, originalEventPosition, draggedEventId]);

  // Update currentEvents when formattedEvents change
  useEffect(() => {
    setCurrentEvents(formattedEvents);
  }, [formattedEvents]);

  // Simplified refresh effect - no need to call fetchEvents since hookEvents updates automatically
  useEffect(() => {
    if (refreshTrigger > 0) {
      // The app state hook will automatically update hookEvents
      // We just need to trigger any additional side effects if needed
      console.log('Calendar refresh triggered:', refreshTrigger);
    }
  }, [refreshTrigger]);

  // ===== UPDATED: handleEventSubmit to use useAppState with optimistic updates =====
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
      let result;
      
      if (selectedEvent.eventId) {
        // Update existing event using hook (optimistic updates handled in hook)
        result = await updateEvent(selectedEvent.eventId, formattedEvent);
      } else {
        // Create new event using hook (optimistic updates handled in hook)
        result = await createEvent(formattedEvent);
      }
      
      if (result) {
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

  const handleEventDrop = useCallback(async (dropInfo: EventDropArg) => {
    const event = dropInfo.event;
    const eventId = event.extendedProps.originalId || event.id;
    
    const startDate = new Date(event.start!);
    const endDate = event.end ? new Date(event.end) : startDate;
    
    const newPosition = {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
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
      })
    };

    setCurrentEvents(prevEvents => 
      prevEvents.map(e => 
        (e.extendedProps?.originalId || e.id) === eventId
          ? {
              ...e,
              start: newPosition.start,
              end: newPosition.end
            }
          : e
      )
    );

    setIsDragging(false); // Clear dragging state immediately after drop
    setDraggedEventPosition(null);
    setDraggedEventId(null);
    setOriginalEventPosition(null);

    try {
      const result = await updateEvent(eventId, {
        date: newPosition.date,
        start_time: newPosition.start_time,
        end_time: newPosition.end_time
      });
      
      if (!result) {
        dropInfo.revert();
        setCurrentEvents(prevEvents => 
          prevEvents.map(e => 
            (e.extendedProps?.originalId || e.id) === eventId
              ? formattedEvents.find(fe => (fe.extendedProps?.originalId || fe.id) === eventId) || e
              : e
          )
        );
        setError('Failed to update event position');
      }
    } catch (err) {
      dropInfo.revert();
      setCurrentEvents(prevEvents => 
        prevEvents.map(e => 
          (e.extendedProps?.originalId || e.id) === eventId
            ? formattedEvents.find(fe => (fe.extendedProps?.originalId || fe.id) === eventId) || e
            : e
        )
      );
      setError('Failed to update event position');
    }
  }, [updateEvent, formattedEvents]);

  const handleEventChange = useCallback((field: keyof EventDetails, value: string | boolean) => {
    setSelectedEvent(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: value
      };
    });
  }, []);


  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    // Hide day hover popup when creating event
    setHoveredDay(null);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    const startDate = selectInfo.start;
    const endDate = selectInfo.end || new Date(startDate.getTime() + 3600000);

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

    // Format times properly for 24-hour format
    const formatTime = (date: Date) => {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    setSelectedEvent({
      eventId: '',
      event_name: '',
      date: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`,
      start_time: formatTime(startDate),
      end_time: formatTime(endDate),
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



  // ===== UPDATED: handleDeleteEvent to use useAppState with optimistic updates =====
  const handleDeleteEvent = async (eventId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Use hook's deleteEvent (optimistic updates handled automatically)
      const success = await deleteEvent(eventId);
      
      if (success) {
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
    
    // Force cleanup of any existing listeners first
    const existingEnter = (cell as any)._mouseEnterHandler;
    const existingLeave = (cell as any)._mouseLeaveHandler;
    if (existingEnter) cell.removeEventListener('mouseenter', existingEnter);
    if (existingLeave) cell.removeEventListener('mouseleave', existingLeave);

    const handleMouseEnter = () => {
      // Check the actual calendar view directly
      const calendar = calendarRef.current;
      if (!calendar) return;
      const calendarApi = calendar.getApi();
      const currentCalendarView = calendarApi.view.type;
      
      // Only show popup for month view
      if (currentCalendarView !== 'dayGridMonth') return;
      
      // Don't show hover popup if modal is open
      if (isModalOpen) return;
      
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      hoverTimerRef.current = setTimeout(() => {
        // Double check modal isn't open after timeout
        if (isModalOpen) return;
        
        // Double check view again in case it changed during timeout
        if (!calendar) return;
        const api = calendar.getApi();
        if (api.view.type !== 'dayGridMonth') return;
        
        const date = info.date;
        const dayEvents = api.getEvents().filter(event => {
          const eventDate = event.start ? new Date(event.start) : null;
          return eventDate && eventDate.toDateString() === date.toDateString();
        });

        const sortedEvents = dayEvents.sort((a, b) => {
          const aStart = a.start ? new Date(a.start).getTime() : 0;
          const bStart = b.start ? new Date(b.start).getTime() : 0;
          return aStart - bStart;
        });

        if (sortedEvents.length > 0) {
          const rect = cell.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const sidebarWidth = 320;
          const popupWidth = 295;
          const popupHeight = Math.min(300, sortedEvents.length * 80 + 60);
          const availableWidth = viewportWidth - sidebarWidth;

          let x = rect.right + 4;
          if (rect.right + popupWidth + 10 > availableWidth) {
            x = rect.left - popupWidth - 10;
            if (x < 0) {
              x = Math.max(10, availableWidth - popupWidth - 10);
            }
          }

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

    // Store references for cleanup
    (cell as any)._mouseEnterHandler = handleMouseEnter;
    (cell as any)._mouseLeaveHandler = handleMouseLeave;

    cell.addEventListener('mouseenter', handleMouseEnter);
    cell.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cell.removeEventListener('mouseenter', handleMouseEnter);
      cell.removeEventListener('mouseleave', handleMouseLeave);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      // Clean up references
      delete (cell as any)._mouseEnterHandler;
      delete (cell as any)._mouseLeaveHandler;
    };
  }, [setHoveredDay, hoverTimerRef, isModalOpen]);

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

    // Reset stuck hover states
    document.querySelectorAll('.fc-daygrid-day.hovered').forEach(day => {
      day.classList.remove('hovered');
    });
  }, []);

useEffect(() => {
  const handleMouseEnter = (e: Event) => {
    (e.target as HTMLElement).classList.add('hovered');
  };

  const handleMouseLeave = (e: Event) => {
    (e.target as HTMLElement).classList.remove('hovered');
  };

  const addListeners = () => {
    const days = document.querySelectorAll('.fc-daygrid-day');
    days.forEach(day => {
      day.addEventListener('mouseenter', handleMouseEnter);
      day.addEventListener('mouseleave', handleMouseLeave);
    });
  };

  addListeners();

  const observer = new MutationObserver(addListeners);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    document.querySelectorAll('.fc-daygrid-day').forEach(day => {
      day.removeEventListener('mouseenter', handleMouseEnter);
      day.removeEventListener('mouseleave', handleMouseLeave);
    });
  };
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
    start: event.start, // Use the formatted string directly - no conversion needed
    end: event.end, // Use the formatted string directly - no conversion needed
    backgroundColor: event.backgroundColor,
    borderColor: event.borderColor,
    extendedProps: event.extendedProps,
  })),
  ...(Array.isArray(dayMarkings) ? dayMarkings : [])
];


useEffect(() => {
  console.log('Current view:', currentView);
  console.log('Current date:', currentDate);
  console.log('Has initialized:', hasInitialized);
  if (calendarRef.current) {
    const api = calendarRef.current.getApi();
    console.log('FullCalendar current date:', api.getDate());
    console.log('FullCalendar view type:', api.view.type);
  }
}, [currentView, currentDate, hasInitialized]);

const handleEventResize = useCallback(async (resizeInfo: any) => {
  const event = resizeInfo.event;
  const eventId = event.extendedProps.originalId || event.id;
  
  const startDate = new Date(event.start!);
  const endDate = event.end ? new Date(event.end) : startDate;
  
  // Format times properly for 24-hour format
  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  
  const newPosition = {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    date: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`,
    start_time: formatTime(startDate),
    end_time: formatTime(endDate)
  };

  setCurrentEvents(prevEvents => 
    prevEvents.map(e => 
      (e.extendedProps?.originalId || e.id) === eventId
        ? {
            ...e,
            start: newPosition.start,
            end: newPosition.end
          }
        : e
    )
  );

  try {
    const result = await updateEvent(eventId, {
      date: newPosition.date,
      start_time: newPosition.start_time,
      end_time: newPosition.end_time
    });
    
    if (!result) {
      resizeInfo.revert();
      setError('Failed to update event duration');
    }
  } catch (err) {
    resizeInfo.revert();
    setError('Failed to update event duration');
  }
}, [updateEvent]);


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
            eventResizable={true}
            eventResize={handleEventResize}
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
            eventDidMount={(info) => {
              const eventColor = info.event.backgroundColor || info.event.borderColor || '#3788d8';
              const element = info.el;
              
              // Convert hex to HSL for better color manipulation
              const hsl = hexToHSL(eventColor);
              
              // Create dynamic background with tinting
              const lightness = Math.max(15, Math.min(85, hsl.l)); // Ensure readable contrast
              const saturation = Math.max(30, Math.min(90, hsl.s)); // Boost saturation for vibrancy
              
              // Base tinted background
              const baseColor = `hsla(${hsl.h}, ${saturation}%, ${lightness}%, 0.15)`;
              const borderColor = `hsla(${hsl.h}, ${saturation}%, ${Math.max(20, lightness - 20)}%, 0.3)`;
              const textColor = `hsla(${hsl.h}, ${Math.min(100, saturation + 10)}%, ${lightness > 50 ? 25 : 85}%, 0.95)`;
              
              // Apply the styling
              element.style.background = `
                linear-gradient(135deg, 
                  hsla(${hsl.h}, ${saturation}%, ${Math.min(95, lightness + 15)}%, 0.2) 0%,
                  ${baseColor} 40%,
                  hsla(${hsl.h}, ${saturation}%, ${Math.max(10, lightness - 10)}%, 0.18) 100%
                )
              `;
              
              element.style.border = `1px solid ${borderColor}`;
              element.style.color = textColor;
              
              // Add a subtle border glow
              element.style.boxShadow = `
                0 4px 12px rgba(0, 0, 0, 0.08),
                0 2px 4px rgba(0, 0, 0, 0.05),
                inset 0 1px 1px rgba(255, 255, 255, 0.1),
                0 0 0 1px hsla(${hsl.h}, ${saturation}%, ${lightness}%, 0.1)
              `;
              
              // Set CSS custom properties for hover effects
              element.style.setProperty('--hover-bg', `hsla(${hsl.h}, ${saturation}%, ${Math.min(95, lightness + 20)}%, 0.25)`);
              element.style.setProperty('--hover-border', `hsla(${hsl.h}, ${saturation}%, ${Math.max(20, lightness - 15)}%, 0.4)`);
              element.style.setProperty('--text-color', textColor);
              
              // Enhanced hover effect
              const addHoverEffect = () => {
                element.style.background = `
                  linear-gradient(135deg, 
                    hsla(${hsl.h}, ${saturation}%, ${Math.min(98, lightness + 25)}%, 0.28) 0%,
                    hsla(${hsl.h}, ${saturation}%, ${Math.min(90, lightness + 10)}%, 0.22) 40%,
                    hsla(${hsl.h}, ${saturation}%, ${Math.max(5, lightness - 5)}%, 0.25) 100%
                  )
                `;
                element.style.border = `1px solid hsla(${hsl.h}, ${saturation}%, ${Math.max(20, lightness - 15)}%, 0.4)`;
                element.style.boxShadow = `
                  0 8px 20px rgba(0, 0, 0, 0.12),
                  0 4px 8px rgba(0, 0, 0, 0.08),
                  inset 0 1px 2px rgba(255, 255, 255, 0.15),
                  0 0 0 1px hsla(${hsl.h}, ${saturation}%, ${lightness}%, 0.15)
                `;
              };
              
              const removeHoverEffect = () => {
                element.style.background = `
                  linear-gradient(135deg, 
                    hsla(${hsl.h}, ${saturation}%, ${Math.min(95, lightness + 15)}%, 0.2) 0%,
                    ${baseColor} 40%,
                    hsla(${hsl.h}, ${saturation}%, ${Math.max(10, lightness - 10)}%, 0.18) 100%
                  )
                `;
                element.style.border = `1px solid ${borderColor}`;
                element.style.boxShadow = `
                  0 4px 12px rgba(0, 0, 0, 0.08),
                  0 2px 4px rgba(0, 0, 0, 0.05),
                  inset 0 1px 1px rgba(255, 255, 255, 0.1),
                  0 0 0 1px hsla(${hsl.h}, ${saturation}%, ${lightness}%, 0.1)
                `;
              };
              
              element.addEventListener('mouseenter', addHoverEffect);
              element.addEventListener('mouseleave', removeHoverEffect);
              
              // Style the text elements specifically
              const titleElement = element.querySelector('.fc-event-title');
              const timeElement = element.querySelector('.fc-event-time');
              
              if (titleElement) {
                titleElement.style.color = textColor;
                titleElement.style.fontWeight = '600';
              }
              
              if (timeElement) {
                timeElement.style.color = textColor;
                timeElement.style.opacity = '0.9';
              }
            }}
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