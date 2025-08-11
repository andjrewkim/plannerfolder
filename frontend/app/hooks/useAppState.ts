// hooks/useAppState.ts - FIXED VERSION TO PREVENT EXCESSIVE LOGGING
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

// Global state with better initialization tracking
let globalState: AppState = {
  events: [],
  tasks: [],
  isInitializing: false,
  isRefreshing: false,
  error: null,
  initialized: false
};

let stateSubscribers = new Set<(state: AppState) => void>();

// Global flags to prevent duplicate operations
let initializationPromise: Promise<void> | null = null;
let hasInitialized = false;

const updateState = (updates: Partial<AppState>) => {
  globalState = { ...globalState, ...updates };
  stateSubscribers.forEach(callback => callback(globalState));
};

export const useAppState = () => {
  const [state, setState] = useState(globalState);
  const isMountedRef = useRef(true);
  const componentIdRef = useRef(`component-${Math.random().toString(36).substr(2, 9)}`);

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
    if (error) {
      console.error('App Error:', error);
    }
    updateState({ error });
  }, []);

  // Expand recurring events with reduced logging
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
              id: event.id,
              originalEventId: event.id,
              frontendId: `${event.id}_${dateString}`,
              eventId: `${event.id}_${dateString}`,
              date: dateString,
              occurrenceDate: dateString
            });
          });
        } catch (error) {
          console.error('Error parsing recurrence for event:', event.id, error);
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
  }, []);

  // Fetch events with minimal logging
  const fetchEvents = useCallback(async (): Promise<EventDetails[]> => {
    if (!authAPI.isAuthenticated()) {
      return [];
    }

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }

      const events: EventDetails[] = await response.json();
      const expandedEvents = expandRecurringEvents(events);
      
      // Only log if there's a significant change or on first load
      if (!globalState.initialized || Math.abs(expandedEvents.length - globalState.events.length) > 5) {
        console.log(`Fetched ${events.length} raw events, expanded to ${expandedEvents.length} instances`);
      }
      
      return expandedEvents;
    } catch (error) {
      console.error('Event fetch error:', error);
      throw error;
    }
  }, [expandRecurringEvents]);

  // Fetch tasks with minimal logging
  const fetchTasks = useCallback(async (): Promise<TaskData[]> => {
    if (!authAPI.isAuthenticated()) {
      return [];
    }

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tasks/`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status}`);
      }

      const tasks: TaskData[] = await response.json();
      
      // Only log if there's a change or on first load
      if (!globalState.initialized || tasks.length !== globalState.tasks.length) {
        console.log(`Fetched ${tasks.length} tasks`);
      }
      
      return tasks;
    } catch (error) {
      console.error('Task fetch error:', error);
      throw error;
    }
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

  // CRUD operations (unchanged, but with less logging)
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
      console.log('Event created:', newEvent.event_name);
      
      // Background refresh - no loading state
      const updatedEvents = await fetchEvents();
      updateState({ events: updatedEvents, error: null });
      
      return newEvent;
    } catch (error) {
      console.error('Create event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create event');
      return null;
    }
  }, [fetchEvents, setError]);

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
      console.log('Event updated:', updatedEvent.event_name);
      
      // Background refresh - no loading state
      const updatedEvents = await fetchEvents();
      updateState({ events: updatedEvents, error: null });
      
      return updatedEvent;
    } catch (error) {
      console.error('Update event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to update event');
      return null;
    }
  }, [fetchEvents, setError, getBackendId]);

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

      console.log('Event deleted:', backendId);
      
      // Background refresh - no loading state
      const updatedEvents = await fetchEvents();
      updateState({ events: updatedEvents, error: null });
      
      return true;
    } catch (error) {
      console.error('Delete event error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete event');
      return false;
    }
  }, [fetchEvents, setError, getBackendId]);

  // Task operations with minimal logging
  const createTask = useCallback(async (taskData: Omit<TaskData, 'id'>): Promise<TaskData | null> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return null;
    }

    const tempTask: TaskData = {
      id: `temp-${Date.now()}`,
      ...taskData
    };

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
        updateState({ 
          tasks: globalState.tasks.filter(task => task.id !== tempTask.id)
        });
        const errorText = await response.text();
        throw new Error(`Failed to create task: ${response.status} - ${errorText}`);
      }

      const newTask: TaskData = await response.json();
      console.log('Task created:', newTask.event);
      
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

  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    const taskToDelete = globalState.tasks.find(task => task.id === taskId);
    
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
        if (taskToDelete) {
          updateState({ 
            tasks: [...globalState.tasks, taskToDelete]
          });
        }
        throw new Error(`Failed to delete task: ${response.status}`);
      }
      
      console.log('Task deleted:', taskId);
      return true;
    } catch (error) {
      console.error('Delete task error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete task');
      return false;
    }
  }, [setError]);

  // FIXED INITIALIZATION - Single global promise prevents duplicates
  const initializeData = useCallback(async (forceRefresh = false) => {
    // Use existing promise if initialization is already in progress
    if (initializationPromise && !forceRefresh) {
      console.log('Initialization already in progress, waiting...');
      return initializationPromise;
    }

    if (!authAPI.isAuthenticated()) {
      console.log('Not authenticated, clearing state');
      hasInitialized = false;
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
    if (hasInitialized && globalState.initialized && !forceRefresh) {
      return;
    }

    // Create initialization promise
    initializationPromise = (async () => {
      try {
        console.log('🔄 Initializing app data...');
        
        // Set appropriate loading state
        if (!hasInitialized) {
          updateState({ isInitializing: true });
        } else if (forceRefresh) {
          updateState({ isRefreshing: true });
        }
        
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

        console.log('✅ Data loaded successfully');

        hasInitialized = true;
        updateState({
          events: eventsData,
          tasks: tasksData,
          error: null,
          isInitializing: false,
          isRefreshing: false,
          initialized: true
        });
        
      } catch (error) {
        console.error('❌ Data initialization failed:', error);
        hasInitialized = true; // Still mark as "initialized" to prevent retries
        updateState({
          error: error instanceof Error ? error.message : 'Failed to load data',
          isInitializing: false,
          isRefreshing: false,
          initialized: true
        });
      } finally {
        // Clear the promise so future calls can create a new one
        initializationPromise = null;
      }
    })();

    return initializationPromise;
  }, [fetchEvents, fetchTasks]);

  // SIMPLIFIED initialization effect - only run once per app session
  useEffect(() => {
    // Only initialize if we haven't tried yet and we're authenticated
    if (!hasInitialized && authAPI.isAuthenticated()) {
      console.log(`🚀 Component ${componentIdRef.current} triggering initialization`);
      initializeData();
    }
  }, []); // No dependencies to prevent re-running

  // Simplified auth monitoring with less frequent checks
  useEffect(() => {
    const checkAuthInterval = setInterval(() => {
      const isAuth = authAPI.isAuthenticated();
      
      if (!isAuth && hasInitialized) {
        console.log('🔒 Auth lost, resetting state');
        hasInitialized = false;
        updateState({ 
          events: [], 
          tasks: [], 
          error: null, 
          isInitializing: false,
          isRefreshing: false,
          initialized: false 
        });
      } else if (isAuth && !hasInitialized && !globalState.isInitializing) {
        console.log('🔓 Auth gained, initializing...');
        initializeData();
      }
    }, 3000); // Check every 3 seconds instead of every 1 second

    return () => clearInterval(checkAuthInterval);
  }, []); // No dependencies

  return {
    // State
    events: state.events,
    tasks: state.tasks,
    isLoading: state.isInitializing,
    isRefreshing: state.isRefreshing,
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
    initializeData: (forceRefresh = false) => initializeData(forceRefresh),
    setError
  };
};