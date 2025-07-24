// DisplaySettings.tsx
import React from 'react';
import { Moon } from 'lucide-react';
import { Switch } from '@/radix/switch';
import "../../styles/settings.css";

interface UserSettings {
  default_calendar_view: string;
  week_starts_on: string;
  dark_mode: boolean;
  theme: string;
}

interface DisplaySettingsProps {
  settings: UserSettings;
  onSettingsChange: (newSettings: Partial<UserSettings>) => void;
}

// Define themes directly in the component or import from a constants file
const themes = [
  { id: 'classic', name: 'Classic', colors: ['#3b82f6', '#1e40af'] },
  { id: 'emerald', name: 'Emerald', colors: ['#10b981', '#047857'] },
  { id: 'ocean', name: 'Ocean', colors: ['#0ea5e9', '#0284c7'] },
  { id: 'sunset', name: 'Sunset', colors: ['#f97316', '#ea580c'] },
  { id: 'royal', name: 'Royal', colors: ['#8b5cf6', '#7c3aed'] },
  { id: 'monochrome', name: 'Monochrome', colors: ['#6b7280', '#374151'] },
];

export default function DisplaySettings({ settings, onSettingsChange }: DisplaySettingsProps) {
  const handleDarkModeToggle = (checked: boolean) => {
    onSettingsChange({ dark_mode: checked });
  };

  const handleThemeChange = (themeId: string) => {
    onSettingsChange({ theme: themeId });
  };

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
          <Switch 
            checked={settings.dark_mode} 
            onCheckedChange={handleDarkModeToggle} 
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label mb-2">Theme</label>
        <div className="theme-grid">
          {themes.map((theme) => (
            <button
              key={theme.id}
              className={`theme-swatch ${settings.theme === theme.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => handleThemeChange(theme.id)}
              aria-label={`Select ${theme.name} theme`}
            >
              <div className="theme-preview rounded overflow-hidden">
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
    </div>
  );
}