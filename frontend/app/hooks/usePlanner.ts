// hooks/usePlanner.ts - DATE-BASED VERSION WITH NO-WORK DAYS
import { useState, useCallback, useRef, useEffect } from 'react';
import { authAPI } from '../../lib/auth';
import { usePostHog } from 'posthog-js/react';
import type { PostHog } from 'posthog-js';

// Simple global state to prevent duplicate fetches across hook instances
let globalPlannerState: {
  classes: PlannerClass[];
  assignments: Assignment[];
  noWorkDays: NoWorkDay[];
  initialized: boolean;
  error: string | null;
} | null = null;

let fetchInProgress = false;
const subscribers = new Set<(state: any) => void>();

export interface Assignment {
  id: string;
  title: string;
  completed: boolean;
  date: string; // Changed from day_of_week to date (YYYY-MM-DD format)
  planner_class: string;
  order: number;
  created_at?: string;
  updated_at?: string;
  isEditing?: boolean; // Frontend only
}

export interface PlannerClass {
  id: string;
  name: string;
  order: number;
  created_at?: string;
  updated_at?: string;
  isEditing?: boolean; // Frontend only
}

export interface NoWorkDay {
  id: string;
  date: string; // YYYY-MM-DD format
  planner_class: string;
  created_at?: string;
  updated_at?: string;
}

interface PlannerState {
  classes: PlannerClass[];
  assignments: Assignment[];
  noWorkDays: NoWorkDay[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
}

// Enhanced debug logging
const debugLog = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
};

// Helper to get default date range (4 days past + 1 week future)
const getDefaultDateRange = () => {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 4); // 4 days ago
  
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 7); // 1 week ahead
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
};

// API functions
const fetchClasses = async (): Promise<PlannerClass[]> => {
  debugLog('fetchClasses: Starting');
  
  if (!authAPI.isAuthenticated()) {
    debugLog('fetchClasses: Not authenticated - throwing error');
    throw new Error('Not authenticated');
  }
  
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/planner/classes/`;
  debugLog('fetchClasses: Making request to', url);

  const response = await authAPI.authenticatedFetch(url);
  debugLog('fetchClasses: Response received', {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    debugLog('fetchClasses: Response not ok, error text:', errorText);
    throw new Error(`Classes API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  debugLog('fetchClasses: Successfully parsed JSON data', data);
  return data;
};

