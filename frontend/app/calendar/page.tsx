'use client';
import React, { useState, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import Calendar from '../components/Calendar/Calendar';
import Sidebar from '../components/Sidebar';
import Planner from '../components/Planner/Planner';
import Onboarding from '../components/Onboarding/Onboarding';
import '../globals.css';
import { ThemeProvider } from '../services/themeContext';
import { useAppState } from '../hooks/useAppState';
import { authAPI } from '../../lib/auth';
import Notes from '../components/Notes';
import Popup from '../components/Popup/Popup';

// Define available views - Planner (your-new-view) is now the default/first
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
  
  // Authentication state - start as true for instant display
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  
  // Remove layout ready state - no longer needed
  const [isClient, setIsClient] = useState(true); // Start as true for SSR

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  
  // Use the centralized state hook
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

  
  // View management state - Default to 'your-new-view' (planner)
  const [activeView, setActiveView] = useState<ViewType>('your-new-view');
  const [view, setView] = useState<string>('dayGridMonth');
  const [refreshEvents, setRefreshEvents] = useState(0);
  const [navbarVisible, setNavbarVisible] = useState(false);

  // Set this to true for dev, false for production
  const DEV_MODE = false;

  // Initialize view from localStorage synchronously on mount
  useEffect(() => {
    // Check localStorage immediately without waiting
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('lastActiveView') as ViewType;
      if (savedView && (savedView === 'calendar' || savedView === 'your-new-view')) {
        setActiveView(savedView);
      }
    }
  }, []); // Run only once on mount

  // Handle onboarding check - run in background without blocking
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use setTimeout to avoid blocking initial render
    setTimeout(() => {
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
      const completed = localStorage.getItem('onboardingCompleted');

      if (DEV_MODE || (!hasSeenOnboarding && !completed)) {
        setShowOnboarding(true);
      } else {
        setOnboardingCompleted(!!completed);
      }
    }, 100); // Very short delay to avoid blocking
  }, []);

  // Check authentication status in background - don't block UI
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await authAPI.checkAuthStatus();
        setIsAuthenticated(isAuth);
        
        if (isAuth && typeof window !== 'undefined') {
          const hasViewPreference = localStorage.getItem('lastActiveView');
          if (!hasViewPreference) {
            localStorage.setItem('lastActiveView', 'your-new-view');
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        // Don't set to false immediately - keep showing content
      }
    };

    // Run auth check after a delay to avoid blocking initial render
    setTimeout(checkAuth, 500);
  }, []);

  // Track view changes - run in background
  useEffect(() => {
    if (posthog) {
      setTimeout(() => {
        posthog.capture('app_view_changed', {
          view: activeView,
          timestamp: new Date().toISOString()
        });
      }, 0);
    }
  }, [posthog, activeView]);

  // Track calendar view changes - run in background
  useEffect(() => {
    if (posthog && activeView === 'calendar') {
      setTimeout(() => {
        posthog.capture('calendar_view_changed', {
          view: view,
          timestamp: new Date().toISOString()
        });
      }, 0);
    }
  }, [posthog, view, activeView]);

  // Cleanup and scroll management
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

  // Mouse move handler - run in background
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 25) {
        setNavbarVisible(true);
      } else if (e.clientY > 70) {
        setNavbarVisible(false);
      }
    };

    // Add listener after a delay to avoid blocking initial render
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

  // Onboarding handlers
  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setOnboardingCompleted(true);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboardingCompleted', 'true');
      localStorage.setItem('hasSeenOnboarding', 'true');
    }

    if (posthog) {
      setTimeout(() => {
        posthog.capture('onboarding_completed', {
          timestamp: new Date().toISOString()
        });
      }, 0);
    }
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasSeenOnboarding', 'true');
      localStorage.setItem('onboardingSkipped', 'true');
    }

    if (posthog) {
      setTimeout(() => {
        posthog.capture('onboarding_skipped', {
          timestamp: new Date().toISOString()
        });
      }, 0);
    }
  };

  // Task handlers with PostHog tracking
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

  // Event handlers with PostHog tracking
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

  // Render the active view content - Immediate rendering
  const renderActiveView = () => {
    return (
      <div className="scaled-view-container">
        {/* Planner View - Always rendered, visibility controlled by CSS */}
        <div className={`view-component ${activeView === 'your-new-view' ? 'active' : 'hidden'}`}>
          <Planner 
            rightSidebarOpen={false}
            activeAppView={activeView}
            onAppViewChange={handleAppViewChange}
            isAuthenticated={isAuthenticated}
          />
        </div>
        
        {/* Notes - Separate component, always rendered alongside planner */}
        <div className={`view-component notes-view ${activeView === 'your-new-view' ? 'active' : 'hidden'}`} style={{ height: '100%', background: '#f9fafb' }}>
          <Notes />
        </div>
        
        {/* Calendar View - Always rendered, visibility controlled by CSS */}
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

  // Render immediately - no loading states
  return (
    <div className="h-screen overflow-hidden">
      <Popup />

      {/* Onboarding Component - only render when needed */}
      {showOnboarding && (
        <Onboarding
          isVisible={showOnboarding}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
          currentView={activeView}
          onViewChange={handleAppViewChange}
        />
      )}

      {/* Sidebar - Always render */}
      <Sidebar 
        onEventChange={handleEventChange}
        refreshTrigger={refreshEvents}
      />
      
      {/* Main content area - Immediate rendering */}
      <div className="main-content-area">
        {/* Error message overlay - only when there's an error */}
        {error && (
          <div style={{ 
            position: 'absolute', 
            top: '60px', 
            left: '20px', 
            right: '20px',
            zIndex: 1001,
            background: '#fee2e2',
            color: '#dc2626',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
        
        {/* Dynamic View Content */}
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