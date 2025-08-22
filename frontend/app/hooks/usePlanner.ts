// hooks/usePlanner.ts - FIXED VERSION (Remount Safe)
import { useState, useCallback, useRef, useEffect } from 'react';
import { authAPI } from '../../lib/auth';

export interface Assignment {
  id: string;
  title: string;
  completed: boolean;
  day_of_week: string;
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
  console.log(`[${timestamp}] PLANNER DEBUG: ${message}`, data || '');
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
  
  const [state, setState] = useState<PlannerState>({
    classes: [],
    assignments: [],
    isLoading: true,
    error: null,
    initialized: false
  });
  
  // Use state-based tracking instead of refs to survive remounts
  const [initializationId] = useState(() => Math.random().toString(36));
  const activeInitRef = useRef<string | null>(null);

  debugLog('usePlanner: Current state', {
    isLoading: state.isLoading,
    initialized: state.initialized,
    initializationId,
    activeInit: activeInitRef.current,
    classesCount: state.classes.length,
    assignmentsCount: state.assignments.length,
    error: state.error
  });

  // Fixed initialization that handles remounts properly
  useEffect(() => {
    debugLog('useEffect: Effect triggered', { initializationId });
    
    // If we're already initialized, don't re-initialize
    if (state.initialized) {
      debugLog('useEffect: Already initialized, skipping');
      return;
    }

    // If there's already an active initialization for this component, don't start another
    if (activeInitRef.current === initializationId) {
      debugLog('useEffect: Initialization already active for this component');
      return;
    }

    const initializeData = async () => {
      debugLog('initializeData: Starting initialization process', { initializationId });
      activeInitRef.current = initializationId;

      // Check environment variables
      debugLog('initializeData: Environment check', {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        hasAuthAPI: !!authAPI
      });

      // Check authentication
      let isAuthenticated;
      try {
        isAuthenticated = authAPI.isAuthenticated();
        debugLog('initializeData: Auth check result', isAuthenticated);
      } catch (authError) {
        debugLog('initializeData: Auth check threw error', authError);
        
        // Only update state if this is still the active initialization
        if (activeInitRef.current === initializationId) {
          setState({
            classes: [],
            assignments: [],
            isLoading: false,
            error: 'Authentication system error',
            initialized: true
          });
        }
        return;
      }

      // If not authenticated, set to not loading immediately
      if (!isAuthenticated) {
        debugLog('initializeData: Not authenticated - setting not loading');
        
        // Only update state if this is still the active initialization
        if (activeInitRef.current === initializationId) {
          setState({
            classes: [],
            assignments: [],
            isLoading: false,
            error: null,
            initialized: true
          });
        }
        return;
      }

      debugLog('initializeData: Authentication passed, starting data fetch');

      try {
        debugLog('initializeData: Starting Promise.allSettled for API calls');
        const startTime = Date.now();
        
        const [classesResult, assignmentsResult] = await Promise.allSettled([
          fetchClasses(),
          fetchAssignments()
        ]);
        
        const endTime = Date.now();
        debugLog('initializeData: Promise.allSettled completed', {
          duration: `${endTime - startTime}ms`,
          classesStatus: classesResult.status,
          assignmentsStatus: assignmentsResult.status,
          activeInit: activeInitRef.current,
          currentInit: initializationId
        });

        // Only proceed if this is still the active initialization
        if (activeInitRef.current !== initializationId) {
          debugLog('initializeData: Initialization was superseded, aborting state update');
          return;
        }

        const classes = classesResult.status === 'fulfilled' ? classesResult.value : [];
        const assignments = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : [];

        if (classesResult.status === 'rejected') {
          debugLog('initializeData: Classes fetch failed', classesResult.reason);
        }
        
        if (assignmentsResult.status === 'rejected') {
          debugLog('initializeData: Assignments fetch failed', assignmentsResult.reason);
        }

        debugLog('initializeData: Fetched planner data successfully', { 
          classesCount: classes.length, 
          assignmentsCount: assignments.length 
        });

        // Update state with fetched data
        setState({
          classes,
          assignments,
          isLoading: false,
          error: null,
          initialized: true
        });
        debugLog('initializeData: State updated - isLoading should now be false');

      } catch (error) {
        debugLog('initializeData: Caught error in try-catch', error);
        
        // Only update state if this is still the active initialization
        if (activeInitRef.current === initializationId) {
          setState({
            classes: [],
            assignments: [],
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load planner data',
            initialized: true
          });
        }
      }
    };

    // Add timeout to catch hanging initialization
    const timeoutId = setTimeout(() => {
      if (activeInitRef.current === initializationId) {
        debugLog('TIMEOUT: Initialization taking longer than 10 seconds!', {
          initializationId,
          activeInit: activeInitRef.current,
          currentState: state
        });
      }
    }, 10000);

    initializeData().finally(() => {
      clearTimeout(timeoutId);
      debugLog('initializeData: Initialization process completed (finally block)', { initializationId });
    });
    
    return () => {
      debugLog('useEffect cleanup', { initializationId });
      clearTimeout(timeoutId);
    };
  }, [state.initialized, initializationId]); // Depend on initialized state

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

  const setError = useCallback((error: string | null) => {
    debugLog('setError called', error);
    setState(prev => ({ ...prev, error }));
  }, []);

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
      
      setState(prev => ({
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
  }, [setError, state.classes.length]);

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
      
      setState(prev => ({
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
  }, [setError]);

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

      setState(prev => ({
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
  }, [setError]);

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
      
      setState(prev => ({
        ...prev,
        assignments: [...prev.assignments, newAssignment],
        error: null
      }));
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create assignment');
      return false;
    }
  }, [setError]);

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
      
      setState(prev => ({
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
  }, [setError]);

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

      setState(prev => ({
        ...prev,
        assignments: prev.assignments.filter(assignment => assignment.id !== assignmentId),
        error: null
      }));
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete assignment');
      return false;
    }
  }, [setError]);

  const refreshPlanner = useCallback(async () => {
    debugLog('refreshPlanner: Starting');
    
    if (!authAPI.isAuthenticated()) {
      debugLog('refreshPlanner: Not authenticated');
      return;
    }

    try {
      setState(prev => ({ ...prev, error: null }));

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

      setState(prev => ({
        ...prev,
        classes,
        assignments,
        error: null
      }));
    } catch (error) {
      debugLog('refreshPlanner: Error caught', error);
      setError(error instanceof Error ? error.message : 'Failed to refresh data');
    }
  }, [setError]);

  // Helper function to get assignments organized by class and day
  const getAssignmentsByClassAndDay = useCallback(() => {
    const organized: Record<string, Record<string, Assignment[]>> = {};
    
    state.assignments.forEach(assignment => {
      if (!organized[assignment.planner_class]) {
        organized[assignment.planner_class] = {};
      }
      if (!organized[assignment.planner_class][assignment.day_of_week]) {
        organized[assignment.planner_class][assignment.day_of_week] = [];
      }
      organized[assignment.planner_class][assignment.day_of_week].push(assignment);
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
    getAssignmentsByClassAndDay
  };
};