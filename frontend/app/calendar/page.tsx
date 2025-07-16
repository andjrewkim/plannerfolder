'use client';
import React, { useState, useEffect } from 'react';
import Calendar from '../components/Calendar';
import Sidebar from '../components/Sidebar';
import EventForm from '../components/EventForm';
import LLMChat from '../components/LLMChat';
import '../globals.css';
import { ThemeProvider } from '../services/themeContext';

import { EventData } from '../components/EventForm'; // Update import to match the type used in EventForm

const Page = () => {
  const [result, setResult] = useState<EventData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<string>('dayGridMonth');
  const [refreshEvents, setRefreshEvents] = useState(0); // Changed name to be more specific

  // Remove the useEffect that triggers on result changes
  // useEffect(() => {
  //   if (result) {
  //     setTriggerReload((prev) => !prev);
  //   }
  // }, [result]);

  const handleEventChange = () => {
    setRefreshEvents((prev) => prev + 1); // Increment to trigger event refresh
  };

  const handleViewChange = (newView: string) => {
    setView(newView);
  };

  // Handle successful event creation/update
  const handleEventSuccess = (newEventData: EventData[]) => {
    setResult(newEventData);
    setError(null);
    handleEventChange(); // Trigger calendar to refresh events only
  };

  return (
    <ThemeProvider>
      <div className="h-screen overflow-hidden">
        {/* Sidebar - remove the key prop since it doesn't need to remount */}
        <Sidebar />

        {/* Main content area */}
        <div className="ewfsf">
          <form method="post" className="calendar-form">
            <input type="hidden" name="csrfmiddlewaretoken" value="Django-CSRF-Token" />
          </form>
          <div className="form-content">
            <EventForm 
              setResult={handleEventSuccess} // Use the new handler
              setError={setError} 
            />
            {error && <p style={{ color: 'red' }}>{error}</p>}
          </div>
        </div>

        {/* Calendar component - NO key prop to prevent remounting */}
        <div className="calendar-container">
          <Calendar 
            refreshTrigger={refreshEvents} // Pass as prop instead of key
            onEventChange={handleEventChange} 
            onViewChange={handleViewChange}
          />
          <p className="current-view">Current View: {view}</p>
        </div>

        <LLMChat />
      </div>
    </ThemeProvider>
  );
}

export default Page;