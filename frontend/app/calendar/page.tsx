'use client';
import React, { useState, useEffect } from 'react';
import Calendar from '../components/Calendar';
import Sidebar from '../components/Sidebar';
import RightSidebar from '../components/RightSidebar';
import EventForm from '../components/EventForm';
import LLMChat from '../components/LLMChat';
import '../globals.css';
import { ThemeProvider } from '../services/themeContext';

import { EventData } from '../components/EventForm';

const Page = () => {
  const [result, setResult] = useState<EventData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<string>('dayGridMonth');
  const [refreshEvents, setRefreshEvents] = useState(0);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [navbarVisible, setNavbarVisible] = useState(false);

  // Listen for navbar visibility changes
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 25) {
        setNavbarVisible(true);
      } else if (e.clientY > 70) {
        setNavbarVisible(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleEventChange = () => {
    setRefreshEvents((prev) => prev + 1);
  };

  const handleViewChange = (newView: string) => {
    setView(newView);
  };

  const handleEventSuccess = (newEventData: EventData[]) => {
    setResult(newEventData);
    setError(null);
    handleEventChange();
  };

  const handleRightSidebarToggle = () => {
    setRightSidebarOpen(!rightSidebarOpen);
  };

  return (
    <ThemeProvider>
      <div className="h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="ewfsf">
          <div className="form-content">
            <EventForm 
              setResult={handleEventSuccess}
              setError={setError} 
            />
            {error && <p style={{ color: 'red' }}>{error}</p>}
          </div>
        </div>

        {/* Calendar component with dynamic margin - RESTORED TO ORIGINAL */}
        <div 
          className="calendar-container"
          style={{
            marginRight: rightSidebarOpen ? '320px' : '0',
            '@media (max-width: 768px)': {
              marginRight: '0'
            }
          }}
        >
          <Calendar 
            refreshTrigger={refreshEvents}
            onEventChange={handleEventChange} 
            onViewChange={handleViewChange}
          />
          <p className="current-view">Current View: {view}</p>
        </div>

        {/* AI Assistant Sidebar - positioned to slide with navbar */}
        <RightSidebar 
          isOpen={rightSidebarOpen}
          onToggle={handleRightSidebarToggle}
          navbarVisible={navbarVisible}
        />

        <LLMChat />

        {/* Additional styles for responsive behavior */}
        <style jsx>{`
          @media (max-width: 768px) {
            .calendar-container {
              margin-right: 0 !important;
            }
          }
        `}</style>
      </div>
    </ThemeProvider>
  );
}

export default Page;