// hooks/useAppState.ts - FIXED VERSION WITH PROPER EVENT ID HANDLING
import { useState, useCallback, useRef, useEffect } from 'react';
import { RRule } from 'rrule';
import { authAPI } from '../../lib/auth';

export interface EventDetails {
  id?: string;
  eventId?: string;
  event_name: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string;
  virtual: boolean;
  urgency: 'low' | 'medium' | 'high';
  notes: string;
  event_type: string;
  category: string;
  subcategories: string;
  recurrence_pattern: string;
  color: string;
  all_day?: boolean;
  day_marking_title?: string;
  // Additional fields for expanded events
  frontendId?: string;
  occurrenceDate?: string;
  originalEventId?: string; // Store the original backend ID separately
}

export interface TaskData {
  id?: string;
  event: string;
  date?: string | null;
  created_at?: string;
}

interface AppState {
  events: EventDetails[];
  tasks: TaskData[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
}

// Simple global state - no over-engineering
let globalState: AppState = {
  events: [],
  tasks: [],
  isLoading: false,
  error: null,
  initialized: false
};

let stateSubscribers = new Set<(state: AppState) => void>();

const updateState = (updates: Partial<AppState>) => {
  globalState = { ...globalState, ...updates };
  stateSubscribers.forEach(callback => callback(globalState));
};

export const useAppState = () => {
  const [state, setState] = useState(globalState);
  const isMountedRef = useRef(true);
  const hasTriedInitRef = useRef(false);

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = (newState: AppState) => {
      if (isMountedRef.current) {
        setState(newState);
      }
    };
    
    stateSubscribers.add(unsubscribe);
    
    return () => {
      stateSubscribers.delete(unsubscribe);
      isMountedRef.current = false;
    };
  }, []);

  const setError = useCallback((error: string | null) => {
    console.error('App Error:', error);
    updateState({ error, isLoading: false });
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    console.log('Loading state:', isLoading);
    updateState({ isLoading });
  }, []);

  // FIXED recurring events expansion with proper ID management
  const expandRecurringEvents = useCallback((events: EventDetails[]): EventDetails[] => {
    const expandedEvents: EventDetails[] = [];
    const today = new Date();
    const futureLimit = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

    events.forEach(event => {
      if (event.recurrence_pattern && event.recurrence_pattern.trim() !== '') {
        try {
          const baseDate = new Date(event.date);
          const ruleString = event.recurrence_pattern.includes('DTSTART') 
            ? event.recurrence_pattern 
            : `DTSTART=${baseDate.toISOString().split('T')[0].replace(/-/g, '')}\n${event.recurrence_pattern}`;
          
          const rule = RRule.fromString(ruleString);
          const occurrences = rule.between(
            new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
            futureLimit,
            true
          );

          occurrences.forEach((occurrence) => {
            const dateString = occurrence.toISOString().split('T')[0];
            expandedEvents.push({
              ...event,
              // Keep the original backend ID clean for API calls
              id: event.id,
              originalEventId: event.id, // Store original for reference
              // Create unique frontend ID for React/FullCalendar
              frontendId: `${event.id}_${dateString}`,
              // For the calendar component, use frontendId as the main identifier
              eventId: `${event.id}_${dateString}`,
              date: dateString,
              occurrenceDate: dateString
            });
          });
        } catch (error) {
          console.error('Error parsing recurrence:', error);
          expandedEvents.push({
            ...event,
            originalEventId: event.id,
            frontendId: `${event.id}_${event.date}`,
            eventId: `${event.id}_${event.date}`
          });
        }
      } else {
        // For non-recurring events, keep it simple
        expandedEvents.push({
          ...event,
          originalEventId: event.id,
          frontendId: event.id, // Use original ID for non-recurring
          eventId: event.id // Use original ID for non-recurring
        });
      }
    });

    return expandedEvents;
  }, []);

  // Fetch events - simplified
  const fetchEvents = useCallback(async (): Promise<EventDetails[]> => {
    if (!authAPI.isAuthenticated()) {
      console.log('Not authenticated - skipping event fetch');
      return [];
    }

    try {
      console.log('Fetching events...');
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/`
      );
      console.log('Events endpoint works:', response.ok);
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }

      const events: EventDetails[] = await response.json();
      console.log(`Fetched ${events.length} raw events from backend`);
      
      const expandedEvents = expandRecurringEvents(events);
      console.log(`Expanded to ${expandedEvents.length} event instances`);
      
      return expandedEvents;
    } catch (error) {
      console.error('Event fetch error:', error);
      throw error;
    }
  }, [expandRecurringEvents]);

  // Fetch tasks - simplified
  const fetchTasks = useCallback(async (): Promise<TaskData[]> => {
    if (!authAPI.isAuthenticated()) {
      console.log('Not authenticated - skipping task fetch');
      return [];
    }

    try {
      console.log('Fetching tasks...');
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tasks/`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status}`);
      }

      const tasks: TaskData[] = await response.json();
      console.log(`Fetched ${tasks.length} tasks`);
      
      return tasks;
    } catch (error) {
      console.error('Task fetch error:', error);
      throw error;
    }
  }, []);

  // Helper function to extract clean backend ID
  const getBackendId = useCallback((eventId: string | number | undefined | null): string => {
    // Convert to string and handle null/undefined
    const idStr = String(eventId || '');
    
    if (!idStr) {
      console.error('getBackendId: No eventId provided');
      return '';
    }
    
    console.log('getBackendId: Processing eventId:', idStr);
    
    // If it has originalEventId in the expanded event, use that
    const event = globalState.events.find(e => 
      e.eventId === idStr || 
      e.frontendId === idStr || 
      e.id === idStr
    );
    
    if (event?.originalEventId) {
      console.log('getBackendId: Found originalEventId:', event.originalEventId);
      return event.originalEventId;
    }
    
    // Fallback: extract from frontendId if it has underscore
    if (idStr.includes('_')) {
      const backendId = idStr.split('_')[0];
      console.log('getBackendId: Extracted from composite ID:', backendId);
      return backendId;
    }
    
    console.log('getBackendId: Using ID as-is:', idStr);
    return idStr;
  }, []);

  // Create event
  const createEvent = useCallback(async (eventData: Omit<EventDetails, 'id' | 'eventId'>): Promise<EventDetails | null> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return null;
    }

    try {
      setLoading(true);
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/`, 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create event: ${response.status}`);
      }

      const newEvent: EventDetails = await response.json();
      
      // Refresh events after creating
      const updatedEvents = await fetchEvents();
      updateState({ events: updatedEvents, error: null, isLoading: false });
      
      return newEvent;
    } catch (error) {
      console.error('Create event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create event');
      return null;
    }
  }, [fetchEvents, setError, setLoading]);

  // Update event - FIXED to use proper backend ID extraction
  const updateEvent = useCallback(async (eventId: string | number | undefined | null, eventData: Partial<EventDetails>): Promise<EventDetails | null> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return null;
    }

    try {
      setLoading(true);
      
      // Use helper function to get clean backend ID
      const backendId = getBackendId(eventId);
      
      if (!backendId) {
        throw new Error('Invalid event ID provided');
      }
      
      console.log(`Updating event: ${eventId} -> backend ID: ${backendId}`);
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${backendId}/`, 
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update event: ${response.status}`);
      }

      const updatedEvent: EventDetails = await response.json();
      
      // Refresh events after updating
      const updatedEvents = await fetchEvents();
      updateState({ events: updatedEvents, error: null, isLoading: false });
      
      return updatedEvent;
    } catch (error) {
      console.error('Update event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to update event');
      return null;
    }
  }, [fetchEvents, setError, setLoading, getBackendId]);

  // Delete event - FIXED to use proper backend ID extraction
  const deleteEvent = useCallback(async (eventId: string | number | undefined | null): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    try {
      setLoading(true);
      
      // Use helper function to get clean backend ID
      const backendId = getBackendId(eventId);
      
      if (!backendId) {
        throw new Error('Invalid event ID provided');
      }
      
      console.log(`Deleting event: ${eventId} -> backend ID: ${backendId}`);
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${backendId}/`, 
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete event: ${response.status}`);
      }

      // Refresh events after deleting
      const updatedEvents = await fetchEvents();
      updateState({ events: updatedEvents, error: null, isLoading: false });
      
      return true;
    } catch (error) {
      console.error('Delete event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete event');
      return false;
    }
  }, [fetchEvents, setError, setLoading, getBackendId]);

  // Create task
  const createTask = useCallback(async (taskData: Omit<TaskData, 'id'>): Promise<TaskData | null> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return null;
    }

    try {
      setLoading(true);
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tasks/`, 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create task: ${response.status} - ${errorText}`);
      }

      const newTask: TaskData = await response.json();
      
      // Add to existing tasks
      updateState({ 
        tasks: [...globalState.tasks, newTask], 
        error: null, 
        isLoading: false 
      });
      
      return newTask;
    } catch (error) {
      console.error('Create task error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create task');
      return null;
    }
  }, [setError, setLoading]);

  // Delete task
  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    try {
      setLoading(true);
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tasks/${taskId}/`, 
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete task: ${response.status}`);
      }

      // Remove from tasks
      updateState({ 
        tasks: globalState.tasks.filter(task => task.id !== taskId),
        error: null,
        isLoading: false 
      });
      
      return true;
    } catch (error) {
      console.error('Delete task error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete task');
      return false;
    }
  }, [setError, setLoading]);

  // SIMPLE initialization - this is the key fix
  const initializeData = useCallback(async (forceRefresh = false) => {
    console.log('=== INITIALIZE DATA START ===');
    console.log('Auth status:', authAPI.isAuthenticated());
    console.log('Already initialized:', globalState.initialized);
    console.log('Force refresh:', forceRefresh);
    
    // Don't initialize if not authenticated
    if (!authAPI.isAuthenticated()) {
      console.log('Not authenticated, clearing state');
      updateState({ 
        events: [], 
        tasks: [], 
        error: null, 
        isLoading: false, 
        initialized: false 
      });
      return;
    }

    // Don't re-initialize unless forced
    if (globalState.initialized && !forceRefresh) {
      console.log('Already initialized, skipping');
      return;
    }

    // Prevent multiple simultaneous calls
    if (globalState.isLoading) {
      console.log('Already loading, skipping');
      return;
    }

    try {
      setLoading(true);
      console.log('Starting data fetch...');
      
      // Fetch both in parallel but handle failures gracefully
      const [events, tasks] = await Promise.allSettled([
        fetchEvents(),
        fetchTasks()
      ]);

      const eventsData = events.status === 'fulfilled' ? events.value : [];
      const tasksData = tasks.status === 'fulfilled' ? tasks.value : [];

      if (events.status === 'rejected') {
        console.error('Events fetch failed:', events.reason);
      }
      if (tasks.status === 'rejected') {
        console.error('Tasks fetch failed:', tasks.reason);
      }

      console.log('Data loaded:', { events: eventsData.length, tasks: tasksData.length });

      updateState({
        events: eventsData,
        tasks: tasksData,
        error: null,
        isLoading: false,
        initialized: true
      });

      console.log('=== INITIALIZE DATA SUCCESS ===');
      
    } catch (error) {
      console.error('=== INITIALIZE DATA FAILED ===', error);
      updateState({
        error: error instanceof Error ? error.message : 'Failed to load data',
        isLoading: false,
        initialized: true // Still mark as initialized to prevent infinite retries
      });
    }
  }, [fetchEvents, fetchTasks, setLoading]);

  // Simple initialization effect - only run once when auth is ready
  useEffect(() => {
    // Small delay to ensure auth state is settled
    const timeoutId = setTimeout(() => {
      if (!hasTriedInitRef.current) {
        hasTriedInitRef.current = true;
        console.log('Initial auth check and data load...');
        initializeData();
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []); // Only run once

  // Reset on auth changes
  useEffect(() => {
    const checkAuthInterval = setInterval(() => {
      const isAuth = authAPI.isAuthenticated();
      
      if (!isAuth && globalState.initialized) {
        console.log('Auth lost, resetting state');
        updateState({ 
          events: [], 
          tasks: [], 
          error: null, 
          isLoading: false, 
          initialized: false 
        });
        hasTriedInitRef.current = false;
      } else if (isAuth && !globalState.initialized && !globalState.isLoading) {
        console.log('Auth gained, initializing...');
        initializeData();
      }
    }, 1000);

    return () => clearInterval(checkAuthInterval);
  }, [initializeData]);

  return {
    // State
    events: state.events,
    tasks: state.tasks,
    isLoading: state.isLoading,
    error: state.error,
    initialized: state.initialized,

    // Operations
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    fetchTasks,
    createTask,
    deleteTask,
    initializeData,
    setError,
    setLoading
  };
};