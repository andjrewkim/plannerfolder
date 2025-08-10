// DisplaySettings.tsx
import React from 'react';
import { Moon } from 'lucide-react';
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
  { id: 'Cinnamon', name: 'Monochrome', colors: ['#6b7280', '#374151'] },
];

interface CustomSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

const CustomSwitch = ({ checked, onCheckedChange, className = '' }: CustomSwitchProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out 
  focus:outline-none
        ${checked 
          ? 'bg-[hsl(217_100%_68%)]' // accent color from dark theme
          : 'bg-[hsl(220_10%_40%)]'  // border color from dark theme
        }
        focus:ring-[hsl(217_100%_68%)] focus:ring-offset-[hsl(222_20%_7%)]
        ${className}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full transition-transform duration-200 ease-in-out
          ${checked 
            ? 'translate-x-6 bg-white' 
            : 'translate-x-1 bg-[hsl(220_10%_85%)]'  // primary color from dark theme
          }
          shadow-lg
        `}
      />
    </button>
  );
};

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
          <CustomSwitch 
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