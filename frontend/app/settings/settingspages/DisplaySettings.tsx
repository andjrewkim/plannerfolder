import React from 'react';
import { Moon } from 'lucide-react';
import { Switch } from '@/radix/switch';
import "../../styles/settings.css"

const themes = [
  { id: 'classic', name: 'Classic', colors: ['#f8fafc', '#64748b'] },
  { id: 'emerald', name: 'Emerald', colors: ['#059669', '#065f46'] },
  { id: 'ocean', name: 'Ocean', colors: ['#0ea5e9', '#0369a1'] },
  { id: 'sunset', name: 'Sunset', colors: ['#f97316', '#c2410c'] },
  { id: 'forest', name: 'Forest', colors: ['#166534', '#14532d'] },
  { id: 'royal', name: 'Royal', colors: ['#7c3aed', '#5b21b6'] },
  { id: 'monochrome', name: 'Monochrome', colors: ['#171717', '#404040'] },
  { id: 'pastel', name: 'Pastel', colors: ['#fcd34d', '#fbbf24'] },
  { id: 'neon', name: 'Neon', colors: ['#22d3ee', '#06b6d4'] },
  { id: 'autumn', name: 'Autumn', colors: ['#b45309', '#92400e'] },
  { id: 'winter', name: 'Winter', colors: ['#94a3b8', '#475569'] },
  { id: 'spring', name: 'Spring', colors: ['#818cf8', '#6366f1'] },
  { id: 'summer', name: 'Summer', colors: ['#fb923c', '#ea580c'] },
];

export default function DisplaySettings() {
  return (
    <div className="settings-section">
      <div className="form-group">
        <div className="flex items-center justify-between">
          <div>
            <label className="form-label flex items-center gap-2">
              <Moon size={16} />
              Dark Mode
            </label>
            <p className="form-helper">Switch between light and dark theme</p>
          </div>
          <Switch />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label mb-2">Theme</label>
        <div className="theme-grid">
          {themes.map((theme) => (
            <button
              key={theme.id}
              className="theme-swatch"
            >
              <div className="theme-preview">
                <div
                  className="w-full h-1/2"
                  style={{ backgroundColor: theme.colors[0] }}
                />
                <div
                  className="w-full h-1/2"
                  style={{ backgroundColor: theme.colors[1] }}
                />
              </div>
              <span className="text-xs font-medium mt-1">{theme.name}</span>
            </button>
          ))}
        </div>
        <p className="form-helper mt-2">Choose from our wide selection of carefully crafted themes</p>
      </div>

      <div className="form-group">
        <div className="flex items-center justify-between">
          <div>
            <label className="form-label">Show Weekend Days</label>
            <p className="form-helper">Display Saturday and Sunday in week view</p>
          </div>
          <Switch />
        </div>
      </div>

      <div className="form-group">
        <div className="flex items-center justify-between">
          <div>
            <label className="form-label">Show Week Numbers</label>
            <p className="form-helper">Display week numbers in month view</p>
          </div>
          <Switch />
        </div>
      </div>

      <div className="form-group">
        <div className="flex items-center justify-between">
          <div>
            <label className="form-label">Event Preview</label>
            <p className="form-helper">Show event details on hover</p>
          </div>
          <Switch />
        </div>
      </div>
    </div>
  );
}