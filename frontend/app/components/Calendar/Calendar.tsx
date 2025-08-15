import React, { useEffect, useRef, useMemo, useCallback, RefObject } from 'react';

// Extend the type for event.extendedProps to include frontendId and eventId
type ExtendedEventProps = {
  originalId?: string;
  location?: string;
  virtual?: boolean;
  urgency?: string;
  notes?: string;
  event_type?: string;
  category?: string;
  subcategories?: string;
  recurrence_pattern?: string;
  // isDayMarking?: boolean;
  // day_marking_title?: string;
  frontendId?: string;
  eventId?: string;
  [key: string]: any;
};

type EventDetails = {
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
  // day_marking_title?: string;
  frontendId?: string;
};
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import EventModal from '../EventModal';
// import DayMarkingHighlighter from '../DayMarkingHIghlighter';
import CustomCalendarHeader from '../CustomCalHeader';
import { DayDetailPopup } from './DayDetailPopup';

import { useCalendarLogic } from './useCalendarLogic';
import { useDayHover } from './useDayHover';
import { applyEventStyling, addEventHoverEffects, sortEventsByTime } from './calendarUtils';
import { useAppState, EventDetails as AppStateEventDetails } from '../../hooks/useAppState';

import '../../styles/calendar.css';
import '../../globals.css';

// ...existing code...

