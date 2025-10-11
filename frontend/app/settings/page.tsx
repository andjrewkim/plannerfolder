"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Clock, 
  Bell, 
  Globe, 
  User, 
  Sliders, 
  Mail,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { authAPI } from '../../lib/auth';
import { ThemeProvider } from '../services/themeContext';

const CalendarSettings: React.FC = () => {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

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
    window.location.href = '/calendar';
  };

  const sidebarItems = [
    {
      icon: Sliders,
      label: 'General Preferences',
      section: 'APP SETTINGS'
    },
    {
      icon: Clock,
      label: 'Time & Date',
      section: 'APP SETTINGS'
    },
    {
      icon: Bell,
      label: 'Notifications',
      section: 'APP SETTINGS'
    },
    {
      icon: User,
      label: 'Account Settings',
      section: 'ACCOUNT'
    },
    {
      icon: Globe,
      label: 'Calendar Sharing',
      section: 'ACCOUNT'
    },
    {
      icon: Mail,
      label: 'Email Settings',
      section: 'ACCOUNT'
    }
  ];

  const appSettingsItems = sidebarItems.filter(item => item.section === 'APP SETTINGS');
  const accountItems = sidebarItems.filter(item => item.section === 'ACCOUNT');

  return (
    <div className="flex h-screen text-foreground" style={{ backgroundColor: `hsl(var(--sidebar-background))` }}>
      {/* Sidebar */}
      <div className="w-80 bg-calendar-background border-r border-border flex flex-col">
        <div className="flex-1 p-6">
          <h1 className="text-lg font-semibold text-foreground mb-6">CALENDAR SETTINGS</h1>
          
          <div className="space-y-6">
            {/* App Settings Section */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">APP SETTINGS</h3>
              <div className="space-y-1">
                {appSettingsItems.map((item, index) => (
                  <button
                    key={index}
                    disabled
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-muted-foreground/50 cursor-not-allowed opacity-50"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Account Section */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">ACCOUNT</h3>
              <div className="space-y-1">
                {accountItems.map((item, index) => (
                  <button
                    key={index}
                    disabled
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-muted-foreground/50 cursor-not-allowed opacity-50"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sign Out Button integrated into sidebar */}
        <div className="p-6">
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-medium">
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </span>
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
        
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <p className="text-lg">Settings are currently unavailable</p>
            <p className="text-sm mt-2">Please use the Sign Out button if you need to log out</p>
          </div>
        </div>
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