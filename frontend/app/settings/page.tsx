"use client";

import React, { useState, useEffect } from 'react';
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

// Define a type for all possible section names
type SectionName = 'preferences' | 'display' | 'timezone' | 'notifications' | 'profile' | 'sharing' | 'email';

// User settings type
interface UserSettings {
  default_calendar_view: string;
  week_starts_on: string;
  dark_mode: boolean;
  theme: string;
}

// Define the section titles with the correct type
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
  const [activeSection, setActiveSection] = useState<SectionName>('preferences');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    default_calendar_view: 'month',
    week_starts_on: 'sunday',
    dark_mode: false,
    theme: 'classic'
  });
  const [originalSettings, setOriginalSettings] = useState<UserSettings>({
    default_calendar_view: 'month',
    week_starts_on: 'sunday',
    dark_mode: false,
    theme: 'classic'
  });

  // Load user settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user-settings/`);
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
          setOriginalSettings(data);
        } else {
          console.error('Failed to load settings:', response.statusText);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasUnsavedChanges(hasChanges);
  }, [settings, originalSettings]);

  // Clear success/error messages after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  useEffect(() => {
    if (saveError) {
      const timer = setTimeout(() => setSaveError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveError]);

  const handleSettingsChange = (newSettings: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    // Clear any previous error messages when user makes changes
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await authAPI.authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user-settings/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const updatedSettings = await response.json();
        setOriginalSettings(updatedSettings);
        setHasUnsavedChanges(false);
        setSaveSuccess(true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setSaveError(errorData.message || 'Failed to save settings. Please try again.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveError('Network error. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSignOut = async () => {
    setIsLoading(true);

    try {
      await authAPI.logout();
      router.push('/userlogin');
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToCalendar = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmLeave) return;
    }
    router.push('/calendar');
  };

  useEffect(() => {
    const hash = (window.location.hash.slice(1) || 'preferences') as SectionName;
    setActiveSection(hash);

    const handleHashChange = () => {
      const newHash = (window.location.hash.slice(1) || 'preferences') as SectionName;
      setActiveSection(newHash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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

  // Save button component for reuse
  const SaveButton = () => (
    <div className="mt-8 pt-6 border-t border-gray-200">
      {/* Success/Error Messages */}
      {saveSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Settings saved successfully!
        </div>
      )}
      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {saveError}
        </div>
      )}
      
      <button
        onClick={handleSaveSettings}
        disabled={!hasUnsavedChanges || isSaving}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          hasUnsavedChanges && !isSaving
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        <Save className="h-4 w-4" />
        <span className="text-sm">
          {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'No Changes'}
        </span>
      </button>
    </div>
  );

  const renderContent = () => {
    switch(activeSection) {
      case 'preferences':
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">General Preferences</h2>
              <p className="text-gray-600">Customize your calendar's default behavior</p>
            </div>
            <GeneralPreferences 
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
            <SaveButton />
          </div>
        );
      case 'display':
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Display Settings</h2>
              <p className="text-gray-600">Personalize the look and feel of your calendar</p>
            </div>
            <DisplaySettings 
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
            <SaveButton />
          </div>
        );
      case 'timezone':
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Time & Date</h2>
              <p className="text-gray-600">Configure timezone and date format preferences</p>
            </div>
            <TimeSettings />
          </div>
        );
      case 'notifications':
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Notifications</h2>
              <p className="text-gray-600">Manage how you receive calendar notifications</p>
            </div>
            <NotificationSettings />
          </div>
        );
      case 'profile':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Account Settings</h2>
              <p className="text-gray-600">Manage your profile information</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">Profile Picture</label>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="h-8 w-8 text-gray-500" />
                  </div>
                  <button className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                    <Camera className="h-4 w-4" />
                    <span className="text-sm">Change Photo</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="email"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your.email@example.com"
                  />
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <span className="text-sm">Update</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">We'll send a confirmation to your new email address.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="space-y-3">
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Current password"
                  />
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="New password"
                  />
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm new password"
                  />
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <span className="text-sm">Update Password</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Choose a strong password that you haven't used elsewhere.</p>
              </div>
            </div>
          </div>
        );
      case 'sharing':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Calendar Sharing</h2>
              <p className="text-gray-600">Manage calendar sharing preferences</p>
            </div>
            <div>Section under construction</div>
          </div>
        );
      case 'email':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Email Settings</h2>
              <p className="text-gray-600">Configure email notifications and preferences</p>
            </div>
            <div>Section under construction</div>
          </div>
        );
      default:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Settings</h2>
              <p className="text-gray-600">Section under construction</p>
            </div>
          </div>
        );
    }
  };

  // Group sidebar items by section
  const appSettingsItems = sidebarItems.filter(item => item.section === 'APP SETTINGS');
  const accountItems = sidebarItems.filter(item => item.section === 'ACCOUNT');

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200">
        <div className="p-6">
          <h1 className="text-lg font-semibold text-gray-900 mb-6">CALENDAR SETTINGS</h1>
          
          <div className="space-y-6">
            {/* App Settings Section */}
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">APP SETTINGS</h3>
              <div className="space-y-1">
                {appSettingsItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (hasUnsavedChanges && (activeSection === 'preferences' || activeSection === 'display')) {
                        const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to switch sections?');
                        if (!confirmLeave) return;
                      }
                      setActiveSection(item.id);
                      window.location.hash = item.id;
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === item.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
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
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">ACCOUNT</h3>
              <div className="space-y-1">
                {accountItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (hasUnsavedChanges && (activeSection === 'preferences' || activeSection === 'display')) {
                        const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to switch sections?');
                        if (!confirmLeave) return;
                      }
                      setActiveSection(item.id);
                      window.location.hash = item.id;
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === item.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
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
        <div className="absolute bottom-0 left-0 right-0 w-80 p-6 border-t border-gray-200 bg-white">
          <button
            onClick={handleSignOut}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
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
      <div className="flex-1 p-8">
        {/* Back Arrow */}
        <div className="mb-6">
          <button
            onClick={handleBackToCalendar}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Calendar</span>
          </button>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
};

export default CalendarSettings;