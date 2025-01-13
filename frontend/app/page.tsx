
'use client';
import React, { useState, useEffect } from 'react';
import Calendar from './components/Calendar';
import Sidebar from './components/Sidebar';
import EditModal from './components/EditModal';
import EventForm from './components/EventForm';
import './globals.css';


const Page = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [result, setResult] = useState<any>(null);
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

  const handleViewChange = (newView: string) => {
    setView(newView);  // Update the view when the slider changes
  };
return (
  <div className="h-screen overflow-hidden">
    {/* Sidebar with fixed width */}
    <Sidebar key={triggerReload} className="sidebar" /> {/* Sidebar takes 16rem width */}

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
      key={triggerReload} 
      onEventChange={handleTriggerReload} 
      view={view} 
          />
        </div>
      </div>


);

  
}


export default Page;
