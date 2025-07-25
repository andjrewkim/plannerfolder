// GeneralPreferences.tsx
"use client"
import React from 'react';

interface UserSettings {
  default_calendar_view: string;
  week_starts_on: string;
  dark_mode: boolean;
  theme: string;
}

interface GeneralPreferencesProps {
  settings: UserSettings;
  onSettingsChange: (newSettings: Partial<UserSettings>) => void;
}

export default function GeneralPreferences({ settings, onSettingsChange }: GeneralPreferencesProps) {
  const handleViewChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({ default_calendar_view: e.target.value });
  };

  const handleWeekStartChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({ week_starts_on: e.target.value });
  };

  return (
    <div className="settings-section">

      <div className="form-group">
        <label className="form-label">Week Starts On</label>
        <select 
          className="form-input"
          value={settings.week_starts_on}
          onChange={handleWeekStartChange}
        >
          <option value="sunday">Sunday</option>
          <option value="monday">Monday</option>
        </select>
        <p className="form-helper">
          Select which day your week should start with.
        </p>
      </div>
    </div>
  );
}