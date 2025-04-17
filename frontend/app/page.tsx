'use client';
import React, { useState, useEffect } from 'react';
import Calendar from './components/Calendar';
import Sidebar from './components/Sidebar';
import EventForm from './components/EventForm';
import './globals.css';
import { ThemeProvider } from './services/themeContext';

import { EventData } from './components/EventForm'; // Update import to match the type used in EventForm

const Page = () => {
  const [result, setResult] = useState<EventData[]>([]); // Changed to EventData[]
  const [error, setError] = useState<string | null>(null);
  const [triggerReload, setTriggerReload] = useState(false);
  const [view, setView] = useState<string>('dayGridMonth'); // Add state to track the calendar view

  useEffect(() => {
    if (result) {
      setTriggerReload((prev) => !prev);
    }
  }, [result]);

  const handleTriggerReload = () => {
    setTriggerReload((prev) => !prev);
  };

  // Using the handleViewChange function in the Calendar component to fix the unused error
  const handleViewChange = (newView: string) => {
    setView(newView);  // Update the view when the slider changes
  };

  return (
    <ThemeProvider>
      <div className="h-screen overflow-hidden">
        {/* Sidebar with fixed width */}
        <Sidebar key={Number(triggerReload)} /> {/* Sidebar takes 16rem width */}

        {/* Main content area */}
        <div className="ewfsf">
          <form method="post" className="calendar-form">
            <input type="hidden" name="csrfmiddlewaretoken" value="Django-CSRF-Token" />
          </form>
          <div className="form-content">
            <EventForm setResult={setResult} setError={setError} />
            {error && <p style={{ color: 'red' }}>{error}</p>}
          </div>
        </div>

        {/* Calendar component in its own container */}
        <div className="calendar-container">
          <Calendar 
            key={String(triggerReload)} 
            onEventChange={handleTriggerReload} 
            onViewChange={handleViewChange} // Added to utilize the handleViewChange function
          />
          <p className="current-view">Current View: {view}</p> {/* Display the current view */}
        </div>
      </div>
    </ThemeProvider>
  );
}

export default Page;