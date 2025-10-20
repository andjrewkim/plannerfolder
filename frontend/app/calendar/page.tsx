'use client';
import React, { useState, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import { Palette } from 'lucide-react';
import Calendar from '../components/Calendar/Calendar';
import Sidebar from '../components/Sidebar';
import Planner from '../components/Planner/Planner';
import Onboarding from '../components/Onboarding/Onboarding';
import ThemeSidebar from '../components/ThemeSidebar';
import '../globals.css';
import { ThemeProvider, useTheme } from '../services/themeContext';
import { useAppState } from '../hooks/useAppState';
import { useUserSettings } from '../hooks/useUserSettings';
import { authAPI } from '../../lib/auth';
import Notes from '../components/Notes';
import Popup from '../components/Popup/Popup';

type ViewType = 'your-new-view' | 'calendar';

interface AppContentProps {
  rightSidebarOpen: boolean;
  setRightSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const AppContent: React.FC<AppContentProps> = ({ 
  rightSidebarOpen, 
  setRightSidebarOpen
}) => {
  const posthog = usePostHog();
  
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isClient, setIsClient] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  
  // Feature unlock status - same as ThemeSidebar
  const [hasUnlockedFeatures, setHasUnlockedFeatures] = useState(false);

  // Theme sidebar state
  const [showThemeSidebar, setShowThemeSidebar] = useState(false);
  
  // Use the settings hook to manage theme
  const {
    settings,
    isLoading: settingsLoading,
    isSaving,
    hasUnsavedChanges,
    updateSettings,
    saveSettings,
  } = useUserSettings();

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  
  const {
    events,
    tasks,
    isLoading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    createTask,
    deleteTask,
    initializeData,
    setError
  } = useAppState();

  const [activeView, setActiveView] = useState<ViewType>('your-new-view');
  const [view, setView] = useState<string>('dayGridMonth');
  const [refreshEvents, setRefreshEvents] = useState(0);
  const [navbarVisible, setNavbarVisible] = useState(false);

  const DEV_MODE = false;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('lastActiveView') as ViewType;
      if (savedView && (savedView === 'calendar' || savedView === 'your-new-view')) {
        setActiveView(savedView);
      }
    }
  }, []);

  // Fetch feature unlock status - same as ThemeSidebar
  useEffect(() => {
    const fetchFeatureStatus = async () => {
      if (!isAuthenticated) return;
      
      try {
        const status = await authAPI.getUserStatus();
        setHasUnlockedFeatures(status.hasUnlockedFeatures);
        console.log('Feature unlock status:', status.hasUnlockedFeatures);
      } catch (error) {
        console.error('Failed to fetch feature status:', error);
        setHasUnlockedFeatures(false);
      }
    };

    fetchFeatureStatus();
  }, [isAuthenticated]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await authAPI.checkAuthStatus();
        setIsAuthenticated(isAuth);
        
        if (isAuth) {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserData(user);
          }
          
          if (typeof window !== 'undefined') {
            const hasViewPreference = localStorage.getItem('lastActiveView');
            if (!hasViewPreference) {
              localStorage.setItem('lastActiveView', 'your-new-view');
            }
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      }
    };

    setTimeout(checkAuth, 500);
  }, []);

  useEffect(() => {
    if (!userData) return;

    if (DEV_MODE) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(!userData.has_seen_onboarding);
    }
  }, [userData]);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    return () => {
      if (posthog) {
        posthog.capture('$pageleave', {
          $current_url: window.location.href,
          $pathname: window.location.pathname
        });
      }
    };
  }, [posthog]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 25) {
        setNavbarVisible(true);
      } else if (e.clientY > 70) {
        setNavbarVisible(false);
      }
    };

    setTimeout(() => {
      window.addEventListener('mousemove', handleMouseMove);
    }, 100);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleEventChange = async () => {
    await initializeData();
    setRefreshEvents((prev) => prev + 1);
  };

  const handleViewChange = (newView: string) => {
    setView(newView);
  };

  const handleAppViewChange = (newView: ViewType) => {
    setActiveView(newView);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastActiveView', newView);
    }
  };

  const handleRightSidebarToggle = () => {
    setRightSidebarOpen(!rightSidebarOpen);
    
    if (posthog) {
      setTimeout(() => {
        posthog.capture('sidebar_toggled', {
          isOpen: !rightSidebarOpen,
          timestamp: new Date().toISOString()
        });
      }, 0);
    }
  };

  const handleOnboardingSkip = async () => {
    setShowOnboarding(false);
    
    try {
      await authAPI.markOnboardingSeen();
      
      const updatedUser = { ...userData, has_seen_onboarding: true };
      setUserData(updatedUser);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      console.error('Failed to save onboarding:', err);
    }

    if (posthog) {
      posthog.capture('onboarding_skipped', {
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    
    try {
      await authAPI.markOnboardingSeen();
      
      const updatedUser = { ...userData, has_seen_onboarding: true };
      setUserData(updatedUser);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      console.error('Failed to save onboarding:', err);
    }

    if (posthog) {
      posthog.capture('onboarding_completed', {
        timestamp: new Date().toISOString()
      });
    }
  };

  // Settings change handler with auto-save
  const handleSettingsChange = async (newSettings: any) => {
    // Update the settings (this marks it as unsaved)
    updateSettings(newSettings);
    
    // Automatically save the settings
    setTimeout(async () => {
      await saveSettings();
    }, 100);
    
    // Track changes if posthog is available
    if (posthog) {
      if (newSettings.theme) {
        posthog.capture('theme_changed', {
          theme: newSettings.theme,
          timestamp: new Date().toISOString()
        });
      }
      if (newSettings.dark_mode !== undefined) {
        posthog.capture('dark_mode_toggled', {
          dark_mode: newSettings.dark_mode,
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  const handleSidebarTaskCreate = async (taskData: any): Promise<void> => {
    const newTask = await createTask(taskData);
    if (newTask && posthog) {
      setTimeout(() => {
        posthog.capture('task_created', {
          task_id: newTask.id,
          task_type: taskData.type || 'general',
          timestamp: new Date().toISOString()
        });
      }, 0);
    }
  };

  const handleSidebarTaskDelete = async (taskId: string): Promise<boolean> => {
    try {
      const success = await deleteTask(taskId);
      if (success && posthog) {
        setTimeout(() => {
          posthog.capture('task_deleted', {
            task_id: taskId,
            timestamp: new Date().toISOString()
          });
        }, 0);
      }
      return success;
    } catch (error) {
      console.error('Failed to delete task:', error);
      return false;
    }
  };

  const handleEventCreate = async (eventData: any): Promise<void> => {
    const newEvent = await createEvent(eventData);
    if (newEvent) {
      handleEventChange();
      
      if (posthog) {
        setTimeout(() => {
          posthog.capture('calendar_event_created', {
            event_id: newEvent.id,
            event_title: eventData.title || 'Untitled',
            event_duration: eventData.duration,
            has_attendees: !!(eventData.attendees && eventData.attendees.length > 0),
            timestamp: new Date().toISOString()
          });
        }, 0);
      }
    }
  };

  const handleEventUpdate = async (eventId: string, updates: any): Promise<void> => {
    const updatedEvent = await updateEvent(eventId, updates);
    if (updatedEvent) {
      handleEventChange();
      
      if (posthog) {
        setTimeout(() => {
          posthog.capture('calendar_event_updated', {
            event_id: eventId,
            updated_fields: Object.keys(updates),
            timestamp: new Date().toISOString()
          });
        }, 0);
      }
    }
  };

  const handleEventDelete = async (eventId: string): Promise<boolean> => {
    try {
      const success = await deleteEvent(eventId);
      if (success) {
        handleEventChange();
        
        if (posthog) {
          setTimeout(() => {
            posthog.capture('calendar_event_deleted', {
              event_id: eventId,
              timestamp: new Date().toISOString()
            });
          }, 0);
        }
      }
      return success;
    } catch (error) {
      console.error('Failed to delete event:', error);
      return false;
    }
  };

  const renderActiveView = () => {
    return (
      <div className="scaled-view-container">
        <div className={`view-component ${activeView === 'your-new-view' ? 'active' : 'hidden'}`}>
          <Planner 
            rightSidebarOpen={false}
            activeAppView={activeView}
            onAppViewChange={handleAppViewChange}
            isAuthenticated={isAuthenticated}
            settingsUnlocked={hasUnlockedFeatures}
          />
        </div>
        
        <div className={`view-component notes-view ${activeView === 'your-new-view' ? 'active' : 'hidden'}`} style={{ height: '100%', background: '#f9fafb' }}>
          <Notes />
        </div>
        
        <div className={`view-component ${activeView === 'calendar' ? 'active' : 'hidden'}`}>
          <Calendar 
            refreshTrigger={refreshEvents}
            onEventChange={handleEventChange} 
            onViewChange={handleViewChange}
            rightSidebarOpen={false}
            activeAppView={activeView}
            onAppViewChange={handleAppViewChange}
            currentView={view}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden">
      <Popup />

      {showOnboarding && (
        <Onboarding
          isVisible={showOnboarding}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
          currentView={activeView}
          onViewChange={handleAppViewChange}
        />
      )}

      {/* Theme Sidebar Component - now with unified settings */}
      {settings && (
        <ThemeSidebar
          isOpen={showThemeSidebar}
          onClose={() => setShowThemeSidebar(false)}
          settings={settings}
          onSettingsChange={handleSettingsChange}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      )}

      {/* Theme Button - Attached to right edge */}
      <button 
        className="theme-open-button"
        onClick={() => setShowThemeSidebar(true)}
        aria-label="Open themes"
      >
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="palette-icon"
        >
          <defs>
            <linearGradient id="rainbow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#FF6B9D' }} />
              <stop offset="25%" style={{ stopColor: '#FFA94D' }} />
              <stop offset="50%" style={{ stopColor: '#FFD93D' }} />
              <stop offset="75%" style={{ stopColor: '#6BCF7F' }} />
              <stop offset="100%" style={{ stopColor: '#6BA3FF' }} />
            </linearGradient>
          </defs>
          <circle cx="13.5" cy="6.5" r="1.8" fill="#FF6B9D"/>
          <circle cx="17.5" cy="10.5" r="1.8" fill="#FFD93D"/>
          <circle cx="8.5" cy="7.5" r="1.8" fill="#FFA94D"/>
          <circle cx="6.5" cy="12.5" r="1.8" fill="#6BCF7F"/>
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" 
                stroke="url(#rainbow-gradient)" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))' }}/>
        </svg>
      </button>

      <Sidebar 
        onEventChange={handleEventChange}
        refreshTrigger={refreshEvents}
      />
      
      <div className="main-content-area">
        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}
        
        <div className="view-content">
          {renderActiveView()}
        </div>
      </div>

      <style jsx>{`
        .main-content-area {
          position: absolute;
          top: 0;
          left: 278px;
          right: 0;
          min-height: 100vh;
          overflow: visible;
          padding: 0;
        }

        .view-content {
          height: 100%;
          width: 100%;
          overflow: hidden;
          margin-top: 0px;
        }

        .scaled-view-container {
          width: 100%;
          min-height: 100vh;
          margin: 0;
          position: relative;
          overflow: visible;
          background: white;
        }

        .view-component {
          width: 100%;
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
        }

        .view-component.active {
          display: block;
          opacity: 1;
          visibility: visible;
          z-index: 1;
        }

        .view-component.hidden {
          display: none;
        }

        .notes-view.active {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .error-banner {
          position: absolute;
          top: 60px;
          left: 20px;
          right: 20px;
          z-index: 1001;
          background: #fee2e2;
          color: #dc2626;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
        }

        .theme-open-button {
          position: fixed;
          top: 90px;
          right: 0;
          transform: translateY(-50%);
          width: 40px;
          height: 48px;
          background: hsl(var(--real-sidebar));
          border: 1px solid hsl(var(--border) / 0.5);
          border-right: none;
          border-radius: 8px 0 0 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          z-index: 998;
        }

        .theme-open-button:hover {
          width: 44px;
        }

        .theme-open-button:active {
          transform: translateY(-50%) scale(0.98);
        }

        .palette-icon {
          transition: transform 0.2s ease;
        }

        .theme-open-button:hover .palette-icon {
          transform: scale(1.1);
        }

        @media (max-width: 768px) {
          .main-content-area {
            left: 0;
            right: 0;
          }
        }
      `}</style>

      <style jsx global>{`
        html, body {
          overflow: auto !important;
          height: auto;
        }

        .scaled-view-container {
          border-radius: 0 !important;
          overflow: visible !important;
        }

        .scaled-view-container > .view-component > *:first-child {
          width: 100%;
          height: 100%;
          border-radius: 0;
          overflow: visible;
        }

        .fc-theme-standard,
        .fc,
        .planner-container {
          border-radius: 0 !important;
        }

        .notes-section .notes-container {
          height: 100%;
          border-radius: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }
      `}</style>
    </div>
  );
};

const Page = () => {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  return (
    <ThemeProvider>
      <AppContent 
        rightSidebarOpen={rightSidebarOpen}
        setRightSidebarOpen={setRightSidebarOpen}
      />
    </ThemeProvider>
  );
};

export default Page;