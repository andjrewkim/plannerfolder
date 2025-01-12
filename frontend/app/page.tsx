
'use client';
import React, { useState, useEffect } from 'react';
import Calendar from './components/Calendar';
import Sidebar from './components/Sidebar';
import EditModal from './components/EditModal';
import EventForm from './components/EventForm';
import Slider from './components/FullCalendarSlider';
import './styles/container.css';

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
    <>
      <div className="container">
        <Sidebar key={triggerReload} />
        <Slider onViewChange={handleViewChange} /> {/* Pass the handleViewChange function */}
        <div className="main-content">
          <form method="post" className="calendar-form">
            <input type="hidden" name="csrfmiddlewaretoken" value="Django-CSRF-Token" />
          </form>

          <EventForm setResult={setResult} setError={setError} />

          {error && <p style={{ color: 'red' }}>{error}</p>}

          <Calendar key={triggerReload} onEventChange={handleTriggerReload} view={view} /> {/* Pass the view state */}
        </div>
        <EditModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    </>
  );
};

export default Page;
