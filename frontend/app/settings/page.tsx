"use client"
import React, { useState, useEffect } from 'react';
import { Clock, Bell, Globe, User, Sliders, Palette, Mail } from 'lucide-react';
import DisplaySettings from '@/app/settings/settingspages/DisplaySettings';
import GeneralPreferences from '@/app/settings/settingspages/GeneralPreferences';
import NotificationSettings from '@/app/settings/settingspages/NotificationSettings';
import TimeSettings from '@/app/settings/settingspages/TimeSettings';


// Define a type for all possible section names
type SectionName = 'preferences' | 'display' | 'timezone' | 'notifications' | 'profile' | 'sharing' | 'email';

// Define the section titles with the correct type
const sectionTitles: Record<SectionName, string> = {
  preferences: 'General Preferences',
  display: 'Display Settings',
  timezone: 'Time & Date',
  notifications: 'Notifications',
  profile: 'Profile',
  sharing: 'Calendar Sharing',
  email: 'Email Settings'
};

export default function CalendarSettings() {
  // Use the correct type for activeSection
  const [activeSection, setActiveSection] = useState<SectionName>('preferences');
  
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
      default:
        return <div>Section under construction</div>;
    }
  };

  return (
    <div className="app-container">
      {/* Header removed */}
      
      <div className="main-container">
        <nav className="sidebar">
          <div className="nav-group">
            <h2 className="nav-header">App Settings</h2>
            <a href="#preferences" 
               className={`nav-item ${activeSection === 'preferences' ? 'active' : ''}`}>
              <Sliders size={16} />
              General Preferences
            </a>
            <a href="#display" 
               className={`nav-item ${activeSection === 'display' ? 'active' : ''}`}>
              <Palette size={16} />
              Display Settings
            </a>
            <a href="#timezone" 
               className={`nav-item ${activeSection === 'timezone' ? 'active' : ''}`}>
              <Clock size={16} />
              Time & Date
            </a>
            <a href="#notifications" 
               className={`nav-item ${activeSection === 'notifications' ? 'active' : ''}`}>
              <Bell size={16} />
              Notifications
            </a>
          </div>
  
          <div className="nav-group">
            <h2 className="nav-header">Account</h2>
            <a href="#profile" 
               className={`nav-item ${activeSection === 'profile' ? 'active' : ''}`}>
              <User size={16} />
              Profile
            </a>
            <a href="#sharing" 
               className={`nav-item ${activeSection === 'sharing' ? 'active' : ''}`}>
              <Globe size={16} />
              Calendar Sharing
            </a>
            <a href="#email" 
               className={`nav-item ${activeSection === 'email' ? 'active' : ''}`}>
              <Mail size={16} />
              Email Settings
            </a>
          </div>
        </nav>
  
        <main className="content">
          <div className="content-header">
            <h2 className="content-title">{sectionTitles[activeSection]}</h2>
            <p className="content-description">
              Customize your calendar experience
            </p>
          </div>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}