'use client';
import React, { useState } from 'react';
import Calendar from './components/Calendar';
import Sidebar from './components/Sidebar';
import EditModal from './components/EditModal';
import ScheduleList from './components/ScheduleList';
import './styles/container.css';

const Page = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [result, setResult] = useState(null);

  return (
    <>
      <h1 className="calendar-title"></h1>
      <div className="container">
        <Sidebar />
        <div className="main-content">
          {/* Add form and extracted information */}
          <form method="post" className="calendar-form">
            <input type="hidden" name="csrfmiddlewaretoken" value="Django-CSRF-Token" />
            {/* Adjust form fields as needed */}
            <button type="submit" className="submit-button">Submit</button>
          </form>
          <ScheduleList result={result} />
          <Calendar />
        </div>
        <EditModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    </>
  );
};

export default Page;
