// components/ThemeSidebar.tsx
import React, { useState, useEffect } from 'react';
import { X, Lock, Moon, Sun, Palette } from 'lucide-react';
import { authAPI } from '../../lib/auth';

interface UserSettings {
  default_calendar_view: string;
  week_starts_on: string;
  dark_mode: boolean;
  theme: string;
}

interface ThemeSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSettingsChange: (newSettings: Partial<UserSettings>) => void;
  hasUnsavedChanges?: boolean;
}

const themes = [
  { id: 'classic', name: 'Classic', colors: ['#3b82f6', '#1e40af'] },
  { id: 'emerald', name: 'Emerald', colors: ['#10b981', '#047857'] },
  { id: 'ocean', name: 'Ocean', colors: ['#0ea5e9', '#0284c7'] },
  { id: 'coffee', name: 'Coffee', colors: ['#b1642dff', '#994011ff'] },
  { id: 'royal', name: 'Royal', colors: ['#8b5cf6', '#7c3aed'] },
  { id: 'monochrome', name: 'Ruby', colors: ['#B14A46', '#6E1E1B'] },
];

const ThemeSidebar: React.FC<ThemeSidebarProps> = ({ 
  isOpen, 
  onClose, 
  settings,
  onSettingsChange,
}) => {
  const [hasUnlockedFeatures, setHasUnlockedFeatures] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatureStatus = async () => {
      try {
        const status = await authAPI.getUserStatus();
        setHasUnlockedFeatures(status.hasUnlockedFeatures);
      } catch (error) {
        console.error('Failed to fetch feature status:', error);
        setHasUnlockedFeatures(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchFeatureStatus();
    }
  }, [isOpen]);

  const handleDarkModeToggle = (checked: boolean) => {
    onSettingsChange({ dark_mode: checked });
  };

  const handleThemeChange = (themeId: string) => {
    onSettingsChange({ theme: themeId });
  };

  const handleThemeClick = (themeId: string, index: number) => {
    const isLocked = index > 0 && !hasUnlockedFeatures;
    if (!isLocked) {
      handleThemeChange(themeId);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="theme-sidebar">
        <div className="sidebar-header">
          <div className="header-content">
            <div className="header-icon">
              <Palette size={20} strokeWidth={2} />
            </div>
            <h2 className="header-title">Appearance</h2>
          </div>
          <button 
            className="close-btn"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="sidebar-content">
          <div className="settings-section">
            <label className="section-label">Theme</label>
            <div className="mode-selector">
              <button
                type="button"
                className={`mode-btn ${!settings.dark_mode ? 'active' : ''}`}
                onClick={() => handleDarkModeToggle(false)}
              >
                <Sun size={18} strokeWidth={2} />
                <span>Light</span>
              </button>
              <button
                type="button"
                className={`mode-btn ${settings.dark_mode ? 'active' : ''}`}
                onClick={() => handleDarkModeToggle(true)}
              >
                <Moon size={18} strokeWidth={2} />
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div className="divider" />
          
          <div className="settings-section">
            <div className="section-header">
              <label className="section-label">Color</label>
              {!hasUnlockedFeatures && (
                <span className="pro-badge">PRO</span>
              )}
            </div>

            {isLoading ? (
              <div className="loading-state">
                <div className="spinner" />
              </div>
            ) : (
              <>
                <div className="theme-grid">
                  {themes.map((theme, index) => {
                    const isLocked = index > 0 && !hasUnlockedFeatures;
                    const isSelected = settings.theme === theme.id;
                    
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={`theme-option ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
                        onClick={() => handleThemeClick(theme.id, index)}
                        disabled={isLocked}
                        aria-label={`${theme.name} theme`}
                      >
                        <div className="theme-colors">
                          <div
                            className="color-primary"
                            style={{ backgroundColor: theme.colors[0] }}
                          />
                          <div
                            className="color-secondary"
                            style={{ backgroundColor: theme.colors[1] }}
                          />
                        </div>
                        
                        <div className="theme-info">
                          <span className="theme-name">{theme.name}</span>
                          {isLocked && (
                            <Lock size={14} strokeWidth={2} className="lock-icon" />
                          )}
                          {isSelected && !isLocked && (
                            <div className="check-icon">
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M11.667 3.5L5.25 9.917 2.333 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!hasUnlockedFeatures && (
                  <div className="upgrade-notice">
                    <p>Unlock all themes with Pro</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .theme-sidebar {
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          width: 340px;
          max-width: 100vw;
          background: hsl(var(--real-sidebar));
          border-left: 1px solid hsl(var(--border) / 0.5);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px;
          border-bottom: 1px solid hsl(var(--border) / 0.5);
          flex-shrink: 0;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: hsl(var(--muted) / 0.5);
          color: hsl(var(--foreground));
        }

        .header-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: hsl(var(--foreground));
          letter-spacing: -0.01em;
        }

        .close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: hsl(var(--muted-foreground));
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .close-btn:hover {
          background: hsl(var(--muted) / 0.5);
          color: hsl(var(--foreground));
        }

        .sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .sidebar-content::-webkit-scrollbar {
          width: 8px;
        }

        .sidebar-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-content::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.2);
          border-radius: 4px;
        }

        .sidebar-content::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.3);
        }

        .settings-section {
          margin-bottom: 32px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .section-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: hsl(var(--foreground));
          margin-bottom: 12px;
          letter-spacing: -0.01em;
        }

        .pro-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 600;
          color: hsl(var(--primary));
          background: hsl(var(--primary) / 0.1);
          border-radius: 4px;
          letter-spacing: 0.02em;
        }

        .mode-selector {
          display: flex;
          gap: 8px;
          padding: 4px;
          background: hsl(var(--muted) / 0.3);
          border-radius: 8px;
        }

        .mode-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: hsl(var(--muted-foreground));
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          letter-spacing: -0.01em;
        }

        .mode-btn:hover {
          color: hsl(var(--foreground));
        }

        .mode-btn.active {
          background: hsl(var(--calendar-background));
          color: hsl(var(--foreground));
          box-shadow: 0 1px 2px hsl(var(--foreground) / 0.08);
        }

        .divider {
          height: 1px;
          background: hsl(var(--border) / 0.5);
          margin: 24px 0;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 0;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid hsl(var(--muted));
          border-top-color: hsl(var(--primary));
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .theme-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .theme-option {
          position: relative;
          display: flex;
          flex-direction: column;
          border: 1px solid hsl(var(--border) / 0.5);
          border-radius: 10px;
          background: hsl(var(--calendar-background));
          cursor: pointer;
          transition: all 0.15s ease;
          overflow: hidden;
          padding: 0;
        }

        .theme-option:hover:not(.locked) {
          border-color: hsl(var(--muted-foreground) / 0.4);
        }

        .theme-option.selected {
          border-color: hsl(var(--primary));
        }

        .theme-option.locked {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .theme-colors {
          height: 72px;
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        .color-primary,
        .color-secondary {
          flex: 1;
          width: 100%;
        }

        .theme-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: hsl(var(--calendar-background));
        }

        .theme-name {
          font-size: 13px;
          font-weight: 500;
          color: hsl(var(--foreground));
          letter-spacing: -0.01em;
        }

        .lock-icon {
          color: hsl(var(--muted-foreground));
          flex-shrink: 0;
        }

        .check-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: hsl(var(--primary));
          flex-shrink: 0;
        }

        .upgrade-notice {
          margin-top: 16px;
          padding: 12px 16px;
          background: hsl(var(--muted) / 0.3);
          border-radius: 8px;
          text-align: center;
        }

        .upgrade-notice p {
          margin: 0;
          font-size: 13px;
          color: hsl(var(--muted-foreground));
          letter-spacing: -0.01em;
        }

        @media (max-width: 768px) {
          .theme-sidebar {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
};

export default ThemeSidebar;