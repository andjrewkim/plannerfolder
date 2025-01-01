'use client';
import React, { useState } from 'react';
import Calendar from './components/Calendar';
import Sidebar from './components/Sidebar';
import EditModal from './components/EditModal';
import ScheduleList from './components/ScheduleList';
import EventForm from './components/EventForm';
import './styles/container.css';

const Page = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [result, setResult] = useState<any>(null);  // Store the result from EventForm
  const [error, setError] = useState<string | null>(null);  // Store error message from EventForm

  return (
    <>
      {/* <h1 className="calendar-title">Event Calendar</h1> */}
      <div className="container">
        <Sidebar />
        <div className="main-content">
          {/* Add form and extracted information */}
          <form method="post" className="calendar-form">
            <input type="hidden" name="csrfmiddlewaretoken" value="Django-CSRF-Token" />
            {/* Adjust form fields as needed */}
          </form>
          
          {/* Pass setResult and setError to EventForm as props */}
          <EventForm setResult={setResult} setError={setError} />
          
          {/* Display error message if any */}
          {error && <p style={{ color: 'red' }}>{error}</p>}
                    
          <ScheduleList result={result} />
          <Calendar />
        </div>
        <EditModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    </>
  );
};

export default Page;
