import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Trash2 } from 'lucide-react';
import { formatTime, formatDate } from './calendarUtils';
import EventModal from '../EventModal'

interface EventDetails {
  eventId: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
  recurrence_pattern: string;
  color: string;
  all_day: boolean;
  day_marking_title?: string;
}

interface DayDetailPopupProps {
  info: {
    date: Date;
    events: any[];
    position: { x: number; y: number };
  };
  handleDeleteEvent: (id: string) => Promise<boolean>;
  hoverTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setHoveredDay: (d: any) => void;
  // Add these new props for event modal functionality
  onEventEdit?: (event: any) => void;
  onEventUpdate?: (event: EventDetails) => void;
  calendarContainerRef?: React.RefObject<HTMLElement>;
}

export const DayDetailPopup: React.FC<DayDetailPopupProps> = ({
  info,
  handleDeleteEvent,
  hoverTimerRef,
  setHoveredDay,
  onEventEdit,
  onEventUpdate,
  calendarContainerRef,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  
  // Event modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null);
  const [eventModalPosition, setEventModalPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Local events state for instant updates
  const [localEvents, setLocalEvents] = useState(info.events);

  // Sync local events with props when info changes
  useEffect(() => {
    setLocalEvents(info.events);
  }, [info.events]);

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
  const fmtTime = (d: Date) => formatTime(d, false);
  const fmtDate = (d: Date) => formatDate(d);

  // Convert event to EventDetails format
  const convertToEventDetails = (event: any): EventDetails => {
    const start = event.start ? new Date(event.start) : null;
    const end = event.end ? new Date(event.end) : null;
    
    return {
      eventId: event.id || '',
      event_name: event.title || '',
      date: start ? start.toISOString().split('T')[0] : info.date.toISOString().split('T')[0],
      start_time: start && !event.allDay ? start.toTimeString().slice(0, 5) : '',
      end_time: end && !event.allDay ? end.toTimeString().slice(0, 5) : '',
      location: event.location || '',
      notes: event.notes || event.description || '',
      recurrence_pattern: event.recurrence_pattern || '',
      color: event.backgroundColor || event.borderColor || '#FF6B6B',
      all_day: event.allDay || false,
      day_marking_title: event.day_marking_title
    };
  };

  // Handle event click
  const handleEventClick = (event: any, clickEvent: React.MouseEvent) => {
    // Stop propagation to prevent any parent handlers
    clickEvent.stopPropagation();
    
    // Convert event to EventDetails format
    const eventDetails = convertToEventDetails(event);
    setSelectedEvent(eventDetails);
    
    // Set modal position relative to the clicked event
    const rect = clickEvent.currentTarget.getBoundingClientRect();
    setEventModalPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    
    setIsEventModalOpen(true);
    
    // Call optional callback
    if (onEventEdit) {
      onEventEdit(event);
    }
  };

  // Handle event modal submit
  const handleEventModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEvent && onEventUpdate) {
      try {
        // Call the parent's update function
        await onEventUpdate(selectedEvent);
        
        // Update the local events immediately for instant UI feedback
        setLocalEvents(prevEvents => 
          prevEvents.map(event => {
            if (event.id === selectedEvent.eventId) {
              return {
                ...event,
                title: selectedEvent.event_name,
                start: selectedEvent.all_day 
                  ? selectedEvent.date 
                  : `${selectedEvent.date}T${selectedEvent.start_time}`,
                end: selectedEvent.all_day 
                  ? selectedEvent.date 
                  : (selectedEvent.end_time ? `${selectedEvent.date}T${selectedEvent.end_time}` : undefined),
                allDay: selectedEvent.all_day,
                backgroundColor: selectedEvent.color,
                borderColor: selectedEvent.color,
                location: selectedEvent.location,
                notes: selectedEvent.notes,
                description: selectedEvent.notes,
                recurrence_pattern: selectedEvent.recurrence_pattern,
              };
            }
            return event;
          })
        );
        
        setIsEventModalOpen(false);
        setSelectedEvent(null);
        setEventModalPosition(null);
      } catch (error) {
        console.error('Error updating event:', error);
      }
    }
  };

  // Handle event modal close
  const handleEventModalClose = () => {
    setIsEventModalOpen(false);
    setSelectedEvent(null);
    setEventModalPosition(null);
  };

  // Handle event modal field changes
  const handleEventModalChange = (field: keyof EventDetails, value: string | boolean) => {
    if (selectedEvent) {
      setSelectedEvent({
        ...selectedEvent,
        [field]: value
      });
    }
  };

  // Handle event modal delete
  const handleEventModalDelete = async (eventId: string) => {
    const success = await handleDeleteEvent(eventId);
    if (success) {
      // Remove from local events immediately for instant UI feedback
      setLocalEvents(prevEvents => 
        prevEvents.filter(event => event.id !== eventId)
      );
      
      setIsEventModalOpen(false);
      setSelectedEvent(null);
      setEventModalPosition(null);
    }
  };

  return (
    <>
      <motion.div
        ref={popupRef}
        className="popup-details fixed z-50 rounded-xl border"
        style={{
          padding: '4px',
          left: info.position.x,
          top: info.position.y,
          width: 300,
          maxHeight: 360,
          backgroundColor: 'hsl(var(--card) / 0.6)',      
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
            backgroundColor: 'hsl(var(--accent) / 0.15)',
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
            overflowX: 'clip',
            maxHeight: 300, 
            position: 'relative', 
            paddingTop: 12,
            paddingLeft: 12,
            paddingRight: 12
          }}
        >
          <AnimatePresence>
            {localEvents.map((ev, i) => {
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
                    onClick={(e) => handleEventClick(ev, e)}
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
                        title={ev.title}
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
                        <button 
                          title="Delete" 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent event modal from opening
                            handleDeleteEvent(ev.id);
                          }}
                        >
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
          {localEvents.length === 0 && (
            <div className="py-6 text-center" style={{ color: 'hsl(var(--muted) / 0.5)' }}>
              <Calendar className="w-6 h-6 mx-auto mb-1" />
              <div style={{ fontSize: 14, fontWeight: 500 }}>No events</div>
              <div className="text-xs">Enjoy your day!</div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Event Modal */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={handleEventModalClose}
        selectedEvent={selectedEvent}
        position={eventModalPosition}
        onSubmit={handleEventModalSubmit}
        onDelete={handleEventModalDelete}
        onChange={handleEventModalChange}
        calendarContainerRef={calendarContainerRef}
      />
    </>
  );
};