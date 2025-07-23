import React from 'react';
import { Moon } from 'lucide-react';
import { Switch } from '@/radix/switch';
import "../../styles/settings.css";
import { themes, useTheme } from '../../services/themeContext';
import { ThemeProvider } from '../../services/themeProviderWrapper'; // Import the wrapper

function DisplaySettingsContent() {
  const { currentTheme, setTheme, isDarkMode, toggleDarkMode } = useTheme();

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
          <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label mb-2">Theme</label>
        <div className="theme-grid">
          {themes.map((theme) => (
            <button
              key={theme.id}
              className={`theme-swatch ${currentTheme.id === theme.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setTheme(theme.id)}
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

{/*
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

*/}

    </div>
  );
}
// Wrap the component with the ThemeProvider
export default function DisplaySettings() {
  return (
    <ThemeProvider>
      <DisplaySettingsContent />
    </ThemeProvider>
  );
}