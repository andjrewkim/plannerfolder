// hooks/useAppState.ts - FIXED VERSION - NO MORE MULTIPLE INITIALIZATIONS
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

let globalState: AppState = {
  events: [],
  tasks: [],
  isInitializing: false,
  isRefreshing: false,
  error: null,
  initialized: false
};

let stateSubscribers = new Set<(state: AppState) => void>();

// GLOBAL FLAGS TO PREVENT MULTIPLE CALLS
let globalInitPromise: Promise<void> | null = null;
let hasTriedGlobalInit = false;
let authCheckInterval: NodeJS.Timeout | null = null;

const updateState = (updates: Partial<AppState>) => {
  globalState = { ...globalState, ...updates };
  stateSubscribers.forEach(callback => callback(globalState));
};

// GLOBAL INITIALIZATION - Only happens once across all hook instances
const globalInitializeData = async (forceRefresh = false): Promise<void> => {
  console.log('=== GLOBAL INITIALIZE DATA START ===');
  
  if (!authAPI.isAuthenticated()) {
    console.log('Not authenticated, clearing state');
    updateState({ 
      events: [], 
      tasks: [], 
      error: null, 
      isInitializing: false,
      isRefreshing: false,
      initialized: false 
    });
    return;
  }

  // Don't re-initialize unless forced
  if (globalState.initialized && !forceRefresh) {
    console.log('Already initialized, skipping');
    return;
  }

  // PREVENT MULTIPLE SIMULTANEOUS CALLS - this is critical
  if (globalState.isInitializing || globalState.isRefreshing) {
    //console.log('Already loading, skipping to prevent loop');
    return;
  }

  try {
    // Set appropriate loading state
    if (!globalState.initialized) {
      updateState({ isInitializing: true });
    } else if (forceRefresh) {
      updateState({ isRefreshing: true });
    }
    
    console.log('Starting data fetch...');
    
    const [eventsResult, tasksResult] = await Promise.allSettled([
      fetchEventsGlobal(),
      fetchTasksGlobal()
    ]);

    const eventsData = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
    const tasksData = tasksResult.status === 'fulfilled' ? tasksResult.value : [];

    if (eventsResult.status === 'rejected') {
      console.error('Events fetch failed:', eventsResult.reason);
    }
    if (tasksResult.status === 'rejected') {
      console.error('Tasks fetch failed:', tasksResult.reason);
    }

    console.log('Data loaded:', { events: eventsData.length, tasks: tasksData.length });

    updateState({
      events: eventsData,
      tasks: tasksData,
      error: null,
      isInitializing: false,
      isRefreshing: false,
      initialized: true
    });

    console.log('=== GLOBAL INITIALIZE DATA SUCCESS ===');
    
  } catch (error) {
    console.error('=== GLOBAL INITIALIZE DATA FAILED ===', error);
    updateState({
      error: error instanceof Error ? error.message : 'Failed to load data',
      isInitializing: false,
      isRefreshing: false,
      initialized: true
    });
  }
};

