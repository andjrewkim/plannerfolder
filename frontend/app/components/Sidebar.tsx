// Sidebar.tsx - Modified to display classes from usePlanner instead of notes
import React, { useEffect, useState, useRef, useCallback } from 'react';
import EventForm from './EventForm';
import '../styles/container.css';
import { useAppState, EventDetails } from '../hooks/useAppState';
import { usePlanner, PlannerClass } from '../hooks/usePlanner';

interface EventData {
  id?: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  event_type: string;
  recurrence_pattern: string;
  color: string;
  is_all_day: boolean;
  day_marking_title?: string;
  type?: string;
}

interface APIEvent {
  id: number;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  color: string;
  timingInfo?: {
    hoursUntil: number | null;
    status: 'upcoming' | 'ongoing' | 'past';
  };
}

interface SidebarProps {
  onEventChange?: () => void;
  refreshTrigger?: number;
}

interface SectionHeights {
  eventForm: number;
  schedule: number;
  classes: number;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onEventChange, 
  refreshTrigger
}) => {
  const {
    events,
    isLoading,
    error,
    initialized
  } = useAppState();

  const {
    classes,
    isLoading: plannerLoading,
    error: plannerError,
    initialized: plannerInitialized
  } = usePlanner();

  // Local state
  const [todayEvents, setTodayEvents] = useState<APIEvent[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [eventResults, setEventResults] = useState<EventData[]>([]);
  const [eventError, setEventError] = useState<string | null>(null);
  
  // Refs
  const isMountedRef = useRef<boolean>(true);

  // Section heights for resizing
  const [sectionHeights, setSectionHeights] = useState<SectionHeights>({
    eventForm: 250,
    schedule: 350,
    classes: 350
  });
  
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const heightsRef = useRef<SectionHeights>(sectionHeights);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Calculate hours until event
  const calculateHoursUntil = useCallback((
    date: string, 
    startTime: string, 
    endTime?: string
  ): { hoursUntil: number | null, status: 'upcoming' | 'ongoing' | 'past' } => {
    try {
      const dateStr = date.split('T')[0];
      let startTimeStr = startTime;
      
      if (startTime && !startTime.includes(':')) {
        console.warn('Invalid time format:', startTime);
        return { hoursUntil: null, status: 'past' };
      }
      
      if (startTimeStr && startTimeStr.split(':').length === 2) {
        startTimeStr += ':00';
      }
      
      const eventStartDateTime = new Date(`${dateStr}T${startTimeStr}`);
      
      if (isNaN(eventStartDateTime.getTime())) {
        console.error('Invalid date/time:', dateStr, startTimeStr);
        return { hoursUntil: null, status: 'past' };
      }
      
      const now = new Date();
      const startDiffMs = eventStartDateTime.getTime() - now.getTime();
      const startDiffHours = startDiffMs / (1000 * 60 * 60);
      
      if (endTime && endTime.trim()) {
        let endTimeStr = endTime;
        if (endTimeStr.split(':').length === 2) {
          endTimeStr += ':00';
        }
        const eventEndDateTime = new Date(`${dateStr}T${endTimeStr}`);
        
        if (!isNaN(eventEndDateTime.getTime())) {
          const endDiffMs = eventEndDateTime.getTime() - now.getTime();
          
          if (startDiffHours <= 0 && endDiffMs > 0) {
            return { hoursUntil: startDiffHours, status: 'ongoing' };
          }
        }
      }
      
      if (startDiffHours > 0) {
        return { hoursUntil: startDiffHours, status: 'upcoming' };
      } else {
        return { hoursUntil: startDiffHours, status: 'past' };
      }
    } catch (error) {
      console.error('Error calculating hours until event:', error, { date, startTime, endTime });
      return { hoursUntil: null, status: 'past' };
    }
  }, []);

  // Format hours until display
  const formatHoursUntil = useCallback((hours: number): string => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    } else if (hours < 24) {
      const wholeHours = Math.floor(hours);
      const minutes = Math.round((hours - wholeHours) * 60);
      if (minutes === 0) {
        return `${wholeHours}h`;
      }
      return `${wholeHours}h ${minutes}m`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.floor(hours % 24);
      if (remainingHours === 0) {
        return `${days}d`;
      }
      return `${days}d ${remainingHours}h`;
    }
  }, []);

  // Update today's events when events change
  useEffect(() => {
    if (!isMountedRef.current) return;

    if (events && events.length > 0) {
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const filteredEvents = events
        .filter((event: EventDetails) => {
          const eventDateString = event.date.split('T')[0];
          return eventDateString === todayString;
        })
        .map((event: EventDetails) => {
          const timingInfo = calculateHoursUntil(event.date, event.start_time || '', event.end_time || '');
          
          return {
            id: parseInt(event.id || event.eventId || '0'),
            event_name: event.event_name,
            date: event.date,
            start_time: event.start_time || '',
            end_time: event.end_time || '',
            color: event.color,
            timingInfo
          };
        })
        .sort((a, b) => {
          return a.start_time.localeCompare(b.start_time);
        });

      setTodayEvents(filteredEvents);
    } else {
      setTodayEvents([]);
    }
  }, [events, calculateHoursUntil]);

  // Event result handler
  const handleEventResult = useCallback(async (results: EventData[]) => {
    if (!isMountedRef.current) return;

    console.log('Event created - notifying parent component');
    setEventResults(results);
    
    if (onEventChange) {
      onEventChange();
    }
  }, [onEventChange]);

  // Format event time
  const formatEventTime = useCallback((date: string, time: string): string => {
    try {
      return new Date(`${date.split('T')[0]}T${time}`).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return time;
    }
  }, []);

  // Resize handlers
  const startResize = useCallback((section: string) => (e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    
    setActiveSection(section);
    setIsResizing(true);
    
    startYRef.current = e.clientY;
    startHeightRef.current = heightsRef.current[section as keyof SectionHeights];
    
    const sections = ['eventForm', 'schedule', 'classes'];
    const sectionIndex = sections.indexOf(section);
    const nextSectionIndex = sectionIndex + 1;
    const nextSection = nextSectionIndex < sections.length ? sections[nextSectionIndex] : null;
    
    document.body.classList.add('resizing');
    
    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const delta = moveEvent.clientY - startYRef.current;
      let newSectionHeight = Math.max(120, startHeightRef.current + delta);
      
      if (nextSection) {
        const nextSectionStartHeight = heightsRef.current[nextSection as keyof SectionHeights];
        const nextSectionNewHeight = Math.max(120, nextSectionStartHeight - delta);
        
        if (nextSectionNewHeight < 120) {
          newSectionHeight = startHeightRef.current + (nextSectionStartHeight - 120);
        }
        
        const newHeights = {
          ...heightsRef.current,
          [section]: newSectionHeight,
          [nextSection]: heightsRef.current[nextSection as keyof SectionHeights] - 
                        (newSectionHeight - heightsRef.current[section as keyof SectionHeights])
        };
        
        heightsRef.current = newHeights;
        
        const currentSection = document.querySelector(`.sidebar-section[data-section="${section}"]`) as HTMLElement;
        const nextSectionEl = document.querySelector(`.sidebar-section[data-section="${nextSection}"]`) as HTMLElement;
        
        if (currentSection && nextSectionEl) {
          currentSection.setAttribute('style', `height: ${newSectionHeight}px; min-height: 120px;`);
          nextSectionEl.setAttribute('style', `height: ${newHeights[nextSection as keyof typeof newHeights]}px; min-height: 120px;`);
        }
      }
    };
    
    const handleMouseUp = (): void => {
      setActiveSection(null);
      setIsResizing(false);
      document.body.classList.remove('resizing');
      setSectionHeights({...heightsRef.current});
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Cleanup resize effect
  useEffect(() => {
    return () => {
      document.body.classList.remove('resizing');
    };
  }, []);

  // Calculate dynamic sizing to fit all classes without scrolling
  const calculateClassDimensions = useCallback((containerHeight: number, classCount: number) => {
    if (classCount === 0) return { padding: '4px 6px', fontSize: '14px' };
    
    // Available height for all classes (subtract small buffer)
    const availableHeight = containerHeight - 8;
    
    // Total height per class including 1px gap (except for last item)
    const heightPerClass = availableHeight / classCount;
    
    // Calculate optimal padding - minimum content needs ~16px (text + spacing)
    const minContentHeight = 16;
    const availablePaddingHeight = Math.max(0, heightPerClass - minContentHeight);
    
    // Calculate vertical padding (split between top/bottom)
    const verticalPadding = Math.max(1, Math.floor(availablePaddingHeight / 2));
    
    // Adjust font size based on available space
    let fontSize = 14;
    if (heightPerClass < 20) fontSize = 12;
    else if (heightPerClass < 24) fontSize = 13;
    else if (heightPerClass > 40) fontSize = 15;
    
    return {
      padding: `${verticalPadding}px 6px`,
      fontSize: `${fontSize}px`
    };
  }, []);

  // Update heights ref
  useEffect(() => {
    heightsRef.current = sectionHeights;
  }, [sectionHeights]);

  // Determine error to display
  const displayError = localError || error || plannerError;

  // Loading state
  if (isLoading) {
    return (
      <div className="app-layout">
        <aside className="app-sidebar bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
          <div className="loading-message" style={{ padding: '20px', textAlign: 'center' }}>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside
        className="app-sidebar bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
        style={{ overflowY: 'auto', maxHeight: '100vh' }}
      >

        {/* Event Form Section */}
        <section 
          className={`sidebar-section ${activeSection === 'eventForm' ? 'resizing' : ''}`}
          data-section="eventForm"
          style={{ 
            marginTop: '10px', 
            height: `${sectionHeights.eventForm}px`,
            minHeight: '120px',
            transition: isResizing ? 'none' : 'height 0.2s ease-out'
          }}
        >
          <h3 className="section-title">Create Event</h3>
          <div className="section-content" style={{ 
            overflow: 'auto',
            height: 'calc(100% - 40px)',
            maxHeight: 'calc(100% - 40px)'
          }}>
            <EventForm 
              setResult={setEventResults} 
              setError={setEventError}
              onEventResult={handleEventResult}
            />
          </div>
          <div 
            className={`resize-handle ${activeSection === 'eventForm' ? 'resizing' : ''}`}
            onMouseDown={startResize('eventForm')}
          />
        </section>

        {/* Today's Schedule Section */}
        <section 
          className={`sidebar-section ${activeSection === 'schedule' ? 'resizing' : ''}`}
          data-section="schedule"
          style={{ 
            height: `${sectionHeights.schedule}px`,
            minHeight: '120px',
            transition: isResizing ? 'none' : 'height 0.2s ease-out'
          }}
        >
          <h3 className="section-title">Today's Schedule</h3>
          <div className="section-content" style={{ overflowY: 'auto', maxHeight: `${sectionHeights.schedule - 60}px` }}>
            {displayError && !isLoading ? (
              <div className="error-message" style={{ color: 'red', padding: '10px' }}>
                {displayError}
              </div>
            ) : todayEvents.length > 0 ? (
              <ul className="event-list">
                {todayEvents.map((event, index) => {
                  const { hoursUntil, status } = event.timingInfo || { hoursUntil: null, status: 'past' as const };
                  
                  const firstUpcomingIndex = todayEvents.findIndex(e => 
                    e.timingInfo?.status === 'upcoming'
                  );
                  
                  const showTimer = status === 'upcoming' && index === firstUpcomingIndex && hoursUntil !== null;
                  
                  return (
                    <li
                      key={event.id}
                      className="event-item"
                      style={{
                        '--event-color': event.color,
                        ...(status === 'past' && {
                          opacity: 0.5
                        }),
                        ...(status === 'ongoing' && {
                          backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        })
                      } as React.CSSProperties}
                    >
                      <span 
                        className="event-name"
                        style={{
                          ...(status === 'past' && {
                            textDecoration: 'line-through',
                            color: '#888'
                          })
                        }}
                      >
                        {event.event_name}
                        {status === 'ongoing' && (
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '11px',
                            color: '#007bff',
                            fontWeight: 'bold'
                          }}>
                            LIVE
                          </span>
                        )}
                      </span>
                      <span 
                        className="event-time"
                        style={{
                          ...(status === 'past' && {
                            textDecoration: 'line-through',
                            color: '#888'
                          })
                        }}
                      >
                        {showTimer && hoursUntil !== null && (
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: 'bold', 
                            color: '#007bff',
                            marginRight: '8px'
                          }}>
                            (in {formatHoursUntil(hoursUntil)})
                          </span>
                        )}
                        {status === 'ongoing' && event.end_time ? 
                          `ends at: ${formatEventTime(event.date, event.end_time)}` :
                          formatEventTime(event.date, event.start_time)
                        }
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty-state">No events for today</div>
            )}
          </div>
          <div 
            className={`resize-handle ${activeSection === 'schedule' ? 'active' : ''}`}
            onMouseDown={startResize('schedule')}
          />
        </section>

        {/* Classes Section */}
        <section 
          className="sidebar-section"
          data-section="classes"
          style={{ 
            height: `${sectionHeights.classes}px`,
            minHeight: '120px',
            transition: isResizing ? 'none' : 'height 0.2s ease-out'
          }}
        >
          <h3 className="section-title">My Classes</h3>
          <div 
            className="section-content"
            style={{ 
              height: `${sectionHeights.classes - 60}px`,
              padding: '4px 8px 4px 8px',
              overflow: 'hidden'
            }}
          >
            {plannerLoading ? (
              <div className="loading-message"></div>
            ) : plannerError ? (
              <div className="error-message" style={{ color: 'red' }}>
                Error loading classes: {plannerError}
              </div>
            ) : !plannerInitialized ? (
              <div className="loading-message"></div>
            ) : classes && classes.length > 0 ? (
              <div className="classes-list" style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
                height: '100%'
              }}>
                {classes
                  .sort((a, b) => a.order - b.order)
                  .map((plannerClass: PlannerClass, index) => {
                    const dimensions = calculateClassDimensions(sectionHeights.classes - 68, classes.length);
                    
                    return (
                      <div
                        key={plannerClass.id}
                        className="class-item"
                        style={{
                          padding: dimensions.padding,
                          backgroundColor: 'var(--muted, #f8f9fa)',
                          borderRadius: '3px',
                          color: 'var(--foreground, #000)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'background-color 0.1s ease',
                          flex: 1,
                          minHeight: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--accent, #e9ecef)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--muted, #f8f9fa)';
                        }}
                      >
                        <span 
                          className="class-number"
                          style={{
                            fontSize: dimensions.fontSize === '15px' ? '13px' : 
                                     dimensions.fontSize === '14px' ? '12px' : 
                                     dimensions.fontSize === '13px' ? '11px' : '10px',
                            color: 'var(--muted-foreground, #6c757d)',
                            fontWeight: '600',
                            minWidth: '12px',
                            textAlign: 'center'
                          }}
                        >
                          {index + 1}
                        </span>
                        <span 
                          className="class-name"
                          style={{
                            fontSize: dimensions.fontSize,
                            fontWeight: '500',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            lineHeight: '1.2'
                          }}
                        >
                          {plannerClass.name}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="empty-state" style={{ 
                padding: '8px 6px', 
                textAlign: 'center', 
                color: '#999',
                fontSize: '12px'
              }}>
                No classes
              </div>
            )}
          </div>
        </section>
      </aside>

      <main className="app-content">
        {eventError && (
          <div className="error-message" style={{ margin: '20px', color: 'red' }}>
            {eventError}
          </div>
        )}
      </main>
    </div>
  );
}

export default Sidebar;