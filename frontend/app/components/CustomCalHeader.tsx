import React, { useState, RefObject } from 'react';
import Link from 'next/link';
import '../styles/calendarheader.css';

// Define the FullCalendar API interface
interface FullCalendarApi {
  prev(): void;
  next(): void;
  today(): void;
  changeView(viewName: string): void;
}

// Define the calendar ref interface
interface CalendarRef {
  getApi(): FullCalendarApi;
}

// Define view types for the main app views
type ViewType = 'calendar' | 'your-new-view';

// Define the component props interface
interface CustomCalendarHeaderProps {
  calendarRef: RefObject<CalendarRef | null>;
  currentTitle: string;
  currentView: string;
  onViewChange?: (view: string) => void;
  isAuthenticated?: boolean;
  rightSidebarOpen?: boolean;
  activeAppView?: ViewType;
  onAppViewChange?: (view: ViewType) => void;
}

const CustomCalendarHeader: React.FC<CustomCalendarHeaderProps> = ({ 
  calendarRef, 
  currentTitle,
  currentView,
  onViewChange,
  isAuthenticated = false,
  activeAppView = 'calendar',
  onAppViewChange
}) => {
  const handlePrevious = (): void => {
    if (calendarRef.current) {
      calendarRef.current.getApi().prev();
    }
  };

  const handleNext = (): void => {
    if (calendarRef.current) {
      calendarRef.current.getApi().next();
    }
  };

  const handleToday = (): void => {
    if (calendarRef.current) {
      calendarRef.current.getApi().today();
    }
  };

  const handleViewChange = (view: string): void => {
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(view);
    }
    if (onViewChange) {
      onViewChange(view);
    }
  };

  const handleAppViewChange = (view: ViewType): void => {
    if (onAppViewChange) {
      onAppViewChange(view);
    }
  };

  interface ViewOption {
    key: string;
    label: string;
    icon: string;
  }

  const viewOptions: ViewOption[] = [
    { key: 'dayGridMonth', label: 'Month', icon: '⬜' },
    { key: 'timeGridWeek', label: 'Week', icon: '▦' },
    { key: 'timeGridDay', label: 'Day', icon: '▬' }
  ];

  const renderNavItems = () => {
    if (!isAuthenticated) {
      return (
        <Link href="/help">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </Link>
      );
    }

    return (
      <>
        <Link href="/search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </Link>
        <Link href="/help">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </Link>
        <Link href="/settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </Link>
      </>
    );
  };

  return (
    <div className="advanced-calendar-header">
      <div className="header-container">
        {/* Left: App View Switcher */}
        <div className="app-view-switcher">
          <button
            className={`app-view-btn ${activeAppView === 'calendar' ? 'active' : ''}`}
            onClick={() => handleAppViewChange('calendar')}
          >
            Calendar
          </button>
          <button
            className={`app-view-btn ${activeAppView === 'your-new-view' ? 'active' : ''}`}
            onClick={() => handleAppViewChange('your-new-view')}
          >
            Planner
          </button>
        </div>

        {/* Left-Center: Calendar Navigation (calendar view only) */}
        {activeAppView === 'calendar' && (
          <div className="nav-section">
            <div className="nav-group">
              <button onClick={handlePrevious} className="nav-btn nav-prev">
                <span className="nav-icon">‹</span>
              </button>
              
              <button onClick={handleToday} className="nav-btn nav-today">
                <span className="today-dot"></span>
                <span className="nav-text">Today</span>
              </button>
              
              <button onClick={handleNext} className="nav-btn nav-next">
                <span className="nav-icon">›</span>
              </button>
            </div>
          </div>
        )}

        {/* Center: Title */}
        <div className="title-section">
          <div className="title-container">
            <h1 className="calendar-title">
              <span className="title-text">
                {activeAppView === 'calendar' ? currentTitle : 'Planner'}
              </span>
            </h1>
          </div>
        </div>

        {/* Right-Center: View Selector (calendar view only) */}
        {activeAppView === 'calendar' && (
          <div className="view-section">
            <div className="view-slider">
              <div 
                className="slider-indicator"
                style={{
                  transform: `translateX(${viewOptions.findIndex(v => v.key === currentView) * 100}%)`
                }}
              />
              {viewOptions.map((view: ViewOption) => (
                <button
                  key={view.key}
                  onClick={() => handleViewChange(view.key)}
                  className={`view-btn ${currentView === view.key ? 'active' : ''}`}
                >
                  <span className="view-icon">{view.icon}</span>
                  <span className="view-label">{view.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right: Navigation Icons */}
        <div className="nav-icons">
          {renderNavItems()}
        </div>
      </div>
    </div>
  );
};

export default CustomCalendarHeader;