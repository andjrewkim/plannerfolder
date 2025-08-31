'use client';
import React, { useState, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import Calendar from '../components/Calendar/Calendar';
import Sidebar from '../components/Sidebar';
import Planner from '../components/Planner/Planner';
import '../globals.css';
import { ThemeProvider } from '../services/themeContext';
import { useAppState } from '../hooks/useAppState';
import { authAPI } from '../../lib/auth';
import Notes from '../components/Notes';

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
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // Use the centralized state hook - but only initialize after auth
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

  // View management state - Initialize immediately from localStorage
  const [activeView, setActiveView] = useState<ViewType>(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('lastActiveView') as ViewType;
      if (savedView && (savedView === 'calendar' || savedView === 'your-new-view')) {
        return savedView;
      }
    }
    return 'your-new-view';
  });
  
  const [view, setView] = useState<string>('dayGridMonth');
  const [refreshEvents, setRefreshEvents] = useState(0);
  const [navbarVisible, setNavbarVisible] = useState(false);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await authAPI.checkAuthStatus();
        setIsAuthenticated(isAuth);
        
        // For new users (first time authentication), ensure planner is the default
        if (isAuth && typeof window !== 'undefined') {
          const hasViewPreference = localStorage.getItem('lastActiveView');
          if (!hasViewPreference) {
            localStorage.setItem('lastActiveView', 'your-new-view');
            console.log('New user detected, setting default view to planner');
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Initialize data only after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated && !isLoadingAuth) {
      initializeData();
    }
  }, [isAuthenticated, isLoadingAuth, initializeData]);

  // Track view changes
  useEffect(() => {
    if (posthog && isAuthenticated) {
      posthog.capture('app_view_changed', {
        view: activeView,
        timestamp: new Date().toISOString()
      });
    }
  }, [posthog, activeView, isAuthenticated]);

  // Track calendar view changes (only when in calendar view)
  useEffect(() => {
    if (posthog && activeView === 'calendar' && isAuthenticated) {
      posthog.capture('calendar_view_changed', {
        view: view,
        timestamp: new Date().toISOString()
      });
    }
  }, [posthog, view, activeView, isAuthenticated]);

  // Set up scroll and cleanup - do this immediately
  useEffect(() => {
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
  }, [posthog]);

  // Listen for navbar visibility changes - set up immediately
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 25) {
        setNavbarVisible(true);
      } else if (e.clientY > 70) {
        setNavbarVisible(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleEventChange = async () => {
    if (isAuthenticated) {
      await initializeData();
      setRefreshEvents((prev) => prev + 1);
    }
  };

  const handleViewChange = (newView: string) => {
    setView(newView);
  };

  const handleAppViewChange = (newView: ViewType) => {
    setActiveView(newView);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastActiveView', newView);
      console.log('Saved view preference to localStorage:', newView);
    }
  };

  const handleRightSidebarToggle = () => {
    setRightSidebarOpen(!rightSidebarOpen);
    
    if (posthog && isAuthenticated) {
      posthog.capture('sidebar_toggled', {
        isOpen: !rightSidebarOpen,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Task handlers with PostHog tracking
  const handleSidebarTaskCreate = async (taskData: any): Promise<void> => {
    if (!isAuthenticated) return;
    
    const newTask = await createTask(taskData);
    if (newTask) {
      console.log('Task created:', newTask);
      
      if (posthog) {
        posthog.capture('task_created', {
          task_id: newTask.id,
          task_type: taskData.type || 'general',
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  const handleSidebarTaskDelete = async (taskId: string): Promise<boolean> => {
    if (!isAuthenticated) return false;
    
    try {
      const success = await deleteTask(taskId);
      if (success) {
        console.log('Task deleted successfully');
        
        if (posthog) {
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
    if (!isAuthenticated) return;
    
    const newEvent = await createEvent(eventData);
    if (newEvent) {
      console.log('Event created:', newEvent);
      handleEventChange();
      
      if (posthog) {
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
    if (!isAuthenticated) return;
    
    const updatedEvent = await updateEvent(eventId, updates);
    if (updatedEvent) {
      console.log('Event updated:', updatedEvent);
      handleEventChange();
      
      if (posthog) {
        posthog.capture('calendar_event_updated', {
          event_id: eventId,
          updated_fields: Object.keys(updates),
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  const handleEventDelete = async (eventId: string): Promise<boolean> => {
    if (!isAuthenticated) return false;
    
    try {
      const success = await deleteEvent(eventId);
      if (success) {
        console.log('Event deleted successfully');
        handleEventChange();
        
        if (posthog) {
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

  // Content loading overlay component
  const ContentLoadingOverlay = () => (
    <div className="content-loading-overlay">
      <div className="loading-spinner">
        <div className="spinner"></div>
        <div className="loading-text">Loading your workspace...</div>
      </div>
    </div>
  );

  // Render authenticated content or loading overlay
  const renderMainContent = () => {
    if (isLoadingAuth) {
      return <ContentLoadingOverlay />;
    }

    if (!isAuthenticated) {
      return (
        <div className="auth-required-overlay">
          <div className="auth-message">
            <h2>Authentication Required</h2>
            <p>Please log in to access your workspace.</p>
          </div>
        </div>
      );
    }

    // Render the actual content only when authenticated
    return (
      <div className="scaled-view-container">
        {/* Planner View with Notes */}
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
        
        {/* Calendar View */}
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
      {/* Sidebar - Always visible for app shell */}
      <Sidebar 
        onEventChange={handleEventChange}
        refreshTrigger={refreshEvents}
      />
      
      {/* Main content area - Always rendered with full styling */}
      <div className="main-content-area">
        {/* Error message overlay */}
        {error && (
          <div className="error-overlay">
            {error}
          </div>
        )}
        
        {/* Dynamic View Content */}
        <div className="view-content">
          {renderMainContent()}
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
          width: 85%;
          min-height: 200vh;
          margin: 2% auto 50px auto;
          position: relative;
          border-radius: 12px;
          box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.1), 0 4px 8px -2px rgba(0, 0, 0, 0.06);
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

        .error-overlay {
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

        .content-loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .loading-spinner {
          text-align: center;
          color: #6b7280;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f3f4f6;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px auto;
        }

        .loading-text {
          font-size: 16px;
          font-weight: 500;
        }

        .auth-required-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.98);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .auth-message {
          text-align: center;
          color: #374151;
          max-width: 400px;
          padding: 32px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .auth-message h2 {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #111827;
        }

        .auth-message p {
          font-size: 16px;
          color: #6b7280;
          margin: 0;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .main-content-area {
            left: 0;
            right: 0;
          }

          .scaled-view-container {
            width: 90%;
            height: 88%;
            margin: 1% auto;
          }

          .view-content {
            padding: 15px;
          }

          .auth-message {
            margin: 20px;
            padding: 24px;
          }

          .auth-message h2 {
            font-size: 20px;
          }

          .auth-message p {
            font-size: 14px;
          }
        }

        @media (max-width: 480px) {
          .scaled-view-container {
            width: 95%;
            height: 90%;
            margin: 1% auto;
          }

          .view-content {
            padding: 10px;
          }

          .auth-message {
            margin: 16px;
            padding: 20px;
          }
        }
      `}</style>

      <style jsx global>{`
        /* Ensure body and html are ready immediately */
        html, body {
          overflow: auto !important;
          height: auto;
          margin: 0;
          padding: 0;
        }

        /* Pre-load the main app container styles */
        .scaled-view-container {
          border-radius: 12px !important;
          overflow: hidden !important;
        }

        /* Ensure first-level children fill the container and respect border radius */
        .scaled-view-container > .view-component > *:first-child {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          overflow: hidden;
        }

        /* Pre-load component-specific styling */
        .fc-theme-standard,
        .fc,
        .planner-container {
          border-radius: 12px !important;
        }

        /* Notes component styling adjustments */
        .notes-section .notes-container {
          height: 100%;
          border-radius: 0 0 12px 12px;
          overflow-y: auto;
          overflow-x: hidden;
        }

        /* Ensure smooth transitions for loading states */
        * {
          box-sizing: border-box;
        }

        /* Pre-load any critical app fonts and styles */
        .main-content-area * {
          transition: opacity 0.2s ease-in-out;
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