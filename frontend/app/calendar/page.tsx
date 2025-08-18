'use client';
import React, { useState, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import Calendar from '../components/Calendar/Calendar';
import Sidebar from '../components/Sidebar';
import RightSidebar from '../components/RightSidebar';
import EventForm from '../components/EventForm';
import LLMChat from '../components/LLMChat';
import Navigation from '../components/Navigation';
import '../globals.css';
import { ThemeProvider } from '../services/themeContext';
import { useAppState } from '../hooks/useAppState';

import { EventData } from '../components/EventForm';

interface AppContentProps {
  rightSidebarOpen: boolean;
  setRightSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const AppContent: React.FC<AppContentProps> = ({ rightSidebarOpen, setRightSidebarOpen }) => {
  const posthog = usePostHog();
  
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
  
  const [view, setView] = useState<string>('dayGridMonth');
  const [refreshEvents, setRefreshEvents] = useState(0);
  const [navbarVisible, setNavbarVisible] = useState(false);

  // Initialize data when component mounts
  useEffect(() => {
    initializeData();
  }, [initializeData]);

  // REMOVED: Manual pageview tracking since capture_pageview: true handles this automatically

  // Track calendar view changes
  useEffect(() => {
    if (posthog) {
      posthog.capture('calendar_view_changed', {
        view: view,
        timestamp: new Date().toISOString()
      });
    }
  }, [posthog, view]);

  // Disable scrolling on mount and re-enable on unmount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Send pageleave event on component unmount
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
      
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

  const handleEventSuccess = (newEventData: EventData[]) => {
    setError(null);
    handleEventChange();
  };

  const handleRightSidebarToggle = () => {
    setRightSidebarOpen(!rightSidebarOpen);
    
    // Track sidebar toggle
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
      
      // Track task creation
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
        
        // Track task update
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
        
        // Track workaround update
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
        
        // Track task deletion
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
      
      // Track calendar event creation
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
      
      // Track calendar event update
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
        
        // Track calendar event deletion
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

  return (
    <div className="h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        onEventChange={handleEventChange}
        refreshTrigger={refreshEvents}
      />
      
      {/* Main content area */}
      <div className="ewfsf">
        <div className="form-content">
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      </div>

      {/* Calendar component */}
      <div 
        className="calendar-container"
        style={{
          marginRight: rightSidebarOpen ? '349px' : '30px',
          marginLeft: '10px',
        }}
      >
        <Calendar 
          refreshTrigger={refreshEvents}
          onEventChange={handleEventChange} 
          onViewChange={handleViewChange}
        />
      </div>

      {/* AI Assistant Sidebar */}
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

      <style jsx>{`
        @media (max-width: 768px) {
          .calendar-container {
            margin-right: 0 !important;
          }
        }
      `}</style>

      <style jsx global>{`
        html, body {
          overflow: hidden !important;
          height: 100%;
        }
      `}</style>
    </div>
  );
};

const Page = () => {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  return (
    <ThemeProvider>
      <Navigation rightSidebarOpen={rightSidebarOpen}>
        <AppContent 
          rightSidebarOpen={rightSidebarOpen}
          setRightSidebarOpen={setRightSidebarOpen}
        />
      </Navigation>
    </ThemeProvider>
  );
};

export default Page;