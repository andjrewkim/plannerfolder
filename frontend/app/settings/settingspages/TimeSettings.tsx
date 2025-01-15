
// TimeSettings.tsx
"use client"
import React from 'react';
import { Clock, Globe } from 'lucide-react';
import { Switch } from '@/radix/switch';

export default function TimeSettings() {
  return (
    <div className="settings-section">
      <div className="form-group">
        <label className="form-label flex items-center gap-2">
          <Globe size={16} />
          Time Zone
        </label>
        <select className="form-input">
          <option>Pacific Time (PT)</option>
          <option>Eastern Time (ET)</option>
          <option>UTC</option>
          <option>Central European Time (CET)</option>
          <option>Japan Standard Time (JST)</option>
        </select>
        <p className="form-helper">
          Select your primary time zone for calendar events
        </p>
      </div>

      <div className="form-group">
        <div className="flex items-center justify-between">
          <div>
            <label className="form-label">Auto-detect Time Zone</label>
            <p className="form-helper">Automatically update time zone based on location</p>
          </div>
          <Switch />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Time Format</label>
        <select className="form-input">
          <option>12-hour (1:00 PM)</option>
          <option>24-hour (13:00)</option>
        </select>
        <p className="form-helper">
          Choose how times are displayed in your calendar
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Date Format</label>
        <select className="form-input">
          <option>MM/DD/YYYY</option>
          <option>DD/MM/YYYY</option>
          <option>YYYY-MM-DD</option>
        </select>
        <p className="form-helper">
          Choose how dates are displayed in your calendar
        </p>
      </div>

      <div className="form-group">
        <div className="flex items-center justify-between">
          <div>
            <label className="form-label">Show Secondary Time Zone</label>
            <p className="form-helper">Display an additional time zone in views</p>
          </div>
          <Switch />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Secondary Time Zone</label>
        <select className="form-input">
          <option>UTC</option>
          <option>Eastern Time (ET)</option>
          <option>Pacific Time (PT)</option>
          <option>Central European Time (CET)</option>
        </select>
        <p className="form-helper">
          Choose which additional time zone to display
        </p>
      </div>
    </div>
  );
}
