"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Clock, 
  Bell, 
  Globe, 
  User, 
  Sliders, 
  Palette, 
  Mail,
  LogOut,
  Lock,
  Camera,
  ArrowLeft,
  Save
} from 'lucide-react';
import DisplaySettings from '@/app/settings/settingspages/DisplaySettings';
import GeneralPreferences from '@/app/settings/settingspages/GeneralPreferences';
import NotificationSettings from '@/app/settings/settingspages/NotificationSettings';
import TimeSettings from '@/app/settings/settingspages/TimeSettings';
import { authAPI } from '../../lib/auth';
import { useTheme, ThemeProvider } from '../services/themeContext';
import { useUserSettings } from '../hooks/useUserSettings';

type SectionName = 'preferences' | 'display' | 'timezone' | 'notifications' | 'profile' | 'sharing' | 'email';

const sectionTitles: Record<SectionName, string> = {
  preferences: 'General Preferences',
  display: 'Display Settings',  
  timezone: 'Time & Date',
  notifications: 'Notifications',
  profile: 'Account Settings',
  sharing: 'Calendar Sharing',
  email: 'Email Settings'
};

const CalendarSettings: React.FC = () => {
  const router = useRouter();
  const { currentTheme, isDarkMode } = useTheme();
  const {
    settings,
    originalSettings,
    isLoading: settingsLoading,
    isSaving,
    hasUnsavedChanges,
    saveSuccess,
    saveError,
    updateSettings,
    saveSettings,
    resetToOriginal
  } = useUserSettings();

  const [activeSection, setActiveSection] = useState<SectionName>('preferences');
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Handle hash-based section selection
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && Object.keys(sectionTitles).includes(hash as SectionName)) {
        setActiveSection(hash as SectionName);
      } else {
        setActiveSection('preferences');
        if (!window.location.hash) {
          window.location.hash = 'preferences';
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authAPI.logout();
      router.push('/userlogin');
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleBackToCalendar = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmLeave) return;
    }
    router.push('/calendar');
  };

  const handleSectionSwitch = useCallback((sectionId: SectionName) => {
    const sectionsWithUnsavedCheck = ['preferences', 'display'];
    
    if (hasUnsavedChanges && sectionsWithUnsavedCheck.includes(activeSection)) {
      const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to switch sections?');
      if (!confirmLeave) return;
    }
    
    setActiveSection(sectionId);
    window.location.hash = sectionId;
  }, [hasUnsavedChanges, activeSection]);

  const sidebarItems = [
    {
      id: 'preferences' as SectionName,
      icon: Sliders,
      label: 'General Preferences',
      section: 'APP SETTINGS'
    },
    {
      id: 'display' as SectionName,
      icon: Palette,
      label: 'Display Settings',
      section: 'APP SETTINGS'
    },
    {
      id: 'timezone' as SectionName,
      icon: Clock,
      label: 'Time & Date',
      section: 'APP SETTINGS'
    },
    {
      id: 'notifications' as SectionName,
      icon: Bell,
      label: 'Notifications',
      section: 'APP SETTINGS'
    },
    {
      id: 'profile' as SectionName,
      icon: User,
      label: 'Account Settings',
      section: 'ACCOUNT'
    },
    {
      id: 'sharing' as SectionName,
      icon: Globe,
      label: 'Calendar Sharing',
      section: 'ACCOUNT'
    },
    {
      id: 'email' as SectionName,
      icon: Mail,
      label: 'Email Settings',
      section: 'ACCOUNT'
    }
  ];

  // Save button component
  const SaveButton = () => (
    <div className="mt-8 pt-6 border-t border-border">
      {saveSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
          Settings saved successfully!
        </div>
      )}
      {saveError && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm">
          {saveError}
        </div>
      )}
      
      <div className="flex space-x-3">
        <button
          onClick={saveSettings}
          disabled={!hasUnsavedChanges || isSaving}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            hasUnsavedChanges && !isSaving
              ? 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          <Save className="h-4 w-4" />
          <span className="text-sm">
            {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'No Changes'}
          </span>
        </button>

        {hasUnsavedChanges && (
          <button
            onClick={resetToOriginal}
            className="px-4 py-2 rounded-lg font-medium text-sm bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    if (!settings) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading settings...</div>
        </div>
      );
    }

    switch(activeSection) {
      case 'preferences':
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">General Preferences</h2>
              <p className="text-muted-foreground">Customize your calendar's default behavior</p>
            </div>
            <GeneralPreferences 
              settings={settings}
              onSettingsChange={updateSettings}
            />
            <SaveButton />
          </div>
        );
      case 'display':
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">Display Settings</h2>
              <p className="text-muted-foreground">Personalize the look and feel of your calendar</p>
            </div>
            <DisplaySettings 
              settings={settings}
              onSettingsChange={updateSettings}
            />
            <SaveButton />
          </div>
        );
      case 'timezone':
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">Time & Date</h2>
              <p className="text-muted-foreground">Configure timezone and date format preferences</p>
            </div>
            <TimeSettings />
          </div>
        );
      case 'notifications':
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">Notifications</h2>
              <p className="text-muted-foreground">Manage how you receive calendar notifications</p>
            </div>
            <NotificationSettings />
          </div>
        );
      case 'profile':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">Account Settings</h2>
              <p className="text-muted-foreground">Manage your profile information</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-4">Profile Picture</label>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <button className="flex items-center space-x-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/80 transition-colors">
                    <Camera className="h-4 w-4" />
                    <span className="text-sm">Change Photo</span>
                  </button>
                </div>
              </div>

              {/* Other profile settings remain the same */}
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">Settings</h2>
              <p className="text-muted-foreground">Section under construction</p>
            </div>
          </div>
        );
    }
  };

  const appSettingsItems = sidebarItems.filter(item => item.section === 'APP SETTINGS');
  const accountItems = sidebarItems.filter(item => item.section === 'ACCOUNT');

  return (
    <div className="flex h-screen text-foreground" style={{ backgroundColor: `hsl(var(--sidebar-background))` }}>
      {/* Sidebar */}
      <div className="w-80 bg-calendar-background border-r border-border">
        <div className="p-6">
          <h1 className="text-lg font-semibold text-foreground mb-6">CALENDAR SETTINGS</h1>
          
          <div className="space-y-6">
            {/* App Settings Section */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">APP SETTINGS</h3>
              <div className="space-y-1">
                {appSettingsItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSectionSwitch(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === item.id
                        ? 'bg-muted text-foreground'          // Selected: stays on the hover color
                        : 'text-foreground hover:bg-muted' 
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                    {hasUnsavedChanges && (activeSection === 'preferences' || activeSection === 'display') && activeSection === item.id && (
                      <div className="w-2 h-2 bg-orange-400 rounded-full ml-auto"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Account Section */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">ACCOUNT</h3>
              <div className="space-y-1">
                {accountItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSectionSwitch(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === item.id
                        ? 'bg-muted text-foreground'          // Selected: stays on the hover color
                        : 'text-foreground hover:bg-muted'  
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sign Out Button at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 w-80 p-6 border-t border-border bg-card">
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            {isSigningOut ? (
              <span className="text-sm">Signing out...</span>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Sign Out</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 bg-background">
        {/* Back Arrow */}
        <div className="mb-6">
          <button
            onClick={handleBackToCalendar}
            className="flex items-center space-x-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Calendar</span>
          </button>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
}

export default function CalendarSettingsPage() {
  return (
    <ThemeProvider>
      <CalendarSettings />
    </ThemeProvider>
  );
}