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

interface DayHoverInfo {
  date: Date;
  events: EventApi[];
  position: {
    x: number;
    y: number;
  };
}

interface CalendarProps {
  onEventChange?: () => void;
}

const Calendar: React.FC<CalendarProps> = ({ onEventChange }) => {
  const [currentEvents, setCurrentEvents] = useState<EventApi[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [hoveredDay, setHoveredDay] = useState<DayHoverInfo | null>(null);
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);
  const calendarRef = useRef(null);
  const shouldFetch = useRef(true);
  const currentEventsRef = useRef(currentEvents); // Add this line
  const hoverTimerRef = useRef(null);

  // Update the ref whenever currentEvents changes
  useEffect(() => {
    currentEventsRef.current = currentEvents;
  }, [currentEvents]);

  const fetchEvents = useCallback(async () => {
    if (!shouldFetch.current) return;
    shouldFetch.current = false;
    
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
      setError('Failed to fetch events');
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const refreshEvents = () => {
    shouldFetch.current = true;
    fetchEvents();
  };

  const formatToISOString = (date: string, time: string) => {
    const [hours, minutes] = time.split(':');
    const dateObj = new Date(date);
    dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
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
        refreshEvents();
        if (onEventChange) onEventChange();
        setError(null);
      } else {
        throw new Error('Failed to save event');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to save event');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventDrop = useCallback((dropInfo: EventDropArg) => {
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

        fetch(`http://127.0.0.1:8000/api/events/${event.id}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFToken(),
      },
      credentials: 'include',
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
    .catch(error => {
      console.error('Error:', error);
      dropInfo.revert();
      setError('Failed to update event position');
    });
  }, [onEventChange]);

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
  

  const getCSRFToken = () => {
    return document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1] || '';
  };






  const handleDayCellDidMount = useCallback((info) => {
    const cell = info.el;

    const handleMouseEnter = () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      hoverTimerRef.current = setTimeout(() => {
        const date = info.date;
        const dayEvents = currentEventsRef.current.filter(event => {
          const eventDate = new Date(event.start);
          return eventDate.toDateString() === date.toDateString();
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
      }, 300); // Delay before showing the popup
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
      }, 100); // Delay before hiding the popup
    };

    cell.addEventListener('mouseenter', handleMouseEnter);
    cell.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cell.removeEventListener('mouseenter', handleMouseEnter);
      cell.removeEventListener('mouseleave', handleMouseLeave);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const DayDetailPopup = ({ info }) => {
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
        <div className="space-y-2">
          {info.events.map((event) => (
            <div
              key={event.id}
              className="p-2 rounded"
              style={{
                borderLeft: `4px solid ${event.backgroundColor}`,
                backgroundColor: `${event.backgroundColor}15`
              }}
            >
              <div className="font-medium">{event.title}</div>
              <div className="text-sm text-gray-600">
                {new Date(event.start).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit'
                })}
                {event.end && ` - ${new Date(event.end).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit'
                })}`}
              </div>
              {event.extendedProps.location && (
                <div className="text-sm text-gray-600 mt-1">
                  📍 {event.extendedProps.location}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
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
          dayMaxEventRows={false}
          displayEventEnd={false}
          events={currentEvents}
          select={handleDateSelect}
          eventClick={(clickInfo) => {
            const event = clickInfo.event;
            const startDate = new Date(event.start);
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
          }}
          eventDrop={handleEventDrop}
          height="85vh"
          allDaySlot={false}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          dayCellDidMount={handleDayCellDidMount}
        />
      </div>

      {hoveredDay && <DayDetailPopup info={hoveredDay} />}

      {selectedEvent && (
        <EventModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          selectedEvent={selectedEvent}
          setResult={setResult}
          setError={setError}
          onSubmit={handleEventSubmit}
          onDelete={async (eventId) => {
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
                refreshEvents();
                if (onEventChange) onEventChange();
                setError(null);
              } else {
                throw new Error('Failed to delete event');
              }
            } catch (error) {
              console.error('Error:', error);
              setError('Failed to delete event');
            } finally {
              setIsLoading(false);
            }
          }}
        />
      )}
    </div>
  );
};

export default Calendar;