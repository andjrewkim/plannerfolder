import React, { useState, useEffect, RefObject } from 'react';
import '../styles/calendarheader.css';

// Define the FullCalendar API interface (minimal required methods)
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

// Define the component props interface
interface CustomCalendarHeaderProps {
  calendarRef: RefObject<CalendarRef>;
  currentTitle: string;
  onViewChange?: (view: string) => void;
}

const CustomCalendarHeader: React.FC<CustomCalendarHeaderProps> = ({ 
  calendarRef, 
  currentTitle, 
  onViewChange 
}) => {
  const [activeView, setActiveView] = useState<string>('dayGridMonth');
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const handlePrevious = (): void => {
    if (calendarRef.current) {
      setIsAnimating(true);
      calendarRef.current.getApi().prev();
      setTimeout(() => setIsAnimating(false), 150);
    }
  };

  const handleNext = (): void => {
    if (calendarRef.current) {
      setIsAnimating(true);
      calendarRef.current.getApi().next();
      setTimeout(() => setIsAnimating(false), 150);
    }
  };

  const handleToday = (): void => {
    if (calendarRef.current) {
      setIsAnimating(true);
      calendarRef.current.getApi().today();
      setTimeout(() => setIsAnimating(false), 150);
    }
  };

  const handleViewChange = (view: string): void => {
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(view);
      setActiveView(view);
    }
    if (onViewChange) {
      onViewChange(view);
    }
  };

  interface ViewOption {
    key: string;
    label: string;
    icon: string;
  }

  const viewOptions: ViewOption[] = [
    { key: 'dayGridMonth', label: 'Month', icon: '◼' },
    { key: 'timeGridWeek', label: 'Week', icon: '◫' },
    { key: 'timeGridDay', label: 'Day', icon: '◯' }
  ];

  return (
    <div className="advanced-calendar-header">
      <div className="header-container">
        {/* Animated Background Elements */}
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
        <div className="bg-orb orb-3"></div>
        
        {/* Navigation Section */}
        <div className="nav-section">
          <div className="nav-group">
            <button
              onClick={handlePrevious}
              className="nav-btn nav-prev"
              disabled={isAnimating}
            >
              <span className="nav-icon">‹</span>
              <span className="nav-ripple"></span>
            </button>
            
            <button
              onClick={handleToday}
              className="nav-btn nav-today"
              disabled={isAnimating}
            >
              <span className="today-dot"></span>
              <span className="nav-text">Today</span>
              <span className="nav-ripple"></span>
            </button>
            
            <button
              onClick={handleNext}
              className="nav-btn nav-next"
              disabled={isAnimating}
            >
              <span className="nav-icon">›</span>
              <span className="nav-ripple"></span>
            </button>
          </div>
        </div>

        {/* Title Section */}
        <div className="title-section">
          <div className={`title-container ${isAnimating ? 'animating' : ''}`}>
            <div className="title-backdrop"></div>
            <h1 className="calendar-title">
              <span className="title-text">{currentTitle}</span>
              <div className="title-underline"></div>
            </h1>
            <div className="title-particles">
              <span className="particle p1"></span>
              <span className="particle p2"></span>
              <span className="particle p3"></span>
            </div>
          </div>
        </div>

        {/* View Selector */}
        <div className="view-section">
          <div className="view-slider">
            <div 
              className="slider-indicator"
              style={{
                transform: `translateX(${viewOptions.findIndex(v => v.key === activeView) * 100}%)`
              }}
            ></div>
            {viewOptions.map((view: ViewOption) => (
              <button
                key={view.key}
                onClick={() => handleViewChange(view.key)}
                className={`view-btn ${activeView === view.key ? 'active' : ''}`}
              >
                <span className="view-icon">{view.icon}</span>
                <span className="view-label">{view.label}</span>
                <div className="view-glow"></div>
              </button>
            ))}
          </div>
        </div>

        {/* Floating Elements - Removed */}
      </div>
    </div>
  );
};

export default CustomCalendarHeader;