const fetchAssignments = async (days?: number): Promise<Assignment[]> => {
  debugLog('fetchAssignments: Starting', { days });
  
  if (!authAPI.isAuthenticated()) {
    debugLog('fetchAssignments: Not authenticated - throwing error');
    throw new Error('Not authenticated');
  }
  
  let url = `${process.env.NEXT_PUBLIC_API_URL}/api/planner/assignments/`;
  
  // Add days parameter if provided (backend will calculate the range)
  if (days !== undefined) {
    url += `?days=${days}`;
  }
  
  debugLog('fetchAssignments: Making request to', url);

  const response = await authAPI.authenticatedFetch(url);
  debugLog('fetchAssignments: Response received', {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    debugLog('fetchAssignments: Response not ok, error text:', errorText);
    throw new Error(`Assignments API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  debugLog('fetchAssignments: Successfully parsed JSON data', data);
  return data;
};

const fetchNoWorkDays = async (): Promise<NoWorkDay[]> => {
  debugLog('fetchNoWorkDays: Starting');
  
  if (!authAPI.isAuthenticated()) {
    debugLog('fetchNoWorkDays: Not authenticated - throwing error');
    throw new Error('Not authenticated');
  }
  
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/planner/no-work-days/`;
  debugLog('fetchNoWorkDays: Making request to', url);

  const response = await authAPI.authenticatedFetch(url);
  debugLog('fetchNoWorkDays: Response received', {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    debugLog('fetchNoWorkDays: Response not ok, error text:', errorText);
    throw new Error(`No Work Days API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  debugLog('fetchNoWorkDays: Successfully parsed JSON data', data);
  return data;
};

export const usePlanner = () => {
  debugLog('usePlanner: Hook called/re-rendered');
  const posthog = usePostHog();

  const [state, setState] = useState<PlannerState>(() => {
    if (globalPlannerState) {
      // Use existing global state if available
      return {
        classes: globalPlannerState.classes,
        assignments: globalPlannerState.assignments,
        noWorkDays: globalPlannerState.noWorkDays,
        isLoading: false,
        error: globalPlannerState.error,
        initialized: globalPlannerState.initialized
      };
    }
    return {
      classes: [],
      assignments: [],
      noWorkDays: [],
      isLoading: true,
      error: null,
      initialized: false
    };
  });

  debugLog('usePlanner: Current state', {
    isLoading: state.isLoading,
    initialized: state.initialized,
    globalInitialized: globalPlannerState?.initialized,
    classesCount: state.classes.length,
    assignmentsCount: state.assignments.length,
    noWorkDaysCount: state.noWorkDays.length,
    error: state.error
  });

  // Subscribe to global state changes
  useEffect(() => {
    const updateState = (newState: any) => {
      setState(newState);
    };
    
    subscribers.add(updateState);
    return () => {
      subscribers.delete(updateState);
    };
  }, []);

  // Initialize data - only once globally
  const initializeData = useCallback(async () => {
    // If already initialized globally, don't fetch again
    if (globalPlannerState?.initialized || fetchInProgress) {
      debugLog('initializeData: Skipping - already initialized or in progress');
      return;
    }

    debugLog('initializeData: Starting initialization process');
    fetchInProgress = true;

    // Check authentication
    let isAuthenticated;
    try {
      isAuthenticated = authAPI.isAuthenticated();
      debugLog('initializeData: Auth check result', isAuthenticated);
    } catch (authError) {
      debugLog('initializeData: Auth check threw error', authError);
      
      globalPlannerState = {
        classes: [],
        assignments: [],
        noWorkDays: [],
        initialized: true,
        error: 'Authentication system error'
      };
      
      const newState = {
        classes: [],
        assignments: [],
        noWorkDays: [],
        isLoading: false,
        error: 'Authentication system error',
        initialized: true
      };
      
      // Notify all subscribers
      subscribers.forEach(callback => callback(newState));
      fetchInProgress = false;
      return;
    }

    if (!isAuthenticated) {
      debugLog('initializeData: Not authenticated - setting not loading');
      
      globalPlannerState = {
        classes: [],
        assignments: [],
        noWorkDays: [],
        initialized: true,
        error: null
      };
      
      const newState = {
        classes: [],
        assignments: [],
        noWorkDays: [],
        isLoading: false,
        error: null,
        initialized: true
      };
      
      // Notify all subscribers
      subscribers.forEach(callback => callback(newState));
      fetchInProgress = false;
      return;
    }

    debugLog('initializeData: Authentication passed, starting data fetch');

    try {
      // First fetch classes (which creates default assignment if needed)
      const classes = await fetchClasses();
      
      // Then fetch assignments for default range (4 days past + 7 days future = 11 days total)
      const assignments = await fetchAssignments(11);
      
      // Finally fetch no work days
      const noWorkDays = await fetchNoWorkDays();

      globalPlannerState = {
        classes,
        assignments,
        noWorkDays,
        initialized: true,
        error: null
      };

      const newState = {
        classes,
        assignments,
        noWorkDays,
        isLoading: false,
        error: null,
        initialized: true
      };

      debugLog('initializeData: Fetched planner data successfully', { 
        classesCount: classes.length, 
        assignmentsCount: assignments.length,
        noWorkDaysCount: noWorkDays.length
      });

      // Notify all subscribers
      subscribers.forEach(callback => callback(newState));

    } catch (error) {
      debugLog('initializeData: Caught error in try-catch', error);
      
      globalPlannerState = {
        classes: [],
        assignments: [],
        noWorkDays: [],
        initialized: true,
        error: error instanceof Error ? error.message : 'Failed to load planner data'
      };
      
      const newState = {
        classes: [],
        assignments: [],
        noWorkDays: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load planner data',
        initialized: true
      };
      
      // Notify all subscribers
      subscribers.forEach(callback => callback(newState));
    } finally {
      fetchInProgress = false;
    }
  }, []);

  // Initialize on mount if needed
  useEffect(() => {
    if (!globalPlannerState?.initialized && !fetchInProgress) {
      initializeData();
    }
  }, [initializeData]);

  // Debug state changes
  useEffect(() => {
    debugLog('State changed', {
      isLoading: state.isLoading,
      initialized: state.initialized,
      error: state.error,
      classesCount: state.classes.length,
      assignmentsCount: state.assignments.length,
      noWorkDaysCount: state.noWorkDays.length
    });
  }, [state]);

  // Update operations need to update both local state and global state
  const updateGlobalAndLocalState = useCallback((updater: (prev: PlannerState) => PlannerState) => {
    setState(prev => {
      const newState = updater(prev);
      
      // Update global state
      if (globalPlannerState) {
        globalPlannerState.classes = newState.classes;
        globalPlannerState.assignments = newState.assignments;
        globalPlannerState.noWorkDays = newState.noWorkDays;
        globalPlannerState.error = newState.error;
      }
      
      // Notify other hook instances
      subscribers.forEach(callback => callback(newState));
      
      return newState;
    });
  }, []);

  const setError = useCallback((error: string | null) => {
    debugLog('setError called', error);
    updateGlobalAndLocalState(prev => ({ ...prev, error }));
  }, [updateGlobalAndLocalState]);

  // Class operations
  const createClass = useCallback(async (name: string): Promise<boolean> => {
    debugLog('createClass: Starting', { name });
    
    if (!authAPI.isAuthenticated()) {
      debugLog('createClass: Not authenticated');
      setError('Not authenticated');
      return false;
    }

    try {
      debugLog('createClass: Making API request');
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/planner/classes/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, order: state.classes.length }),
        }
      );

      debugLog('createClass: Response received', {
        ok: response.ok,
        status: response.status
      });

      if (!response.ok) {
        const errorText = await response.text();
        debugLog('createClass: Response not ok', errorText);
        throw new Error(`Failed to create class: ${response.status} - ${errorText}`);
      }

      const newClass: PlannerClass = await response.json();
      debugLog('createClass: New class created', newClass);
      
      updateGlobalAndLocalState(prev => ({
        ...prev,
        classes: [...prev.classes, newClass],
        error: null
      }));
      
      return true;
    } catch (error) {
      debugLog('createClass: Error caught', error);
      setError(error instanceof Error ? error.message : 'Failed to create class');
      return false;
    }
  }, [setError, state.classes.length, updateGlobalAndLocalState]);

  const updateClass = useCallback(async (classId: string, updates: Partial<PlannerClass>): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/planner/classes/${classId}/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update class: ${response.status} - ${errorText}`);
      }

      const updatedClass: PlannerClass = await response.json();
      
      updateGlobalAndLocalState(prev => ({
        ...prev,
        classes: prev.classes.map(cls =>
          cls.id === classId ? updatedClass : cls
        ),
        error: null
      }));
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update class');
      return false;
    }
  }, [setError, updateGlobalAndLocalState]);

  const deleteClass = useCallback(async (classId: string): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/planner/classes/${classId}/`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete class: ${response.status} - ${errorText}`);
      }

      updateGlobalAndLocalState(prev => ({
        ...prev,
        classes: prev.classes.filter(cls => cls.id !== classId),
        assignments: prev.assignments.filter(assignment => assignment.planner_class !== classId),
        noWorkDays: prev.noWorkDays.filter(noWorkDay => noWorkDay.planner_class !== classId),
        error: null
      }));
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete class');
      return false;
    }
  }, [setError, updateGlobalAndLocalState]);

  // Assignment operations
  const createAssignment = useCallback(async (assignmentData: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/planner/assignments/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assignmentData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create assignment: ${response.status} - ${errorText}`);
      }

      const newAssignment: Assignment = await response.json();
      
      // Track the assignment creation event
      if (posthog) {
        setTimeout(() => {
          posthog.capture('assignment_created', {
            assignment_id: newAssignment.id,
            class_id: assignmentData.planner_class,
            date: assignmentData.date,
            has_title: !!assignmentData.title,
            timestamp: new Date().toISOString()
          });
        }, 0);
      }
      
      updateGlobalAndLocalState(prev => ({
        ...prev,
        assignments: [...prev.assignments, newAssignment],
        error: null
      }));
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create assignment');
      return false;
    }
  }, [setError, updateGlobalAndLocalState, posthog]);


  const updateAssignment = useCallback(async (assignmentId: string, updates: Partial<Assignment>): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/planner/assignments/${assignmentId}/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update assignment: ${response.status} - ${errorText}`);
      }

      const updatedAssignment: Assignment = await response.json();
      
      updateGlobalAndLocalState(prev => ({
        ...prev,
        assignments: prev.assignments.map(assignment =>
          assignment.id === assignmentId ? updatedAssignment : assignment
        ),
        error: null
      }));
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update assignment');
      return false;
    }
  }, [setError, updateGlobalAndLocalState]);

  const deleteAssignment = useCallback(async (assignmentId: string): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/planner/assignments/${assignmentId}/`,
        { method: 'DELETE' }
      );



      updateGlobalAndLocalState(prev => ({
        ...prev,
        assignments: prev.assignments.filter(assignment => assignment.id !== assignmentId),
        error: null
      }));
      
      return true;
    } catch (error) {
      return false;
    }
  }, [setError, updateGlobalAndLocalState]);

  // No Work Day operations
  const createNoWorkDay = useCallback(async (noWorkDayData: Omit<NoWorkDay, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/planner/no-work-days/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(noWorkDayData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create no-work day: ${response.status} - ${errorText}`);
      }

      const newNoWorkDay: NoWorkDay = await response.json();
      
      updateGlobalAndLocalState(prev => ({
        ...prev,
        noWorkDays: [...prev.noWorkDays, newNoWorkDay],
        error: null
      }));
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create no-work day');
      return false;
    }
  }, [setError, updateGlobalAndLocalState]);

  const deleteNoWorkDay = useCallback(async (classId: string, dateString: string): Promise<boolean> => {
    if (!authAPI.isAuthenticated()) {
      setError('Not authenticated');
      return false;
    }

    // Find the no-work day to delete
    const noWorkDay = state.noWorkDays.find(
      nwd => nwd.planner_class === classId && nwd.date === dateString
    );

    if (!noWorkDay) {
      debugLog('deleteNoWorkDay: No matching no-work day found');
      return true; // Already doesn't exist
    }

    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/planner/no-work-days/${noWorkDay.id}/`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete no-work day: ${response.status} - ${errorText}`);
      }

      updateGlobalAndLocalState(prev => ({
        ...prev,
        noWorkDays: prev.noWorkDays.filter(nwd => nwd.id !== noWorkDay.id),
        error: null
      }));
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete no-work day');
      return false;
    }
  }, [setError, updateGlobalAndLocalState, state.noWorkDays]);

  const refreshPlanner = useCallback(async () => {
    debugLog('refreshPlanner: Starting');
    
    if (!authAPI.isAuthenticated()) {
      debugLog('refreshPlanner: Not authenticated');
      return;
    }

    try {
      const [classesResult, assignmentsResult, noWorkDaysResult] = await Promise.allSettled([
        fetchClasses(),
        fetchAssignments(11), // 4 days past + 7 days future
        fetchNoWorkDays()
      ]);

      const classes = classesResult.status === 'fulfilled' ? classesResult.value : [];
      const assignments = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : [];
      const noWorkDays = noWorkDaysResult.status === 'fulfilled' ? noWorkDaysResult.value : [];

      debugLog('refreshPlanner: Data refreshed', {
        classesCount: classes.length,
        assignmentsCount: assignments.length,
        noWorkDaysCount: noWorkDays.length
      });

      // Update global state
      if (globalPlannerState) {
        globalPlannerState.classes = classes;
        globalPlannerState.assignments = assignments;
        globalPlannerState.noWorkDays = noWorkDays;
        globalPlannerState.error = null;
      }

      const newState = {
        classes,
        assignments,
        noWorkDays,
        isLoading: false,
        error: null,
        initialized: true
      };

      // Notify all subscribers
      subscribers.forEach(callback => callback(newState));
    } catch (error) {
      debugLog('refreshPlanner: Error caught', error);
      setError(error instanceof Error ? error.message : 'Failed to refresh data');
    }
  }, [setError]);

  // Load more assignments - pass number of days to load
  const loadMoreAssignments = useCallback(async (days: number): Promise<boolean> => {
    debugLog('loadMoreAssignments: Starting', { days });
    
    if (!authAPI.isAuthenticated()) {
      debugLog('loadMoreAssignments: Not authenticated');
      return false;
    }

    try {
      const newAssignments = await fetchAssignments(days);
      
      debugLog('loadMoreAssignments: Fetched assignments', {
        count: newAssignments.length
      });

      // Replace all assignments with the new expanded set
      updateGlobalAndLocalState(prev => ({
        ...prev,
        assignments: newAssignments,
        error: null
      }));
      
      return true;
    } catch (error) {
      debugLog('loadMoreAssignments: Error caught', error);
      setError(error instanceof Error ? error.message : 'Failed to load more assignments');
      return false;
    }
  }, [setError, updateGlobalAndLocalState]);

  // Helper function to get assignments organized by class and date
  const getAssignmentsByClassAndDate = useCallback(() => {
    const organized: Record<string, Record<string, Assignment[]>> = {};
    
    state.assignments.forEach(assignment => {
      if (!organized[assignment.planner_class]) {
        organized[assignment.planner_class] = {};
      }
      if (!organized[assignment.planner_class][assignment.date]) {
        organized[assignment.planner_class][assignment.date] = [];
      }
      organized[assignment.planner_class][assignment.date].push(assignment);
    });

    // Sort assignments within each date by order, then by created_at
    Object.keys(organized).forEach(classId => {
      Object.keys(organized[classId]).forEach(date => {
        organized[classId][date].sort((a, b) => {
          if (a.order !== b.order) {
            return a.order - b.order;
          }
          return (a.created_at || '').localeCompare(b.created_at || '');
        });
      });
    });

    return organized;
  }, [state.assignments]);

  return {
    classes: state.classes,
    assignments: state.assignments,
    noWorkDays: state.noWorkDays,
    isLoading: state.isLoading,
    error: state.error,
    initialized: state.initialized,
    
    // Class operations
    createClass,
    updateClass,
    deleteClass,
    
    // Assignment operations
    createAssignment,
    updateAssignment,
    deleteAssignment,
    
    // No Work Day operations
    createNoWorkDay,
    deleteNoWorkDay,
    
    // Utilities
    refreshPlanner,
    loadMoreAssignments,
    setError,
    getAssignmentsByClassAndDate
  };
};