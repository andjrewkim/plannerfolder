'use client';
import React, { useState, useEffect } from 'react';
import Calendar from '../components/Calendar';
import Sidebar from '../components/Sidebar';
import RightSidebar from '../components/RightSidebar';
import EventForm from '../components/EventForm';
import LLMChat from '../components/LLMChat';
import Navigation from '../components/Navigation'; // Import the Navigation component
import '../globals.css';
import { ThemeProvider } from '../services/themeContext';

import { EventData } from '../components/EventForm';

const Page = () => {
  const [result, setResult] = useState<EventData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<string>('dayGridMonth');
  const [refreshEvents, setRefreshEvents] = useState(0);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [navbarVisible, setNavbarVisible] = useState(false);

  // Disable scrolling on mount and re-enable on unmount
  useEffect(() => {
    // Disable scrolling
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Cleanup function to re-enable scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, []);

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
      <Navigation rightSidebarOpen={rightSidebarOpen}>
        <div className="h-screen overflow-hidden">
          <Sidebar onEventChange={handleEventChange} />
          {/* Sidebar */}
          {/* Main content area */}
          <div className="ewfsf">
            <div className="form-content">
              {error && <p style={{ color: 'red' }}>{error}</p>}
            </div>
          </div>

          {/* Calendar component with dynamic margin - FIXED */}
          <div 
            className="calendar-container"
            style={{
              marginRight: rightSidebarOpen ? '349px' : '30px',
              marginLeft: '20px',
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
          {/* UPDATED: Added onEventChange prop to trigger calendar refresh */}
          <RightSidebar 
            isOpen={rightSidebarOpen}
            onToggle={handleRightSidebarToggle}
            forceClose={false}
            navbarVisible={navbarVisible}
            onEventChange={handleEventChange} // Pass the event change handler
          />

          {/* Responsive styles moved to styled-jsx */}
          <style jsx>{`
            @media (max-width: 768px) {
              .calendar-container {
                margin-right: 0 !important;
              }
            }
          `}</style>

          {/* Global styles to prevent scrolling */}
          <style jsx global>{`
            html, body {
              overflow: hidden !important;
              height: 100%;
            }
          `}</style>
        </div>
      </Navigation>
    </ThemeProvider>
  );
}
export default Page;