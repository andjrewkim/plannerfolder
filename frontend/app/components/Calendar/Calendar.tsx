import React, { useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import EventModal from '../EventModal';
import DayMarkingHighlighter from '../DayMarkingHIghlighter';
import CustomCalendarHeader from '../CustomCalHeader';
import { DayDetailPopup } from './DayDetailPopup';

import { useCalendarLogic } from './useCalendarLogic';
import { useDayHover } from './useDayHover';
import { applyEventStyling, addEventHoverEffects, sortEventsByTime } from './calendarUtils';
import { useAppState, EventDetails as AppStateEventDetails } from '../../hooks/useAppState';

import '../../styles/calendar.css';
import '../../globals.css';

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

interface CalendarProps {
  refreshTrigger: number;
  onEventChange?: () => void;
  onViewChange?: (newView: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({ onEventChange, onViewChange, refreshTrigger }) => {
  
  // Use useAppState hook
  const { updateEvent } = useAppState();
  
  // Use custom hook for all calendar logic
  const {
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
    calendarRef,
    hoverTimerRef,
    formattedEvents,
    
    // Setters
    setHoveredDay,
    setCurrentTitle,
    setCurrentView,
    setCurrentDate,
    
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
    handleEventClick, // Add this handler from the hook
  } = useCalendarLogic(refreshTrigger, onEventChange, onViewChange);

  // Use day hover logic hook
  const { handleDayCellDidMount } = useDayHover({
    calendarRef,
    isModalOpen,
    hoverTimerRef,
    setHoveredDay
  });

  // Prepare all events for FullCalendar - FIXED to use proper IDs
  const allEvents = [
    ...sortEventsByTime(currentEvents || []).map(event => ({
      // Use frontendId for FullCalendar's internal tracking (prevents duplicates)
      id: event.extendedProps?.frontendId || event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      backgroundColor: event.backgroundColor,
      borderColor: event.borderColor,
      extendedProps: {
        ...event.extendedProps,
        // Ensure we keep track of both IDs
        eventId: event.extendedProps?.eventId || event.id, // For API calls
        frontendId: event.extendedProps?.frontendId || event.id, // For React keys
        originalEventId: event.extendedProps?.originalEventId, // For backend operations
      },
    })),
    ...(Array.isArray(dayMarkings) ? dayMarkings : [])
  ];

  // Helper function to get current events for a specific day
  const getEventsForDay = (date: Date) => {
    if (!currentEvents) return [];
    
    // Normalize the target date to avoid timezone issues
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    return currentEvents.filter(event => {
      if (!event.start) return false;
      
      // Handle different date formats
      let eventStartDate: Date;
      if (typeof event.start === 'string') {
        // If it's a date-only string (all-day event)
        if (event.start.length === 10 && !event.start.includes('T')) {
          eventStartDate = new Date(event.start + 'T00:00:00');
        } else {
          eventStartDate = new Date(event.start);
        }
      } else {
        eventStartDate = new Date(event.start);
      }
      
      // Normalize event start date
      const normalizedEventStart = new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), eventStartDate.getDate());
      const eventDateStr = normalizedEventStart.toISOString().split('T')[0];
      
      // Check if the event is on the target date
      if (eventDateStr === targetDateStr) return true;
      
      // Check if it's a multi-day event that spans the target date
      if (event.end) {
        let eventEndDate: Date;
        if (typeof event.end === 'string') {
          if (event.end.length === 10 && !event.end.includes('T')) {
            eventEndDate = new Date(event.end + 'T23:59:59');
          } else {
            eventEndDate = new Date(event.end);
          }
        } else {
          eventEndDate = new Date(event.end);
        }
        
        const normalizedEventEnd = new Date(eventEndDate.getFullYear(), eventEndDate.getMonth(), eventEndDate.getDate());
        const eventEndStr = normalizedEventEnd.toISOString().split('T')[0];
        
        return targetDateStr >= eventDateStr && targetDateStr <= eventEndStr;
      }
      
      return false;
    });
  };

  // Create updated hoveredDay info with current events
  const updatedHoveredDayInfo = hoveredDay ? {
    ...hoveredDay,
    events: getEventsForDay(hoveredDay.date)
  } : null;

  // Debug logging
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

  const calendarContainerRef = useRef<HTMLDivElement>(null); // For modal positioning

  // Handle event edit from DayDetailPopup
  const handleEventEditFromPopup = (event: any) => {
    console.log('Event clicked from popup:', event);
    // This is called when an event is clicked in the popup
    // The DayDetailPopup will handle opening its own modal
  };

  // Handle event update from DayDetailPopup - FIXED to use proper event ID
  const handleEventUpdateFromPopup = async (eventDetails: EventDetails) => {
    try {
      console.log('Updating event from popup:', eventDetails);
      
      // Convert EventDetails to the format expected by useAppState
      const updateData: Partial<AppStateEventDetails> = {
        event_name: eventDetails.event_name,
        date: eventDetails.date,
        start_time: eventDetails.start_time,
        end_time: eventDetails.end_time,
        location: eventDetails.location,
        notes: eventDetails.notes,
        recurrence_pattern: eventDetails.recurrence_pattern,
        color: eventDetails.color,
        all_day: eventDetails.all_day,
        // Keep other fields that might be needed with defaults
        virtual: false,
        urgency: 'medium' as const,
        event_type: '',
        category: '',
        subcategories: '',
      };

      // Use the eventId directly - useAppState will handle extracting the backend ID
      const result = await updateEvent(eventDetails.eventId, updateData);
      
      if (result) {
        console.log('Event updated successfully');
        // Trigger refresh if needed
        if (onEventChange) {
          onEventChange();
        }
      } else {
        console.error('Failed to update event');
      }
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  const calculateMaxEvents = () => {
    const screenHeight = window.innerHeight;
    if (screenHeight >= 2160) return false; // 4K - no limit, fit all events
    if (screenHeight >= 1440) return 6;     // 1440p - 6 events
    if (screenHeight >= 600) return 4;     // 1080p - 4 events  
    return 3;                               // smaller screens - 3 events
  };

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

          {/* Calendar Container - Use calendarContainerRef here */}
          <div ref={calendarContainerRef} className="flex-1">
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
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventDidMount={(info) => {
                const eventColor = info.event.backgroundColor || info.event.borderColor || '#3788d8';
                const element = info.el;
                
                // Apply styling using utility function
                const { hsl, lightness, saturation, baseColor, borderColor, textColor } = applyEventStyling(element, eventColor);
                
                // Add hover effects using utility function
                addEventHoverEffects(element, hsl, saturation, lightness, baseColor, borderColor);
                
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
              }}
              datesSet={(dateInfo) => {
                setCurrentTitle(dateInfo.view.title);
                const newView = dateInfo.view.type;
                const newDate = dateInfo.view.currentStart;
                
                if (newView !== currentView) {
                  setCurrentView(newView);
                  if (onViewChange) onViewChange(newView);
                }
                if (Math.abs(newDate.getTime() - (currentDate?.getTime() || 0)) > 24 * 60 * 60 * 1000) {
                  setCurrentDate(newDate);
                }
              }}
              fixedWeekCount={false}

              aspectRatio={1.35} // Controls height ratio
              eventOrder="start,-duration,title"
            />
            )}
          </div>

          {/* Day Detail Popup - Now uses updatedHoveredDayInfo with current events */}
          {updatedHoveredDayInfo && !isModalOpen && (
            <DayDetailPopup 
              info={updatedHoveredDayInfo} 
              handleDeleteEvent={handleDeleteEvent}
              hoverTimerRef={hoverTimerRef}
              setHoveredDay={setHoveredDay}
              onEventEdit={handleEventEditFromPopup}
              onEventUpdate={handleEventUpdateFromPopup}
              calendarContainerRef={calendarContainerRef}
            />
          )}

          {/* Event Modal - Use calendarContainerRef here */}
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
              calendarContainerRef={calendarContainerRef}
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