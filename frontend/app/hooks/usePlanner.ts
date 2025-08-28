// hooks/usePlanner.ts - DATE-BASED VERSION
import { useState, useCallback, useRef, useEffect } from 'react';
import { authAPI } from '../../lib/auth';

// Simple global state to prevent duplicate fetches across hook instances
let globalPlannerState: {
  classes: PlannerClass[];
  assignments: Assignment[];
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

interface PlannerState {
  classes: PlannerClass[];
  assignments: Assignment[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
}

// Enhanced debug logging
const debugLog = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
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

const fetchAssignments = async (): Promise<Assignment[]> => {
  debugLog('fetchAssignments: Starting');
  
  if (!authAPI.isAuthenticated()) {
    debugLog('fetchAssignments: Not authenticated - throwing error');
    throw new Error('Not authenticated');
  }
  
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/planner/assignments/`;
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

export const usePlanner = () => {
  debugLog('usePlanner: Hook called/re-rendered');
  
  const [state, setState] = useState<PlannerState>(() => {
    if (globalPlannerState) {
      // Use existing global state if available
      return {
        classes: globalPlannerState.classes,
        assignments: globalPlannerState.assignments,
        isLoading: false,
        error: globalPlannerState.error,
        initialized: globalPlannerState.initialized
      };
    }
    return {
      classes: [],
      assignments: [],
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
        initialized: true,
        error: 'Authentication system error'
      };
      
      const newState = {
        classes: [],
        assignments: [],
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
        initialized: true,
        error: null
      };
      
      const newState = {
        classes: [],
        assignments: [],
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
      const [classesResult, assignmentsResult] = await Promise.allSettled([
        fetchClasses(),
        fetchAssignments()
      ]);

      const classes = classesResult.status === 'fulfilled' ? classesResult.value : [];
      const assignments = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : [];

      globalPlannerState = {
        classes,
        assignments,
        initialized: true,
        error: null
      };

      const newState = {
        classes,
        assignments,
        isLoading: false,
        error: null,
        initialized: true
      };

      debugLog('initializeData: Fetched planner data successfully', { 
        classesCount: classes.length, 
        assignmentsCount: assignments.length 
      });

      // Notify all subscribers
      subscribers.forEach(callback => callback(newState));

    } catch (error) {
      debugLog('initializeData: Caught error in try-catch', error);
      
      globalPlannerState = {
        classes: [],
        assignments: [],
        initialized: true,
        error: error instanceof Error ? error.message : 'Failed to load planner data'
      };
      
      const newState = {
        classes: [],
        assignments: [],
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
      assignmentsCount: state.assignments.length
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
  }, [setError, updateGlobalAndLocalState]);

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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete assignment: ${response.status} - ${errorText}`);
      }

      updateGlobalAndLocalState(prev => ({
        ...prev,
        assignments: prev.assignments.filter(assignment => assignment.id !== assignmentId),
        error: null
      }));
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete assignment');
      return false;
    }
  }, [setError, updateGlobalAndLocalState]);

  const refreshPlanner = useCallback(async () => {
    debugLog('refreshPlanner: Starting');
    
    if (!authAPI.isAuthenticated()) {
      debugLog('refreshPlanner: Not authenticated');
      return;
    }

    try {
      const [classesResult, assignmentsResult] = await Promise.allSettled([
        fetchClasses(),
        fetchAssignments()
      ]);

      const classes = classesResult.status === 'fulfilled' ? classesResult.value : [];
      const assignments = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : [];

      debugLog('refreshPlanner: Data refreshed', {
        classesCount: classes.length,
        assignmentsCount: assignments.length
      });

      // Update global state
      if (globalPlannerState) {
        globalPlannerState.classes = classes;
        globalPlannerState.assignments = assignments;
        globalPlannerState.error = null;
      }

      const newState = {
        classes,
        assignments,
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
    
    // Utilities
    refreshPlanner,
    setError,
    getAssignmentsByClassAndDate
  };
};