'use client';
import React, { useState, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import Calendar from '../components/Calendar/Calendar';
import Sidebar from '../components/Sidebar';
import Planner from '../components/Planner/Planner';
import '../globals.css';
import { ThemeProvider } from '../services/themeContext';
import { useAppState } from '../hooks/useAppState';
import { authAPI } from '../../lib/auth'; // Adjust path as needed
import Notes from '../components/Notes';


// Define available views (matching your header component)
type ViewType = 'calendar' | 'your-new-view';

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

  // Check if updateTask is available
  const updateTask = (useAppState() as any).updateTask;
  
  // View management state
  const [activeView, setActiveView] = useState<ViewType>('calendar');
  const [view, setView] = useState<string>('dayGridMonth');
  const [refreshEvents, setRefreshEvents] = useState(0);
  const [navbarVisible, setNavbarVisible] = useState(false);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await authAPI.checkAuthStatus();
        setIsAuthenticated(isAuth);
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Initialize data when component mounts
  useEffect(() => {
    initializeData();
  }, [initializeData]);

  // Track view changes
  useEffect(() => {
    if (posthog) {
      posthog.capture('app_view_changed', {
        view: activeView,
        timestamp: new Date().toISOString()
      });
    }
  }, [posthog, activeView]);

  // Track calendar view changes (only when in calendar view)
  useEffect(() => {
    if (posthog && activeView === 'calendar') {
      posthog.capture('calendar_view_changed', {
        view: view,
        timestamp: new Date().toISOString()
      });
    }
  }, [posthog, view, activeView]);

  // Don't disable scrolling at all - let everything scroll
  useEffect(() => {
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
  }, [posthog]);

  // Listen for navbar visibility changes
  useEffect(() => {
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
  }, []);

  const handleEventChange = async () => {
    await initializeData();
    setRefreshEvents((prev) => prev + 1);
  };

  const handleViewChange = (newView: string) => {
    setView(newView);
  };

  const handleAppViewChange = (newView: ViewType) => {
    console.log('handleAppViewChange called with:', newView);
    console.log('Current activeView:', activeView);
    setActiveView(newView);
  };

  // Add this useEffect to monitor activeView changes
  useEffect(() => {
    console.log('activeView changed to:', activeView);
  }, [activeView]);

  const handleRightSidebarToggle = () => {
    setRightSidebarOpen(!rightSidebarOpen);
    
    if (posthog) {
      posthog.capture('sidebar_toggled', {
        isOpen: !rightSidebarOpen,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Task handlers with PostHog tracking
  const handleSidebarTaskCreate = async (taskData: any): Promise<void> => {
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

  const handleSidebarTaskUpdate = async (taskId: string, updates: any): Promise<void> => {
    if (updateTask && typeof updateTask === 'function') {
      const updatedTask = await updateTask(taskId, updates);
      if (updatedTask) {
        console.log('Task updated:', updatedTask);
        
        if (posthog) {
          posthog.capture('task_updated', {
            task_id: taskId,
            updates: Object.keys(updates),
            timestamp: new Date().toISOString()
          });
        }
      }
    } else {
      console.warn('updateTask function is not available in useAppState hook');
      
      try {
        await deleteTask(taskId);
        const updatedTaskData = { ...updates, id: taskId };
        await createTask(updatedTaskData);
        console.log('Task updated via delete/create workaround');
        
        if (posthog) {
          posthog.capture('task_updated_workaround', {
            task_id: taskId,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Failed to update task:', error);
        setError('Failed to update task');
      }
    }
  };

  const handleSidebarTaskDelete = async (taskId: string): Promise<boolean> => {
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

  // Render the active view content
  const renderActiveView = () => {
    return (
      <div className="scaled-view-container">
        {/* Calendar View */}
        <div className={`view-component ${activeView === 'calendar' ? 'active' : 'hidden'}`}>
          <Calendar 
            refreshTrigger={refreshEvents}
            onEventChange={handleEventChange} 
            onViewChange={handleViewChange}
            rightSidebarOpen={false} // Force to false since we're hiding sidebar
            activeAppView={activeView}
            onAppViewChange={handleAppViewChange}
            currentView={view}
            isAuthenticated={isAuthenticated}
          />
        </div>
        
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
      </div>
    );
  };

    // Show loading state while checking auth
    if (isLoadingAuth) {
      return (
        <div className="h-screen flex items-center justify-center">
          <div>Loading...</div>
        </div>
      );
    }

  return (
    <div className="h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        onEventChange={handleEventChange}
        refreshTrigger={refreshEvents}
      />
      
      {/* Main content area - Full height */}
      <div className="main-content-area">
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

      {/* AI Assistant Sidebar - HIDDEN */}
      {/* 
      <RightSidebar 
        isOpen={rightSidebarOpen}
        onToggle={handleRightSidebarToggle}
        forceClose={false}
        navbarVisible={navbarVisible}
        events={events}
        tasks={tasks}
        onEventCreate={handleEventCreate}
        onEventUpdate={handleEventUpdate}
        onEventDelete={handleEventDelete}
        onTaskCreate={handleSidebarTaskCreate}
        onTaskUpdate={handleSidebarTaskUpdate}
        onTaskDelete={handleSidebarTaskDelete}
        onEventChange={handleEventChange}
      />
      */}

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
        }

        .view-component.active {
          display: block;
          opacity: 1;
          transition: opacity 0.2s ease-in-out;
        }

        .view-component.hidden {
          display: none;
          opacity: 0;
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

          .planner-section {
            width: 100%;
          }

          .notes-section {
            width: 100%;
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
        }
      `}</style>

      <style jsx global>{`
        /* Allow scrolling */
        html, body {
          overflow: auto !important;
          height: auto;
        }

        /* Apply border radius to the container and clip content */
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

        /* Optional: If you need to target specific calendar/planner classes */
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