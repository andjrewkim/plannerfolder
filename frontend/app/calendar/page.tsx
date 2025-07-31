'use client';
import React, { useState, useEffect } from 'react';
import Calendar from '../components/Calendar';
import Sidebar from '../components/Sidebar';
import RightSidebar from '../components/RightSidebar';
import EventForm from '../components/EventForm';
import LLMChat from '../components/LLMChat';
import Navigation from '../components/Navigation';
import '../globals.css';
import { ThemeProvider } from '../services/themeContext';
import { useAppState } from '../hooks/useAppState'; // Import the centralized state hook

import { EventData } from '../components/EventForm';

const Page = () => {
  // Use the centralized state hook instead of local state
  const {
    events,
    tasks,
    isLoading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    createTask,
    updateTask,
    deleteTask,
    initializeData,
    setError
  } = useAppState();

  // Remove the old local state that's now handled by the hook
  // const [result, setResult] = useState<EventData[]>([]);
  // const [error, setError] = useState<string | null>(null);
  
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
    // Disable scrolling
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Cleanup function to re-enable scrolling when component unmounts
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

  // This function is now simplified since the hook handles state updates
  const handleEventChange = () => {
    // The hook automatically updates the UI when events change
    // We just need to increment the refresh trigger for any components that still need it
    setRefreshEvents((prev) => prev + 1);
  };

  const handleViewChange = (newView: string) => {
    setView(newView);
  };

  // Updated to work with the hook's data structure
  const handleEventSuccess = (newEventData: EventData[]) => {
    // This function may no longer be needed since the hook handles event creation
    // But if other components still call it, we can clear any errors
    setError(null);
    handleEventChange();
  };

  const handleRightSidebarToggle = () => {
    setRightSidebarOpen(!rightSidebarOpen);
  };

  // NEW: Handlers for sidebar task operations
  const handleSidebarTaskCreate = async (taskData: any) => {
    const newTask = await createTask(taskData);
    if (newTask) {
      // Task created successfully - UI already updated by hook
      console.log('Task created:', newTask);
    }
  };

  const handleSidebarTaskUpdate = async (taskId: string, updates: any) => {
    const updatedTask = await updateTask(taskId, updates);
    if (updatedTask) {
      // Task updated successfully - UI already updated by hook
      console.log('Task updated:', updatedTask);
    }
  };

  const handleSidebarTaskDelete = async (taskId: string) => {
    const success = await deleteTask(taskId);
    if (success) {
      // Task deleted successfully - UI already updated by hook
      console.log('Task deleted successfully');
    }
  };

  // NEW: Handlers for event operations that components can use
  const handleEventCreate = async (eventData: any) => {
    const newEvent = await createEvent(eventData);
    if (newEvent) {
      console.log('Event created:', newEvent);
      handleEventChange(); // Trigger any additional updates needed
    }
  };

  const handleEventUpdate = async (eventId: string, updates: any) => {
    const updatedEvent = await updateEvent(eventId, updates);
    if (updatedEvent) {
      console.log('Event updated:', updatedEvent);
      handleEventChange(); // Trigger any additional updates needed
    }
  };

  const handleEventDelete = async (eventId: string) => {
    const success = await deleteEvent(eventId);
    if (success) {
      console.log('Event deleted successfully');
      handleEventChange(); // Trigger any additional updates needed
    }
  };

  return (
    <ThemeProvider>
      <Navigation rightSidebarOpen={rightSidebarOpen}>
        <div className="h-screen overflow-hidden">
          {/* Pass the centralized state and operations to Sidebar */}
          <Sidebar 
            tasks={tasks}
            isLoading={isLoading}
            onTaskCreate={handleSidebarTaskCreate}
            onTaskUpdate={handleSidebarTaskUpdate}
            onTaskDelete={handleSidebarTaskDelete}
            onEventChange={handleEventChange}
          />
          
          {/* Main content area */}
          <div className="ewfsf">
            <div className="form-content">
              {/* Display error from the centralized state */}
              {error && <p style={{ color: 'red' }}>{error}</p>}
              {/* Display loading state from the centralized state */}
            </div>
          </div>

          {/* Calendar component with dynamic margin */}
          <div 
            className="calendar-container"
            style={{
              marginRight: rightSidebarOpen ? '349px' : '30px',
              marginLeft: '10px',
            }}
          >
            <Calendar 
              events={events} // Pass events from centralized state
              refreshTrigger={refreshEvents}
              onEventChange={handleEventChange} 
              onViewChange={handleViewChange}
              onEventCreate={handleEventCreate} // NEW: Pass event operations
              onEventUpdate={handleEventUpdate} // NEW: Pass event operations
              onEventDelete={handleEventDelete} // NEW: Pass event operations
              onSidebarTaskCreate={handleSidebarTaskCreate}
              onSidebarTaskUpdate={handleSidebarTaskUpdate}
              onSidebarTaskDelete={handleSidebarTaskDelete}
            />
          </div>

          {/* AI Assistant Sidebar */}
          <RightSidebar 
            isOpen={rightSidebarOpen}
            onToggle={handleRightSidebarToggle}
            forceClose={false}
            navbarVisible={navbarVisible}
            events={events} // Pass events from centralized state
            tasks={tasks} // Pass tasks from centralized state
            onEventCreate={handleEventCreate} // Pass event operations to AI sidebar
            onEventUpdate={handleEventUpdate}
            onEventDelete={handleEventDelete}
            onTaskCreate={handleSidebarTaskCreate} // Pass task operations to AI sidebar
            onTaskUpdate={handleSidebarTaskUpdate}
            onTaskDelete={handleSidebarTaskDelete}
            onEventChange={handleEventChange} // Keep existing prop for compatibility
          />

          {/* Responsive styles moved to styled-jsx */}
          <style jsx>{`
            @media (max-width: 768px) {
              .calendar-container {
                margin-right: 0 !important;
              }
            }
          `}</style>

          {/* Global styles to prevent scrolling */}
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