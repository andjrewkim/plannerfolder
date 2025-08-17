// hooks/useAppState.ts - CLEAN VERSION
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
  frontendId?: string;
  occurrenceDate?: string;
  originalEventId?: string;
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
  isInitializing: boolean;
  isRefreshing: boolean;
  error: string | null;
  initialized: boolean;
}

// Global state management
let globalState: AppState = {
  events: [],
  tasks: [],
  isInitializing: false,
  isRefreshing: false,
  error: null,
  initialized: false
};

let stateSubscribers = new Set<(state: AppState) => void>();

// Global initialization flags
let hasGloballyInitialized = false;
let isCurrentlyInitializing = false;
let initializationPromise: Promise<void> | null = null;

// State updates
const updateState = (updates: Partial<AppState>) => {
  globalState = { ...globalState, ...updates };
  stateSubscribers.forEach(callback => callback(globalState));
};

// Core data fetching
const fetchEventsSimple = async (): Promise<EventDetails[]> => {
  if (!authAPI.isAuthenticated()) {
    throw new Error('Not authenticated');
  }

  const response = await authAPI.authenticatedFetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/events/`
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Events API error: ${response.status} - ${errorText}`);
  }

  const events: EventDetails[] = await response.json();
  return expandRecurringEvents(events);
};

