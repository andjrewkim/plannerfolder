import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import { DateSelectArg, EventApi, EventDropArg, EventSourceInput, EventInput } from '@fullcalendar/core';
import { RRule } from 'rrule';
import { useAppState, EventDetails } from '../../hooks/useAppState';

// Types
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

// Helper functions
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

const saveScrollPosition = (calendarRef: React.RefObject<FullCalendar>) => {
  const calendar = calendarRef.current;
  if (!calendar) return null;
  
  const calendarApi = calendar.getApi();
  const view = calendarApi.view;
  
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

export function useCalendarLogic(refreshTrigger: number, onEventChange?: () => void, onViewChange?: (newView: string) => void) {
  // Use the centralized app state hook
  const {
    events: hookEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    isLoading: appStateLoading,
    error: appStateError,
  } = useAppState();

  // State
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
  // Add this new state to keep track of temporary events
  const [temporaryEvent, setTemporaryEvent] = useState<CustomEventInput | null>(null);

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
      
      const today = new Date();
      console.log('Today is:', today);
      
      let initialView = 'dayGridMonth';
      
      if (viewFromUrl && viewFromUrl in urlToViewMap) {
        initialView = urlToViewMap[viewFromUrl as keyof typeof urlToValueMap];
        console.log('Using view from URL:', initialView);
      } else {
        const savedView = sessionStorage.getItem('calendar-view');
        if (savedView && ['dayGridMonth', 'timeGridWeek', 'timeGridDay'].includes(savedView)) {
          initialView = savedView;
          console.log('Using view from sessionStorage:', initialView);
        }
      }
      
      setCurrentView(initialView);
      setCurrentDate(today);
      setHasInitialized(true);
      
      console.log('Initialization - view:', initialView, 'date:', today);
    }
  }, []);

  // Update URL when view changes with debouncing
  useEffect(() => {
    if (typeof window !== 'undefined' && hasInitialized && currentDate) {
      const timeoutId = setTimeout(() => {
        const url = new URL(window.location.href);
        const urlView = viewToUrlMap[currentView as keyof typeof viewToUrlMap];
        url.searchParams.set('view', urlView);
        
        const dateString = currentDate.toISOString().split('T')[0];
        url.searchParams.set('date', dateString);
        
        console.log('Updating URL with view:', urlView, 'and date:', dateString);
        
        window.history.replaceState({}, '', url.toString());
        sessionStorage.setItem('calendar-view', currentView);
        
        if (onViewChange) onViewChange(currentView);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [currentView, currentDate, onViewChange, hasInitialized]);

    // Helper function to expand recurring events
    const expandRecurringEvents = useMemo(() => {
    return (events: EventDetails[]): EventDetails[] => {
        if (!events.length) return [];
        
        const expandedEvents: EventDetails[] = [];
        const today = new Date();
        const futureLimit = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());
        
        // Track which event instances we've already added to prevent duplicates
        const addedInstances = new Set<string>();

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

            occurrences.forEach((occurrence) => {
                const eventDate = new Date(occurrence);
                const dateString = eventDate.toISOString().split('T')[0];
                
                // Create a unique identifier based on the original event ID and the specific date
                const uniqueInstanceId = `${event.id}_${dateString}`;
                
                // Only add if we haven't already added this specific instance
                if (!addedInstances.has(uniqueInstanceId)) {
                addedInstances.add(uniqueInstanceId);
                
                expandedEvents.push({
                    ...event,
                    id: uniqueInstanceId, // Use date-based ID instead of index-based
                    eventId: event.id,
                    date: dateString,
                    start_time: event.start_time,
                    end_time: event.end_time
                });
                }
            });
            } catch (error) {
            console.error('Error parsing RRule:', event.recurrence_pattern, error);
            // Only add the original event if we haven't already added it
            const uniqueInstanceId = `${event.id}_${event.date}`;
            if (!addedInstances.has(uniqueInstanceId)) {
                addedInstances.add(uniqueInstanceId);
                expandedEvents.push(event);
            }
            }
        } else {
            // For non-recurring events, use the same pattern for consistency
            const uniqueInstanceId = `${event.id}_${event.date}`;
            if (!addedInstances.has(uniqueInstanceId)) {
            addedInstances.add(uniqueInstanceId);
            expandedEvents.push(event);
            }
        }
        });

        return expandedEvents;
    };
    }, [hookEvents]);


  // Convert events from useAppState to FullCalendar format
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

    // Add temporary event if it exists and modal is open
    if (temporaryEvent && isModalOpen) {
      formatted.push(temporaryEvent);
    }

    if (isDragging && draggedEventPosition && originalEventPosition) {
      const events = [];
      formatted.forEach(event => {
        const eventId = event.extendedProps?.originalId || event.id;
        
        if (eventId === draggedEventId) {
          events.push({
            ...event,
            id: `${event.id}_ghost`,
            start: originalEventPosition.start,
            end: originalEventPosition.end,
            backgroundColor: event.backgroundColor + '40',
            borderColor: event.borderColor + '40',
            extendedProps: {
              ...event.extendedProps,
              isGhost: true
            }
          });
          
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
  }, [hookEvents, expandRecurringEvents, isDragging, draggedEventPosition, originalEventPosition, draggedEventId, temporaryEvent, isModalOpen]);

  // Update currentEvents when formattedEvents change
  useEffect(() => {
    setCurrentEvents(formattedEvents);
  }, [formattedEvents]);

  // Simplified refresh effect
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('Calendar refresh triggered:', refreshTrigger);
    }
  }, [refreshTrigger]);

  // Fixed positioning - always put modal in the exact same spot relative to the event
  const calculateOptimalModalPosition = useCallback((eventRect: DOMRect) => {
    // Fixed offset: 20px to the right and 10px down from the top-left of the event
    const fixedOffsetX = 200;
    const fixedOffsetY = 10;
    
    // Use the event's position plus our fixed offset
    return {
      x: eventRect.left + fixedOffsetX,
      y: eventRect.top + fixedOffsetY
    };
  }, []);

  // Event handlers
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
        result = await updateEvent(selectedEvent.eventId, formattedEvent);
      } else {
        result = await createEvent(formattedEvent);
      }
      
      if (result) {
        setIsModalOpen(false);
        setTemporaryEvent(null); // Clear temporary event
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

    setIsDragging(false);
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
      const updated = {
        ...prev,
        [field]: value
      };
      
      // Update temporary event if modal is open for new event
      if (isModalOpen && !prev.eventId) {
        const tempEvent: CustomEventInput = {
          id: 'temp-event',
          title: updated.event_name || 'New Event',
          start: formatToISOString(updated.date, updated.start_time),
          end: formatToISOString(updated.date, updated.end_time),
          backgroundColor: updated.color || '#3788d8',
          borderColor: updated.color || '#3788d8',
          extendedProps: {
            originalId: 'temp',
            location: updated.location || '',
            virtual: updated.virtual || false,
            urgency: updated.urgency || 'medium',
            notes: updated.notes || '',
            event_type: updated.event_type || '',
            category: updated.category || '',
            subcategories: updated.subcategories || '',
            recurrence_pattern: updated.recurrence_pattern || '',
            isDayMarking: updated.event_type === 'marking',
            day_marking_title: updated.day_marking_title
          }
        };
        setTemporaryEvent(tempEvent);
      }
      
      return updated;
    });
  }, [isModalOpen]);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    setHoveredDay(null);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    const startDate = selectInfo.start;
    const endDate = selectInfo.end || new Date(startDate.getTime() + 3600000);

    const targetEl = selectInfo.jsEvent?.target as Element;
    if (targetEl) {
      const targetRect = targetEl.getBoundingClientRect();
      const optimalPosition = calculateOptimalModalPosition(targetRect);
      setModalPosition(optimalPosition);
    }

    const formatTime = (date: Date) => {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    const newEvent = {
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
    };

    setSelectedEvent(newEvent);

    // Create temporary event for display
    const tempEvent: CustomEventInput = {
      id: 'temp-event',
      title: 'New Event',
      start: formatToISOString(newEvent.date, newEvent.start_time),
      end: formatToISOString(newEvent.date, newEvent.end_time),
      backgroundColor: newEvent.color,
      borderColor: newEvent.color,
      extendedProps: {
        originalId: 'temp',
        location: '',
        virtual: false,
        urgency: 'medium',
        notes: '',
        event_type: '',
        category: '',
        subcategories: '',
        recurrence_pattern: '',
        isDayMarking: false,
        day_marking_title: undefined
      }
    };
    
    setTemporaryEvent(tempEvent);
    
    // Small delay to prevent the flash
    requestAnimationFrame(() => {
      setIsModalOpen(true);
    });
  }, [calculateOptimalModalPosition]);

  const handleDeleteEvent = async (eventId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
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

  const handleEventResize = useCallback(async (resizeInfo: any) => {
    const event = resizeInfo.event;
    const eventId = event.extendedProps.originalId || event.id;
    
    const startDate = new Date(event.start!);
    const endDate = event.end ? new Date(event.end) : startDate;
    
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

  const handleDayMarkingsLoaded = useCallback((markings: EventSourceInput) => {
    setDayMarkings(markings);
  }, []);

  const handleModalOpen = useCallback(() => {
    setHoveredDay(null);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsModalOpen(true);
  }, []);

  const handleEventClick = useCallback((clickInfo: any) => {
    if (clickInfo.event.extendedProps?.event_type === 'marking') {
      return;
    }

    // Don't open modal for temporary events
    if (clickInfo.event.id === 'temp-event') {
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
    const eventRect = eventEl.getBoundingClientRect();
    
    // Use the fixed positioning logic
    const optimalPosition = calculateOptimalModalPosition(eventRect);
    setModalPosition(optimalPosition);

    const selectedEv = {
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
      color: event.backgroundColor || '#3788d8',
      day_marking_title: event.extendedProps?.day_marking_title
    };

    setSelectedEvent(selectedEv);
    
    // Small delay to prevent the flash you mentioned
    requestAnimationFrame(() => {
      setIsModalOpen(true);
    });
  }, [hoverTimerRef, calculateOptimalModalPosition]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setTemporaryEvent(null); // Clear temporary event when modal closes
    document.querySelectorAll('.fc-daygrid-day.hovered').forEach(day => {
      day.classList.remove('hovered');
    });
  }, []);

  return {
    // State
    currentEvents,
    dayMarkings,
    isModalOpen,
    selectedEvent,
    modalPosition,
    isLoading,
    hoveredDay,
    currentTitle,
    currentView,
    currentDate,
    hasInitialized,
    isDragging,
    calendarRef,
    hoverTimerRef,
    formattedEvents,
    
    // Setters
    setCurrentEvents,
    setHoveredDay,
    setCurrentTitle,
    setCurrentView,
    setCurrentDate,
    setIsDragging,
    setDraggedEventPosition,
    setDraggedEventId,
    setOriginalEventPosition,
    
    // Handlers
    handleEventSubmit,
    handleEventDrop,
    handleEventChange,
    handleDateSelect,
    handleDeleteEvent,
    handleEventResize,
    handleDayMarkingsLoaded,
    handleModalOpen,
    handleModalClose,
    handleEventClick,
    
    // Utils
    saveScrollPosition,
    restoreScrollPosition
  };
}