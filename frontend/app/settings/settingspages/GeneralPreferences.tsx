
// GeneralPreferences.tsx
"use client"
import React from 'react';

export default function GeneralPreferences() {
  return (
    <div className="settings-section">
      <div className="form-group">
        <label className="form-label">Default Calendar View</label>
        <select className="form-input">
          <option>Month</option>
          <option>Week</option>
          <option>Day</option>
          <option>Agenda</option>
        </select>
        <p className="form-helper">
          Choose which view to show when you first open the calendar.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Week Starts On</label>
        <select className="form-input">
          <option>Sunday</option>
          <option>Monday</option>
        </select>
        <p className="form-helper">
          Select which day your week should start with.
        </p>
      </div>


    </div>
  );
}