const fetchTasksSimple = async (): Promise<TaskData[]> => {
  if (!authAPI.isAuthenticated()) {
    throw new Error('Not authenticated');
  }

  const response = await authAPI.authenticatedFetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/tasks/`
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tasks API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
};

// Recurring events expansion
const expandRecurringEvents = (events: EventDetails[]): EventDetails[] => {
  const expandedEvents: EventDetails[] = [];
  const today = new Date();
  const futureLimit = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));
  const pastLimit = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

  events.forEach(event => {
    if (event.recurrence_pattern?.trim()) {
      try {
        const baseDate = new Date(event.date);
        const ruleString = event.recurrence_pattern.includes('DTSTART') 
          ? event.recurrence_pattern 
          : `DTSTART=${baseDate.toISOString().split('T')[0].replace(/-/g, '')}\n${event.recurrence_pattern}`;
        
        const rule = RRule.fromString(ruleString);
        const occurrences = rule.between(pastLimit, futureLimit, true).slice(0, 50);

        occurrences.forEach((occurrence) => {
          const dateString = occurrence.toISOString().split('T')[0];
          expandedEvents.push({
            ...event,
            id: event.id,
            originalEventId: event.id,
            frontendId: `${event.id}_${dateString}`,
            eventId: `${event.id}_${dateString}`,
            date: dateString,
            occurrenceDate: dateString
          });
        });
        
      } catch (error) {
        console.error(`Error expanding recurring event ${event.event_name}:`, error);
        expandedEvents.push({
          ...event,
          originalEventId: event.id,
          frontendId: `${event.id}_${event.date}`,
          eventId: `${event.id}_${event.date}`
        });
      }
    } else {
      expandedEvents.push({
        ...event,
        originalEventId: event.id,
        frontendId: event.id,
        eventId: event.id
      });
    }
  });

  return expandedEvents;
};

// Single global initialization
const performGlobalInitialization = async (forceRefresh = false): Promise<void> => {
  // Check authentication first
  if (!authAPI.isAuthenticated()) {
    updateState({
      events: [],
      tasks: [],
      error: null,
      isInitializing: false,
      isRefreshing: false,
      initialized: false
    });
    hasGloballyInitialized = false;
    isCurrentlyInitializing = false;
    initializationPromise = null;
    return;
  }

  // If already initialized and not forcing refresh, return
  if (hasGloballyInitialized && !forceRefresh) {
    return;
  }

  // If already initializing, wait for existing promise
  if (isCurrentlyInitializing && initializationPromise && !forceRefresh) {
    return initializationPromise;
  }

  // Start initialization
  isCurrentlyInitializing = true;

  initializationPromise = (async () => {
    try {
      updateState({ 
        isInitializing: !hasGloballyInitialized, 
        isRefreshing: hasGloballyInitialized,
        error: null 
      });

      const [eventsResult, tasksResult] = await Promise.allSettled([
        fetchEventsSimple(),
        fetchTasksSimple()
      ]);

      const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
      const tasks = tasksResult.status === 'fulfilled' ? tasksResult.value : [];

      updateState({
        events,
        tasks,
        error: null,
        isInitializing: false,
        isRefreshing: false,
        initialized: true
      });

      hasGloballyInitialized = true;

    } catch (error) {
      console.error('Failed to initialize app state:', error);
      updateState({
        error: error instanceof Error ? error.message : 'Failed to load data',
        isInitializing: false,
        isRefreshing: false,
        initialized: true
      });
      hasGloballyInitialized = true;
    } finally {
      isCurrentlyInitializing = false;
      initializationPromise = null;
    }
  })();

  return initializationPromise;
};

// Reset function for logout
export const resetGlobalAppState = () => {
  globalState = {
    events: [],
    tasks: [],
    isInitializing: false,
    isRefreshing: false,
    error: null,
    initialized: false
  };
  hasGloballyInitialized = false;
  isCurrentlyInitializing = false;
  initializationPromise = null;
  stateSubscribers.forEach(callback => callback(globalState));
};

// Reload after login
export const reloadAfterLogin = async () => {
  hasGloballyInitialized = false;
  isCurrentlyInitializing = false;
  initializationPromise = null;
  await performGlobalInitialization(true);
};

let hasTriggeredGlobalInit = false;

export const useAppState = () => {
  const [state, setState] = useState(globalState);
  const isMountedRef = useRef(true);

  // Subscribe to state changes
  useEffect(() => {
    const handleStateChange = (newState: AppState) => {
      if (isMountedRef.current) {
        setState(newState);
      }
    };
    
    stateSubscribers.add(handleStateChange);
    
    return () => {
      stateSubscribers.delete(handleStateChange);
      isMountedRef.current = false;
    };
  }, []);

  // Single initialization trigger - only runs once across ALL components
  useEffect(() => {
    if (authAPI.isAuthenticated() && !hasGloballyInitialized && !isCurrentlyInitializing && !hasTriggeredGlobalInit) {
      hasTriggeredGlobalInit = true;
      
      const timer = setTimeout(() => {
        if (isMountedRef.current && authAPI.isAuthenticated()) {
          performGlobalInitialization();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const setError = useCallback((error: string | null) => {
    updateState({ error });
  }, []);

  const getBackendId = useCallback((eventId: string | number | undefined | null): string => {
    if (!eventId) return '';
    const idStr = String(eventId);
    const event = globalState.events.find(e => 
      e.eventId === idStr || e.frontendId === idStr || e.id === idStr
    );
    return event?.originalEventId || idStr.split('_')[0] || idStr;
  }, []);

  const createEvent = useCallback(async (eventData: Omit<EventDetails, 'id' | 'eventId'>): Promise<EventDetails | null> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return null;
    }

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/`, 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create event: ${response.status} - ${errorText}`);
      }

      const newEvent: EventDetails = await response.json();
      setTimeout(() => performGlobalInitialization(true), 100);
      return newEvent;
    } catch (error) {
      console.error('Create event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create event');
      return null;
    }
  }, [setError]);

  const updateEvent = useCallback(async (eventId: string | number | undefined | null, eventData: Partial<EventDetails>): Promise<EventDetails | null> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return null;
    }

    try {
      const backendId = getBackendId(eventId);
      if (!backendId) {
        throw new Error('Invalid event ID');
      }
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${backendId}/`, 
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update event: ${response.status} - ${errorText}`);
      }

      const updatedEvent: EventDetails = await response.json();
      setTimeout(() => performGlobalInitialization(true), 100);
      return updatedEvent;
    } catch (error) {
      console.error('Update event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to update event');
      return null;
    }
  }, [setError, getBackendId]);

  const deleteEvent = useCallback(async (eventId: string | number | undefined | null): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    try {
      const backendId = getBackendId(eventId);
      if (!backendId) {
        throw new Error('Invalid event ID');
      }
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${backendId}/`, 
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete event: ${response.status} - ${errorText}`);
      }

      setTimeout(() => performGlobalInitialization(true), 100);
      return true;
    } catch (error) {
      console.error('Delete event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete event');
      return false;
    }
  }, [setError, getBackendId]);

  const createTask = useCallback(async (taskData: Omit<TaskData, 'id'>): Promise<TaskData | null> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return null;
    }

    try {
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
      
      updateState({ 
        tasks: [...globalState.tasks, newTask], 
        error: null 
      });
      
      return newTask;
    } catch (error) {
      console.error('Create task error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create task');
      return null;
    }
  }, [setError]);

  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tasks/${taskId}/`, 
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete task: ${response.status} - ${errorText}`);
      }
      
      updateState({ 
        tasks: globalState.tasks.filter(task => task.id !== taskId),
        error: null 
      });
      
      return true;
    } catch (error) {
      console.error('Delete task error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete task');
      return false;
    }
  }, [setError]);

  const refreshData = useCallback(async () => {
    if (authAPI.isAuthenticated()) {
      await performGlobalInitialization(true);
    }
  }, []);

  return {
    events: state.events,
    tasks: state.tasks,
    isLoading: state.isInitializing,
    isRefreshing: state.isRefreshing,
    error: state.error,
    initialized: state.initialized,

    fetchEvents: fetchEventsSimple,
    createEvent,
    updateEvent,
    deleteEvent,
    fetchTasks: fetchTasksSimple,
    createTask,
    deleteTask,
    initializeData: refreshData,
    reloadAfterLogin,
    setError
  };
};