// GLOBAL EVENT FETCHING
const fetchEventsGlobal = async (): Promise<EventDetails[]> => {
  if (!authAPI.isAuthenticated()) {
    console.log('Not authenticated - skipping event fetch');
    return [];
  }

  try {
    console.log('Fetching events...');
    const response = await authAPI.authenticatedFetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/events/`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    const events: EventDetails[] = await response.json();
    //console.log(`Fetched ${events.length} raw events from backend`);
    
    const expandedEvents = expandRecurringEventsGlobal(events);
    //console.log(`Expanded to ${expandedEvents.length} event instances`);
    
    return expandedEvents;
  } catch (error) {
    console.error('Event fetch error:', error);
    throw error;
  }
};

// GLOBAL TASK FETCHING
const fetchTasksGlobal = async (): Promise<TaskData[]> => {
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
};

// GLOBAL RECURRING EVENTS EXPANSION
const expandRecurringEventsGlobal = (events: EventDetails[]): EventDetails[] => {
  const expandedEvents: EventDetails[] = [];
  const today = new Date();
  
  // MUCH MORE LIMITED DATE RANGE - only 3 months out
  const futureLimit = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
  const pastLimit = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  
  // MAX OCCURRENCES PER EVENT - prevents runaway expansion
  const MAX_OCCURRENCES_PER_EVENT = 50;

  events.forEach(event => {
    if (event.recurrence_pattern && event.recurrence_pattern.trim() !== '') {
      try {
        //console.log(`Processing recurring event: ${event.event_name}`);
        
        const baseDate = new Date(event.date);
        const ruleString = event.recurrence_pattern.includes('DTSTART') 
          ? event.recurrence_pattern 
          : `DTSTART=${baseDate.toISOString().split('T')[0].replace(/-/g, '')}\n${event.recurrence_pattern}`;
        
        const rule = RRule.fromString(ruleString);
        
        // Get occurrences with STRICT LIMITS
        let occurrences = rule.between(pastLimit, futureLimit, true);
        
        // HARD LIMIT - never allow more than MAX_OCCURRENCES_PER_EVENT
        if (occurrences.length > MAX_OCCURRENCES_PER_EVENT) {
          //console.warn(`Event ${event.event_name} has ${occurrences.length} occurrences, limiting to ${MAX_OCCURRENCES_PER_EVENT}`);
          occurrences = occurrences.slice(0, MAX_OCCURRENCES_PER_EVENT);
        }
        
        //console.log(`Creating ${occurrences.length} occurrences for ${event.event_name}`);

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
        console.error('Error parsing recurrence for event:', event.event_name, error);
        // Fallback to single event
        expandedEvents.push({
          ...event,
          originalEventId: event.id,
          frontendId: `${event.id}_${event.date}`,
          eventId: `${event.id}_${event.date}`
        });
      }
    } else {
      // Non-recurring event
      expandedEvents.push({
        ...event,
        originalEventId: event.id,
        frontendId: event.id,
        eventId: event.id
      });
    }
  });

  console.log(`Total expanded events: ${expandedEvents.length}`);
  
  // EMERGENCY BRAKE - if we somehow still have too many events, truncate
  if (expandedEvents.length > 500) {
    console.error(`TOO MANY EVENTS: ${expandedEvents.length}, truncating to 500`);
    return expandedEvents.slice(0, 500);
  }

  return expandedEvents;
};

// START GLOBAL INITIALIZATION - Only call this once when the module loads
const startGlobalInitialization = () => {
  if (hasTriedGlobalInit) return;
  hasTriedGlobalInit = true;
  
  // Single timeout to start initialization
  setTimeout(() => {
    console.log('GLOBAL: Initial auth check and data load...');
    globalInitPromise = globalInitializeData();
  }, 100);
  
  // Single auth check interval
  if (!authCheckInterval) {
    authCheckInterval = setInterval(() => {
      const isAuth = authAPI.isAuthenticated();
      
      if (!isAuth && globalState.initialized) {
        console.log('GLOBAL: Auth lost, resetting state');
        updateState({ 
          events: [], 
          tasks: [], 
          error: null, 
          isInitializing: false,
          isRefreshing: false,
          initialized: false 
        });
        hasTriedGlobalInit = false;
      } else if (isAuth && !globalState.initialized && !globalState.isInitializing && !globalState.isRefreshing) {
        console.log('GLOBAL: Auth gained, initializing...');
        globalInitPromise = globalInitializeData();
      }
    }, 2000);
  }
};

export const useAppState = () => {
  const [state, setState] = useState(globalState);
  const isMountedRef = useRef(true);

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

  // Start global initialization ONLY ONCE when first hook instance mounts
  useEffect(() => {
    startGlobalInitialization();
  }, []); // Empty dependency array - only run once per hook instance

  const setError = useCallback((error: string | null) => {
    console.error('App Error:', error);
    updateState({ error });
  }, []);

  // Helper function to extract clean backend ID
  const getBackendId = useCallback((eventId: string | number | undefined | null): string => {
    const idStr = String(eventId || '');
    
    if (!idStr) {
      console.error('getBackendId: No eventId provided');
      return '';
    }
    
    const event = globalState.events.find(e => 
      e.eventId === idStr || 
      e.frontendId === idStr || 
      e.id === idStr
    );
    
    if (event?.originalEventId) {
      return event.originalEventId;
    }
    
    if (idStr.includes('_')) {
      const backendId = idStr.split('_')[0];
      return backendId;
    }
    
    return idStr;
  }, []);

  // OPTIMISTIC CREATE EVENT - No loading state, immediate UI update
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
        throw new Error(`Failed to create event: ${response.status}`);
      }

      const newEvent: EventDetails = await response.json();
      
      // Background refresh - NO LOADING STATE, SINGLE CALL
      setTimeout(async () => {
        try {
          const updatedEvents = await fetchEventsGlobal();
          updateState({ events: updatedEvents, error: null });
        } catch (error) {
          console.error('Background refresh failed:', error);
        }
      }, 100);
      
      return newEvent;
    } catch (error) {
      console.error('Create event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create event');
      return null;
    }
  }, [setError]);

  // OPTIMISTIC UPDATE EVENT - No loading state
  const updateEvent = useCallback(async (eventId: string | number | undefined | null, eventData: Partial<EventDetails>): Promise<EventDetails | null> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return null;
    }

    try {
      const backendId = getBackendId(eventId);
      
      if (!backendId) {
        throw new Error('Invalid event ID provided');
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
        throw new Error(`Failed to update event: ${response.status}`);
      }

      const updatedEvent: EventDetails = await response.json();
      
      // Background refresh - DELAYED TO PREVENT LOOPS
      setTimeout(async () => {
        try {
          const updatedEvents = await fetchEventsGlobal();
          updateState({ events: updatedEvents, error: null });
        } catch (error) {
          console.error('Background refresh failed:', error);
        }
      }, 100);
      
      return updatedEvent;
    } catch (error) {
      console.error('Update event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to update event');
      return null;
    }
  }, [setError, getBackendId]);

  // OPTIMISTIC DELETE EVENT - No loading state
  const deleteEvent = useCallback(async (eventId: string | number | undefined | null): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    try {
      const backendId = getBackendId(eventId);
      
      if (!backendId) {
        throw new Error('Invalid event ID provided');
      }
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${backendId}/`, 
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete event: ${response.status}`);
      }

      // Background refresh - DELAYED TO PREVENT LOOPS
      setTimeout(async () => {
        try {
          const updatedEvents = await fetchEventsGlobal();
          updateState({ events: updatedEvents, error: null });
        } catch (error) {
          console.error('Background refresh failed:', error);
        }
      }, 100);
      
      return true;
    } catch (error) {
      console.error('Delete event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete event');
      return false;
    }
  }, [setError, getBackendId]);

  // OPTIMISTIC CREATE TASK - Immediate UI update, no loading state
  const createTask = useCallback(async (taskData: Omit<TaskData, 'id'>): Promise<TaskData | null> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return null;
    }

    // Create temporary task for immediate UI feedback
    const tempTask: TaskData = {
      id: `temp-${Date.now()}`,
      ...taskData
    };

    // Immediately add to UI
    updateState({ 
      tasks: [...globalState.tasks, tempTask], 
      error: null
    });

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
        // Remove temp task on error
        updateState({ 
          tasks: globalState.tasks.filter(task => task.id !== tempTask.id)
        });
        const errorText = await response.text();
        throw new Error(`Failed to create task: ${response.status} - ${errorText}`);
      }

      const newTask: TaskData = await response.json();
      
      // Replace temp task with real task
      updateState({ 
        tasks: globalState.tasks.map(task => 
          task.id === tempTask.id ? newTask : task
        ), 
        error: null
      });
      
      return newTask;
    } catch (error) {
      console.error('Create task error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create task');
      return null;
    }
  }, [setError]);

  // OPTIMISTIC DELETE TASK - Immediate UI update, no loading state
  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    // Store original task for potential rollback
    const taskToDelete = globalState.tasks.find(task => task.id === taskId);
    
    // Immediately remove from UI
    updateState({ 
      tasks: globalState.tasks.filter(task => task.id !== taskId),
      error: null
    });

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tasks/${taskId}/`, 
        { method: 'DELETE' }
      );

      if (!response.ok) {
        // Rollback on error
        if (taskToDelete) {
          updateState({ 
            tasks: [...globalState.tasks, taskToDelete]
          });
        }
        throw new Error(`Failed to delete task: ${response.status}`);
      }
      
      return true;
    } catch (error) {
      console.error('Delete task error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete task');
      return false;
    }
  }, [setError]);

  // Manual refresh function - for user-triggered refreshes
  const refreshData = useCallback(async () => {
    await globalInitializeData(true);
  }, []);

  return {
    // State
    events: state.events,
    tasks: state.tasks,
    isLoading: state.isInitializing,
    isRefreshing: state.isRefreshing,
    error: state.error,
    initialized: state.initialized,

    // Operations
    fetchEvents: fetchEventsGlobal, // Use global version
    createEvent,
    updateEvent,
    deleteEvent,
    fetchTasks: fetchTasksGlobal, // Use global version
    createTask,
    deleteTask,
    initializeData: refreshData, // Rename to refreshData to be clearer
    setError
  };
};