// Extend the type for event.extendedProps to include frontendId and eventId

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
    // dayMarkings,
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
    handleEventChange,
    handleDateSelect,
    handleDeleteEvent,
    handleEventResize,
    // handleDayMarkingsLoaded,
    handleModalOpen,
    handleModalClose,
    handleEventClick,
    handleViewChange, // New optimized handler
  } = useCalendarLogic(refreshTrigger, onEventChange, onViewChange);

  // Use day hover logic hook
  const { handleDayCellDidMount } = useDayHover({
  calendarRef: calendarRef as RefObject<FullCalendar>,
    isModalOpen,
    hoverTimerRef,
    setHoveredDay
  });

  // Optimized event drop handler
  const handleEventDropFixed = useCallback(async (dropInfo: { event: any; revert: () => void }) => {
    const event = dropInfo.event;
    const newStart = event.start;
    const newEnd = event.end;
    
    console.log('Event dropped - updating backend only:', {
      eventId: event.id,
      newStart,
      newEnd
    });
    
    try {
      const eventData = {
        date: newStart.toISOString().split('T')[0],
        start_time: newStart.toTimeString().slice(0, 8),
        end_time: newEnd ? newEnd.toTimeString().slice(0, 8) : null
      };

      const backendId = getBackendIdFromEvent(event);
      
      // Silent API call - don't wait for response or refresh UI
      updateEvent(backendId, eventData).catch(error => {
        console.error('Background update failed:', error);
      });
      
      console.log('Event drop completed - UI already updated');
      
    } catch (error) {
      console.error('Event drop error:', error);
      dropInfo.revert();
    }
  }, [updateEvent]);

  // Optimized event resize handler
  const handleEventResizeFixed = useCallback(async (resizeInfo: { event: any; revert: () => void }) => {
    const event = resizeInfo.event;
    const newStart = event.start;
    const newEnd = event.end;
    
    console.log('Event resized - updating backend only:', {
      eventId: event.id,
      newStart,
      newEnd
    });
    
    try {
      const eventData = {
        start_time: newStart.toTimeString().slice(0, 8),
        end_time: newEnd ? newEnd.toTimeString().slice(0, 8) : null
      };

      const backendId = getBackendIdFromEvent(event);
      
      updateEvent(backendId, eventData).catch(error => {
        console.error('Background resize update failed:', error);
      });
      
      console.log('Event resize completed - UI already updated');
      
    } catch (error) {
      console.error('Event resize error:', error);
      resizeInfo.revert();
    }
  }, [updateEvent]);

  // Helper function to extract backend ID
  const getBackendIdFromEvent = useCallback((fcEvent: { extendedProps?: ExtendedEventProps; id: string }) => {
    const originalId = fcEvent.extendedProps?.originalEventId;
    if (originalId) return originalId;
    
    const eventId = fcEvent.id;
    if (eventId.includes('_')) {
      return eventId.split('_')[0];
    }
    
    return eventId;
  }, []);

  // Memoized events preparation
  const allEvents = useMemo(() => [
    ...sortEventsByTime(currentEvents || []).map(event => ({
      id: (event.extendedProps as ExtendedEventProps)?.frontendId || event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      backgroundColor: event.backgroundColor,
      borderColor: event.borderColor,
      extendedProps: {
        ...(event.extendedProps as ExtendedEventProps),
        eventId: (event.extendedProps as ExtendedEventProps)?.eventId || event.id,
        frontendId: (event.extendedProps as ExtendedEventProps)?.frontendId || event.id,
        originalEventId: (event.extendedProps as ExtendedEventProps)?.originalId,
      },
    })),
    // ...(Array.isArray(dayMarkings) ? dayMarkings : [])
  ], [currentEvents]); // Removed dayMarkings from dependencies

  // Optimized events for day function
  const getEventsForDay = useCallback((date: Date) => {
    if (!currentEvents) return [];
    
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    return currentEvents.filter(event => {
      if (!event.start) return false;
      
      let eventStartDate: Date;
      if (typeof event.start === 'string') {
        if (event.start.length === 10 && !event.start.includes('T')) {
          eventStartDate = new Date(event.start + 'T00:00:00');
        } else {
          eventStartDate = new Date(event.start);
        }
      } else {
        eventStartDate = new Date(event.start);
      }
      
      const normalizedEventStart = new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), eventStartDate.getDate());
      const eventDateStr = normalizedEventStart.toISOString().split('T')[0];
      
      if (eventDateStr === targetDateStr) return true;
      
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
  }, [currentEvents]);

  // Memoized hovered day info
  const updatedHoveredDayInfo = useMemo(() => {
    return hoveredDay ? {
      ...hoveredDay,
      events: getEventsForDay(hoveredDay.date)
    } : null;
  }, [hoveredDay, getEventsForDay]);

  const calendarContainerRef = useRef<HTMLDivElement>(null);

  // Handle event edit from DayDetailPopup
  const handleEventEditFromPopup = useCallback((event: any) => {
    console.log('Event clicked from popup:', event);
  }, []);

  // Handle event update from DayDetailPopup
  const handleEventUpdateFromPopup = useCallback(async (eventDetails: EventDetails) => {
    try {
      console.log('Updating event from popup:', eventDetails);
      
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
        virtual: false,
        urgency: 'medium' as const,
        event_type: '',
        category: '',
        subcategories: '',
      };

      const result = await updateEvent(eventDetails.eventId, updateData);
      
      if (result) {
        console.log('Event updated successfully');
        if (onEventChange) {
          onEventChange();
        }
      } else {
        console.error('Failed to update event');
      }
    } catch (error) {
      console.error('Error updating event:', error);
    }
  }, [updateEvent, onEventChange]);

  const memoizedSelectedEvent = useMemo(() => {
    if (!selectedEvent) return null;
    return {
      ...selectedEvent,
      eventId: selectedEvent.eventId || '',
      start_time: selectedEvent.start_time ?? '',
      end_time: selectedEvent.end_time ?? ''
    };
  }, [selectedEvent]);

  // Optimized datesSet handler to prevent unnecessary onViewChange calls
  interface DatesSetInfo {
    view: {
      title: string;
      type: string;
      currentStart: Date;
    };
  }

  const handleDatesSet = useCallback((dateInfo: DatesSetInfo) => {
    setCurrentTitle(dateInfo.view.title);
    const newView = dateInfo.view.type;
    const newDate = dateInfo.view.currentStart;
    
    // Use the optimized handler that prevents unnecessary calls
    handleViewChange(newView, newDate);
  }, [setCurrentTitle, handleViewChange]);

  return (
    <div className='big-container'>
      <div className="flex h-screen">
        <div className="w-[306px]">
          {/* Your existing sidebar content */}
        </div>

        <div className="flex-1 flex flex-col">
          {/* <DayMarkingHighlighter
            onMarkingsLoaded={handleDayMarkingsLoaded}
          /> */}

          {/* Custom Header */}
          <CustomCalendarHeader 
            calendarRef={calendarRef}
            currentTitle={currentTitle}
            currentView={currentView}
            onViewChange={onViewChange}
          />

          {/* Calendar Container */}
          <div ref={calendarContainerRef} className="flex-1" style={{ 
            userSelect: 'none'
          }}>
            <style>
              {`
                .fc-highlight {
                  background: transparent !important;
                }
                .fc-selecting .fc-highlight {
                  background: transparent !important;
                }
              `}
            </style>
            {hasInitialized && (
            <FullCalendar
              ref={calendarRef as RefObject<FullCalendar>}
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
              // Removed invalid property 'eventResizable'
              
              eventDrop={handleEventDropFixed}
              eventResize={handleEventResizeFixed}
              
              eventTimeFormat={{
                hour: 'numeric',
                minute: '2-digit',
                meridiem: 'short',
                omitZeroMinute: true
              }}
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              events={allEvents}
              select={handleDateSelect}
              eventClick={handleEventClick}

              eventDidMount={(info) => {
                const eventColor = info.event.backgroundColor || info.event.borderColor || '#3788d8';
                const element = info.el as HTMLElement;
                
                const { hsl, lightness, saturation, baseColor, borderColor, textColor } = applyEventStyling(element, eventColor);
                
                addEventHoverEffects(element, hsl, saturation, lightness, baseColor, borderColor);
                
                const titleElement = element.querySelector('.fc-event-title') as HTMLElement;
                const timeElement = element.querySelector('.fc-event-time') as HTMLElement;
                const eventMain = element.querySelector('.fc-event-main') as HTMLElement;
                
                const isWeekView = info.view.type.includes('timeGrid');
                
                let isShortEvent = false;
                let isMediumEvent = false;
                let eventHeight = 0;
                
                if (isWeekView && info.event.start && info.event.end) {
                  const start = new Date(info.event.start);
                  const end = new Date(info.event.end);
                  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                  eventHeight = element.offsetHeight;
                  
                  if (durationMinutes <= 15) {
                    isShortEvent = true;
                  } else if (durationMinutes > 15 && durationMinutes <= 30) {
                    isMediumEvent = true;
                  }
                }
                
                if (eventMain) {
                  eventMain.style.overflow = 'visible';
                  eventMain.style.height = '100%';
                  eventMain.style.display = 'flex';
                  eventMain.style.flexDirection = 'column';
                  eventMain.style.justifyContent = 'flex-start';
                  
                  if (isWeekView) {
                    if (isShortEvent) {
                      eventMain.style.padding = '1px 2px 0px 6px';
                    } else if (isMediumEvent) {
                      eventMain.style.padding = '3px 3px 2px 5px';
                    } else {
                      eventMain.style.padding = '4px 3px 2px 4px';
                    }
                  } else {
                    eventMain.style.padding = '1px 2px';
                  }
                }
                
                if (isWeekView) {
                  if (isShortEvent) {
                    element.style.paddingLeft = '4px';
                    element.style.paddingTop = '0px';
                    element.style.transform = 'translateY(-1px)';
                  } else if (isMediumEvent) {
                    element.style.paddingLeft = '3px';
                    element.style.paddingTop = '2px';
                  } else {
                    element.style.paddingLeft = '2px';
                    element.style.paddingTop = '2px';
                  }
                }
                
                if (titleElement) {
                  titleElement.style.color = textColor;
                  titleElement.style.fontWeight = '570';
                  titleElement.style.whiteSpace = 'nowrap';
                  titleElement.style.overflow = 'visible';
                  
                  if (isWeekView) {
                    titleElement.style.lineHeight = '1';
                    if (isShortEvent) {
                      titleElement.style.fontSize = '12px';
                    } else if (isMediumEvent) {
                      titleElement.style.fontSize = '12px';
                    } else {
                      titleElement.style.fontSize = '13px';
                    }
                  } else {
                    titleElement.style.lineHeight = '1';
                    titleElement.style.fontSize = '12px';
                  }
                }
                
                if (timeElement) {
                  timeElement.style.color = textColor;
                  timeElement.style.opacity = '0.9';
                  timeElement.style.whiteSpace = 'nowrap';
                  timeElement.style.overflow = 'visible';
                  
                  if (isWeekView) {
                    timeElement.style.lineHeight = '1';
                    if (isShortEvent) {
                      timeElement.style.fontSize = '11px';
                    } else if (isMediumEvent) {
                      timeElement.style.fontSize = '11px';
                    } else {
                      timeElement.style.fontSize = '12px';
                    }
                  } else {
                    timeElement.style.lineHeight = '1';
                    timeElement.style.fontSize = '12px';
                  }
                }
              }}

              height="100%"
              allDaySlot={false}
              dayCellDidMount={handleDayCellDidMount}
              viewDidMount={(viewInfo) => {
                setCurrentTitle(viewInfo.view.title);
              }}
              datesSet={handleDatesSet}
              fixedWeekCount={false}

              aspectRatio={1.35}
              eventOrder="start,-duration,title"
            />
            )}
          </div>

          {/* Day Detail Popup */}
          {updatedHoveredDayInfo && !isModalOpen && (
            <DayDetailPopup 
              info={updatedHoveredDayInfo} 
              handleDeleteEvent={handleDeleteEvent}
              hoverTimerRef={hoverTimerRef}
              setHoveredDay={setHoveredDay}
              onEventEdit={handleEventEditFromPopup}
              onEventUpdate={handleEventUpdateFromPopup}
              calendarContainerRef={calendarContainerRef as React.RefObject<HTMLElement>}
            />
          )}

          {/* Event Modal */}
          {selectedEvent && (
            <EventModal
              isOpen={isModalOpen}
              onClose={handleModalClose}
              selectedEvent={selectedEvent ? { 
                ...selectedEvent, 
                eventId: selectedEvent.eventId || '', 
                start_time: selectedEvent.start_time ?? '', 
                end_time: selectedEvent.end_time ?? '', 
                all_day: selectedEvent.all_day ?? false
              } : null}
              position={modalPosition}
              calendarContainerRef={calendarContainerRef as React.RefObject<HTMLElement>}
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