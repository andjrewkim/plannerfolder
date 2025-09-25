'use client';
import React, { useState, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import Calendar from '../components/Calendar/Calendar';
import Sidebar from '../components/Sidebar';
import Planner from '../components/Planner/Planner';
import Onboarding from '../components/Onboarding/Onboarding'; // Import the onboarding component
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
  
  // Authentication state - removed isLoadingAuth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Add layout ready state to prevent layout shifts
  const [layoutReady, setLayoutReady] = useState(false);

  // Client-side hydration state
  const [isClient, setIsClient] = useState(false);

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
  const DEV_MODE = false; // <-- toggle here

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
    
    // Only access localStorage after client-side hydration
    const savedView = localStorage.getItem('lastActiveView') as ViewType;
    if (savedView && (savedView === 'calendar' || savedView === 'your-new-view')) {
      setActiveView(savedView);
    }
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    const completed = localStorage.getItem('onboardingCompleted');

    if (DEV_MODE || (!hasSeenOnboarding && !completed)) {
      // Show onboarding after a short delay
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setOnboardingCompleted(!!completed);
    }
  }, [isClient]);

  // Ensure layout is ready before showing content
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    const timer = requestAnimationFrame(() => {
      setLayoutReady(true);
    });
    
    return () => cancelAnimationFrame(timer);
  }, []);

  // Check authentication status - runs in background without blocking UI
  useEffect(() => {
    if (!isClient) return;

    const checkAuth = async () => {
      try {
        const isAuth = await authAPI.checkAuthStatus();
        setIsAuthenticated(isAuth);
        
        // For new users (first time authentication), ensure planner is the default
        if (isAuth) {
          const hasViewPreference = localStorage.getItem('lastActiveView');
          if (!hasViewPreference) {
            localStorage.setItem('lastActiveView', 'your-new-view');
            console.log('New user detected, setting default view to planner');
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, [isClient]);

  // Log the initial view loaded from localStorage
  useEffect(() => {
    if (isClient) {
      console.log('Initial view loaded from localStorage:', activeView);
    }
  }, [activeView, isClient]);

  // Track view changes
  useEffect(() => {
    if (posthog && isClient) {
      posthog.capture('app_view_changed', {
        view: activeView,
        timestamp: new Date().toISOString()
      });
    }
  }, [posthog, activeView, isClient]);

  // Track calendar view changes (only when in calendar view)
  useEffect(() => {
    if (posthog && activeView === 'calendar' && isClient) {
      posthog.capture('calendar_view_changed', {
        view: view,
        timestamp: new Date().toISOString()
      });
    }
  }, [posthog, view, activeView, isClient]);

  // Don't disable scrolling at all - let everything scroll
  useEffect(() => {
    if (!isClient) return;

    // Remove any scroll blocking
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    return () => {
      if (posthog) {
        console.log('Sending manual $pageleave event...');
        posthog.capture('$pageleave', {
          $current_url: window.location.href,
          $pathname: window.location.pathname
        });
      }
    };
  }, [posthog, isClient]);

  // Listen for navbar visibility changes
  useEffect(() => {
    if (!isClient) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 25) {
        setNavbarVisible(true);
      } else if (e.clientY > 70) {
        setNavbarVisible(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isClient]);

  const handleEventChange = async () => {
    await initializeData();
    setRefreshEvents((prev) => prev + 1);
  };

  const handleViewChange = (newView: string) => {
    setView(newView);
  };

  const handleAppViewChange = (newView: ViewType) => {
    // Update the active view immediately
    setActiveView(newView);
    
    // Save the view preference to localStorage (only on client)
    if (isClient) {
      localStorage.setItem('lastActiveView', newView);
      console.log('Saved view preference to localStorage:', newView);
    }
  };

  const handleRightSidebarToggle = () => {
    setRightSidebarOpen(!rightSidebarOpen);
    
    if (posthog && isClient) {
      posthog.capture('sidebar_toggled', {
        isOpen: !rightSidebarOpen,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Onboarding handlers
  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setOnboardingCompleted(true);
    
    if (isClient) {
      localStorage.setItem('onboardingCompleted', 'true');
      localStorage.setItem('hasSeenOnboarding', 'true');
    }

    // Track completion
    if (posthog && isClient) {
      posthog.capture('onboarding_completed', {
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
    
    if (isClient) {
      localStorage.setItem('hasSeenOnboarding', 'true');
      localStorage.setItem('onboardingSkipped', 'true');
    }

    // Track skip
    if (posthog && isClient) {
      posthog.capture('onboarding_skipped', {
        timestamp: new Date().toISOString()
      });
    }
  };

  // Task handlers with PostHog tracking
  const handleSidebarTaskCreate = async (taskData: any): Promise<void> => {
    const newTask = await createTask(taskData);
    if (newTask) {
      console.log('Task created:', newTask);
      
      if (posthog && isClient) {
        posthog.capture('task_created', {
          task_id: newTask.id,
          task_type: taskData.type || 'general',
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  const handleSidebarTaskDelete = async (taskId: string): Promise<boolean> => {
    try {
      const success = await deleteTask(taskId);
      if (success) {
        console.log('Task deleted successfully');
        
        if (posthog && isClient) {
          posthog.capture('task_deleted', {
            task_id: taskId,
            timestamp: new Date().toISOString()
          });
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete task:', error);
      return false;
    }
  };

  // Event handlers with PostHog tracking
  const handleEventCreate = async (eventData: any): Promise<void> => {
    const newEvent = await createEvent(eventData);
    if (newEvent) {
      console.log('Event created:', newEvent);
      handleEventChange();
      
      if (posthog && isClient) {
        posthog.capture('calendar_event_created', {
          event_id: newEvent.id,
          event_title: eventData.title || 'Untitled',
          event_duration: eventData.duration,
          has_attendees: !!(eventData.attendees && eventData.attendees.length > 0),
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  const handleEventUpdate = async (eventId: string, updates: any): Promise<void> => {
    const updatedEvent = await updateEvent(eventId, updates);
    if (updatedEvent) {
      console.log('Event updated:', updatedEvent);
      handleEventChange();
      
      if (posthog && isClient) {
        posthog.capture('calendar_event_updated', {
          event_id: eventId,
          updated_fields: Object.keys(updates),
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  const handleEventDelete = async (eventId: string): Promise<boolean> => {
    try {
      const success = await deleteEvent(eventId);
      if (success) {
        console.log('Event deleted successfully');
        handleEventChange();
        
        if (posthog && isClient) {
          posthog.capture('calendar_event_deleted', {
            event_id: eventId,
            timestamp: new Date().toISOString()
          });
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete event:', error);
      return false;
    }
  };

  // Render the active view content - FIXED: Always render both, just hide with CSS
  const renderActiveView = () => {
    return (
      <div className="scaled-view-container">
        {/* Planner View with Notes - Always rendered, visibility controlled by CSS */}
        <div className={`view-component ${activeView === 'your-new-view' ? 'active' : 'hidden'}`}>
          <Planner 
            rightSidebarOpen={false}
            activeAppView={activeView}
            onAppViewChange={handleAppViewChange}
            isAuthenticated={isAuthenticated}
          />
          <div style={{ height: '100%', background: '#f9fafb' }}>
            <Notes />
          </div>
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

  // Show a simple loading state during SSR/hydration
  if (!isClient) {
    return (
      <div className="h-screen overflow-hidden">
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          Loading...
        </div>
      </div>
    );
  }

  // Removed loading screen - content loads immediately with layout protection
  return (
    <div className="h-screen overflow-hidden">
      <Popup />

      {/* Onboarding Component */}
      <Onboarding
        isVisible={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
        currentView={activeView}
        onViewChange={handleAppViewChange}
      />

      {/* Sidebar - Always render but with opacity control */}
      <div style={{ opacity: layoutReady ? 1 : 0, transition: 'opacity 0.1s ease-in' }}>
        <Sidebar 
          onEventChange={handleEventChange}
          refreshTrigger={refreshEvents}
        />
      </div>
      
      {/* Main content area - Full height with opacity control */}
      <div className="main-content-area" style={{ opacity: layoutReady ? 1 : 0, transition: 'opacity 0.1s ease-in' }}>
        {/* Error message overlay */}
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
        
        {/* Dynamic View Content - The header is now integrated into both components */}
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
          visibility: visible;
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
          transition: opacity 0.2s ease-in-out;
        }

        .view-component.hidden {
          display: block;
          opacity: 0;
          visibility: hidden;
          z-index: 0;
          pointer-events: none;
          transition: opacity 0.2s ease-in-out;
        }

        @media (max-width: 768px) {
          .main-content-area {
            left: 0;
            right: 0;
          }

          .scaled-view-container {
            width: 100%;
            height: 100%;
            margin: 0;
          }

          .view-content {
            padding: 0;
          }

          .planner-section {
            width: 100%;
          }

          .notes-section {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .scaled-view-container {
            width: 100%;
            height: 100%;
            margin: 0;
          }

          .view-content {
            padding: 0;
          }
        }
      `}</style>

      <style jsx global>{`
        /* Allow scrolling */
        html, body {
          overflow: auto !important;
          height: auto;
        }

        /* Remove border radius and ensure full container coverage */
        .scaled-view-container {
          border-radius: 0 !important;
          overflow: visible !important;
        }

        /* Ensure first-level children fill the container completely */
        .scaled-view-container > .view-component > *:first-child {
          width: 100%;
          height: 100%;
          border-radius: 0;
          overflow: visible;
        }

        /* Remove border radius from calendar/planner classes */
        .fc-theme-standard,
        .fc,
        .planner-container {
          border-radius: 0 !important;
        }

        /* Notes component styling adjustments - keeping notes section intact */
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