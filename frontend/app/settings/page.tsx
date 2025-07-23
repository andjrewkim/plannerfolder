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
  Camera
} from 'lucide-react';
import DisplaySettings from '@/app/settings/settingspages/DisplaySettings';
import GeneralPreferences from '@/app/settings/settingspages/GeneralPreferences';
import NotificationSettings from '@/app/settings/settingspages/NotificationSettings';
import TimeSettings from '@/app/settings/settingspages/TimeSettings';
import { authAPI } from '../../lib/auth';

// Define a type for all possible section names
type SectionName = 'preferences' | 'display' | 'timezone' | 'notifications' | 'profile' | 'sharing' | 'email';

// Standalone SignOutButton component
const SignOutButton: React.FC = () => {
  console.log('=== SIGN OUT CLICKED ===');
  
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
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
  
  return (
    <button
      onClick={handleSignOut}
      disabled={isLoading}
      className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
    >
      {isLoading ? 'Signing out...' : (
        <div className="flex items-center">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </div>
      )}
    </button>
  );
};

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

  const renderContent = () => {
    switch(activeSection) {
      case 'preferences':
        return <GeneralPreferences />;
      case 'display':
        return <DisplaySettings />;
      case 'timezone':
        return <TimeSettings />;
      case 'notifications':
        return <NotificationSettings />;
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

              {/* Added the standalone SignOutButton component here */}
              <div className="pt-6 border-t border-gray-200">

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

            {/* Account Section */}
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">ACCOUNT</h3>
              <div className="space-y-1">
                {accountItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
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
        {renderContent()}
      </div>
    </div>
  );
};

export default CalendarSettings;