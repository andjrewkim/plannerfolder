
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

      <div className="form-group">
        <label className="form-label">Working Hours</label>
        <div className="form-row">
          <select className="form-input">
            <option>9:00 AM</option>
            <option>8:00 AM</option>
            <option>10:00 AM</option>
          </select>
          <span className="form-separator">to</span>
          <select className="form-input">
            <option>5:00 PM</option>
            <option>4:00 PM</option>
            <option>6:00 PM</option>
          </select>
        </div>
        <p className="form-helper">
          Set your typical working hours to highlight them in day and week views.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Default Event Duration</label>
        <select className="form-input">
          <option>30 minutes</option>
          <option>1 hour</option>
          <option>2 hours</option>
        </select>
        <p className="form-helper">
          Choose the default duration when creating new events.
        </p>
      </div>
    </div>
  );
}