import { useCallback, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventApi } from '@fullcalendar/core';

interface DayHoverInfo {
  date: Date;
  events: EventApi[];
  position: {
    x: number;
    y: number;
  };
}

interface UseDayHoverProps {
  calendarRef: React.RefObject<FullCalendar>;
  isModalOpen: boolean;
  hoverTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setHoveredDay: (day: DayHoverInfo | null) => void;
}

export function useDayHover({ 
  calendarRef, 
  isModalOpen, 
  hoverTimerRef, 
  setHoveredDay 
}: UseDayHoverProps) {
  
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
  }, [setHoveredDay, hoverTimerRef, isModalOpen, calendarRef]);

  // Day hover CSS effects
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

  return { handleDayCellDidMount };
}