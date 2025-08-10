// hooks/useAppState.ts - FIXED VERSION WITH GRANULAR LOADING
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
  isInitializing: boolean; // Only for first load
  isRefreshing: boolean;   // For manual refreshes
  error: string | null;
  initialized: boolean;
}

// Separate the concept of "initial loading" from "background operations"
let globalState: AppState = {
  events: [],
  tasks: [],
  isInitializing: false,  // Only true during first data load
  isRefreshing: false,    // Only true during manual refresh
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
    updateState({ error });
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
              id: event.id,
              originalEventId: event.id,
              frontendId: `${event.id}_${dateString}`,
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

  // Fetch events - NO LOADING STATE CHANGES
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

  // Fetch tasks - NO LOADING STATE CHANGES
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

  // INITIALIZATION - Only shows loading on first load or manual refresh
  const initializeData = useCallback(async (forceRefresh = false) => {
    console.log('=== INITIALIZE DATA START ===');
    
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

    // Prevent multiple simultaneous calls
    if (globalState.isInitializing || globalState.isRefreshing) {
      console.log('Already loading, skipping');
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
        isInitializing: false,
        isRefreshing: false,
        initialized: true
      });

      console.log('=== INITIALIZE DATA SUCCESS ===');
      
    } catch (error) {
      console.error('=== INITIALIZE DATA FAILED ===', error);
      updateState({
        error: error instanceof Error ? error.message : 'Failed to load data',
        isInitializing: false,
        isRefreshing: false,
        initialized: true
      });
    }
  }, [fetchEvents, fetchTasks]);

  // Simple initialization effect - only run once when auth is ready
  useEffect(() => {
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
  }, []);

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
          isInitializing: false,
          isRefreshing: false,
          initialized: false 
        });
        hasTriedInitRef.current = false;
      } else if (isAuth && !globalState.initialized && !globalState.isInitializing) {
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
    isLoading: state.isInitializing, // Only true during initial load
    isRefreshing: state.isRefreshing, // Only true during manual refresh
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
    setError
  };
};
