// hooks/useAppState.ts - Fixed version with remount protection
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

// Utility function to create a promise with timeout
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation "${operation}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};

// Core data fetching with timeout protection
const fetchEventsSimple = async (): Promise<EventDetails[]> => {
  if (!authAPI.isAuthenticated()) {
    throw new Error('Not authenticated');
  }

  const fetchPromise = authAPI.authenticatedFetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/events/`
  );

  const response = await withTimeout(fetchPromise, 30000, 'fetch events');
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Events API error: ${response.status} - ${errorText}`);
  }

  const events: EventDetails[] = await response.json();
  const expandedEvents = expandRecurringEvents(events);
  
  return expandedEvents;
};

const fetchTasksSimple = async (): Promise<TaskData[]> => {
  if (!authAPI.isAuthenticated()) {
    throw new Error('Not authenticated');
  }

  const fetchPromise = authAPI.authenticatedFetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/tasks/`
  );

  const response = await withTimeout(fetchPromise, 30000, 'fetch tasks');
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tasks API error: ${response.status} - ${errorText}`);
  }

  const tasks = await response.json();
  return tasks;
};

// Safe recurring events expansion with timeout protection
const expandRecurringEvents = (events: EventDetails[]): EventDetails[] => {
  const expandedEvents: EventDetails[] = [];
  const today = new Date();
  const futureLimit = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));
  const pastLimit = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

  events.forEach((event) => {
    if (event.recurrence_pattern?.trim()) {
      try {
        const baseDate = new Date(event.date);
        
        const ruleString = event.recurrence_pattern.includes('DTSTART') 
          ? event.recurrence_pattern 
          : `DTSTART=${baseDate.toISOString().split('T')[0].replace(/-/g, '')}\n${event.recurrence_pattern}`;
        
        const startTime = Date.now();
        const rule = RRule.fromString(ruleString);
        
        // Generate occurrences with a reasonable limit
        const occurrences = rule.between(pastLimit, futureLimit, true).slice(0, 50);
        
        const processingTime = Date.now() - startTime;
        
        // If processing took too long, log a warning
        if (processingTime > 5000) {
          console.warn(`Slow recurring event processing for ${event.event_name}: ${processingTime}ms`);
        }

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
        
        // Fallback: add the original event without expansion
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

// Single global initialization with comprehensive error handling
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

      // Wrap the entire fetch operation in a timeout
      const fetchPromise = Promise.allSettled([
        withTimeout(fetchEventsSimple(), 45000, 'fetch and expand events'),
        withTimeout(fetchTasksSimple(), 30000, 'fetch tasks')
      ]);

      const results = await withTimeout(fetchPromise, 60000, 'complete data fetch');

      const [eventsResult, tasksResult] = results;

      const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
      const tasks = tasksResult.status === 'fulfilled' ? tasksResult.value : [];

      // Log any failures
      if (eventsResult.status === 'rejected') {
        console.error('Events fetch failed:', eventsResult.reason);
      }
      if (tasksResult.status === 'rejected') {
        console.error('Tasks fetch failed:', tasksResult.reason);
      }
      
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
      console.error('Initialization failed:', error);
      
      // CRITICAL: Always ensure loading states are cleared
      updateState({
        error: error instanceof Error ? error.message : 'Failed to load data',
        isInitializing: false,
        isRefreshing: false,
        initialized: true
      });
      hasGloballyInitialized = true;
    } finally {
      // CRITICAL: Always clear initialization flags
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

export const useAppState = () => {
  const [state, setState] = useState(globalState);
  // Use unique instance ID instead of global flag
  const [instanceId] = useState(() => Math.random().toString(36));
  const isMountedRef = useRef(true);
  const hasTriggeredInitRef = useRef(false);

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

  // Instance-based initialization trigger that handles remounts
  useEffect(() => {
    // Reset mount status
    isMountedRef.current = true;
    
    const shouldTriggerInit = authAPI.isAuthenticated() && 
                             !hasGloballyInitialized && 
                             !isCurrentlyInitializing && 
                             !hasTriggeredInitRef.current;

    if (shouldTriggerInit) {
      hasTriggeredInitRef.current = true;
      
      // Use immediate execution instead of timeout to avoid race conditions
      if (isMountedRef.current && authAPI.isAuthenticated()) {
        performGlobalInitialization().catch(console.error);
      }
    }
  }, [instanceId]); // Depend on instanceId so it re-runs on remount

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