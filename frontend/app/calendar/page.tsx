'use client';
import React, { useState, useEffect } from 'react';
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

const Page = () => {
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
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [navbarVisible, setNavbarVisible] = useState(false);

  // Initialize data when component mounts
  useEffect(() => {
    initializeData();
  }, [initializeData]);

  // Disable scrolling on mount and re-enable on unmount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, []);

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
  };

  // Fixed task handlers to match expected return types
  const handleSidebarTaskCreate = async (taskData: any): Promise<void> => {
    const newTask = await createTask(taskData);
    if (newTask) {
      console.log('Task created:', newTask);
    }
  };

  const handleSidebarTaskUpdate = async (taskId: string, updates: any): Promise<void> => {
    if (updateTask && typeof updateTask === 'function') {
      const updatedTask = await updateTask(taskId, updates);
      if (updatedTask) {
        console.log('Task updated:', updatedTask);
      }
    } else {
      console.warn('updateTask function is not available in useAppState hook');
      
      try {
        await deleteTask(taskId);
        const updatedTaskData = { ...updates, id: taskId };
        await createTask(updatedTaskData);
        console.log('Task updated via delete/create workaround');
      } catch (error) {
        console.error('Failed to update task:', error);
        setError('Failed to update task');
      }
    }
  };

  // Fixed to return boolean as expected by the interface
  const handleSidebarTaskDelete = async (taskId: string): Promise<boolean> => {
    try {
      const success = await deleteTask(taskId);
      if (success) {
        console.log('Task deleted successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete task:', error);
      return false;
    }
  };

  // Event handlers
  const handleEventCreate = async (eventData: any): Promise<void> => {
    const newEvent = await createEvent(eventData);
    if (newEvent) {
      console.log('Event created:', newEvent);
      handleEventChange();
    }
  };

  const handleEventUpdate = async (eventId: string, updates: any): Promise<void> => {
    const updatedEvent = await updateEvent(eventId, updates);
    if (updatedEvent) {
      console.log('Event updated:', updatedEvent);
      handleEventChange();
    }
  };

  // Fixed to return boolean as expected by the interface
  const handleEventDelete = async (eventId: string): Promise<boolean> => {
    try {
      const success = await deleteEvent(eventId);
      if (success) {
        console.log('Event deleted successfully');
        handleEventChange();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete event:', error);
      return false;
    }
  };

  return (
    <ThemeProvider>
      <Navigation rightSidebarOpen={rightSidebarOpen}>
        <div className="h-screen overflow-hidden">
          {/* Sidebar - based on the actual SidebarProps interface */}
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

          {/* Calendar component - only pass props that CalendarProps expects */}
          <div 
            className="calendar-container"
            style={{
              marginRight: rightSidebarOpen ? '349px' : '30px',
              marginLeft: '10px',
            }}
          >
            {/* Calendar - based on the actual CalendarProps interface */}
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
      </Navigation>
    </ThemeProvider>
  );
}

export default Page;