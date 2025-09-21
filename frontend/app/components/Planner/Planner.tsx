import React, { useState, useRef, useMemo } from 'react';
import CustomCalendarHeader from '../CustomCalHeader';
import { usePlanner } from '../../hooks/usePlanner';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import ClassesSidebar from './ClassesSidebar';
import PlannerGrid from './PlannerGrid';
import '../../styles/planner.css';

// Define or import ViewType - matching the main app view types
type ViewType = 'calendar' | 'your-new-view';

export interface PlannerProps {
  rightSidebarOpen?: boolean;
  activeAppView?: ViewType;
  onAppViewChange?: (newView: ViewType) => void;
  isAuthenticated?: boolean;
}

interface DragState {
  isDragging: boolean;
  draggedIndex: number | null;
  dragOverIndex: number | null;
}

const Planner: React.FC<PlannerProps> = ({
  rightSidebarOpen = false,
  activeAppView = 'your-new-view',
  onAppViewChange,
  isAuthenticated = false
}) => {
  const {
    classes,
    assignments,
    isLoading,
    error,
    initialized,
    createClass,
    updateClass,
    deleteClass,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    getAssignmentsByClassAndDate,
    // ADD: Assuming you have these functions in your usePlanner hook
    createNoWorkDay,
    deleteNoWorkDay,
    noWorkDays,
    // ADD: We need a way to force refresh the assignments if needed
    setError
  } = usePlanner();

  const [newClassName, setNewClassName] = useState('');
  const [showAddClass, setShowAddClass] = useState(false);
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [editingClassValue, setEditingClassValue] = useState('');
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [editingAssignmentValue, setEditingAssignmentValue] = useState('');
  const [newAssignmentInputs, setNewAssignmentInputs] = useState<Record<string, string>>({});
  
  // ADD: Local state for optimistic updates
  const [localAssignmentUpdates, setLocalAssignmentUpdates] = useState<Record<string, { completed?: boolean; deleted?: boolean }>>({});
  const [localNoWorkUpdates, setLocalNoWorkUpdates] = useState<Record<string, boolean>>({});
  
  // CHANGED: Get striped cells from backend AND local optimistic updates
  const stripedCells = useMemo(() => {
    if (!isAuthenticated) return new Set<string>();
    
    const cellSet = new Set<string>();
    
    // Add cells from backend data
    if (noWorkDays) {
      noWorkDays.forEach(noWorkDay => {
        const cellKey = `${noWorkDay.planner_class}-${noWorkDay.date}`;
        cellSet.add(cellKey);
      });
    }
    
    // Apply local optimistic updates
    Object.entries(localNoWorkUpdates).forEach(([cellKey, isNoWork]) => {
      if (isNoWork) {
        cellSet.add(cellKey);
      } else {
        cellSet.delete(cellKey);
      }
    });
    
    return cellSet;
  }, [isAuthenticated, noWorkDays, localNoWorkUpdates]);
  
  // New state for date navigation
  const [currentDateOffset, setCurrentDateOffset] = useState(0); // 0 = today, -1 = yesterday, 1 = tomorrow

  // State for drag and drop
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedIndex: null,
    dragOverIndex: null
  });

  // State for delete confirmation
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    classId: string;
    className: string;
  }>({
    show: false,
    classId: '',
    className: ''
  });

  // Create a dummy ref for the header (not used in planner but required by header component)
  const dummyCalendarRef = useRef(null);

  // Get organized assignments - only if authenticated, with optimistic updates applied
  const organizedAssignments = useMemo(() => {
    if (!isAuthenticated) return {};
    
    const baseAssignments = getAssignmentsByClassAndDate();
    
    // Apply local optimistic updates
    const updatedAssignments: typeof baseAssignments = {};
    
    for (const [classId, dateAssignments] of Object.entries(baseAssignments)) {
      updatedAssignments[classId] = {};
      for (const [dateString, assignments] of Object.entries(dateAssignments)) {
        updatedAssignments[classId][dateString] = assignments
          .map(assignment => {
            const localUpdate = localAssignmentUpdates[assignment.id];
            if (localUpdate?.deleted) return null; // Filter out deleted assignments
            
            return {
              ...assignment,
              ...(localUpdate?.completed !== undefined && { completed: localUpdate.completed })
            };
          })
          .filter(Boolean) as typeof assignments; // Remove null entries
      }
    }
    
    return updatedAssignments;
  }, [isAuthenticated, getAssignmentsByClassAndDate, localAssignmentUpdates]);

  // FIXED: Helper function to format date as YYYY-MM-DD for API (avoiding timezone issues)
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // FIXED: Helper function to create date from API date string (avoiding timezone conversion)
  const createDateFromAPIString = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed in JavaScript Date
  };

  // Helper function to get display name for date
  const getDateDisplayName = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  };

  // FIXED: Get the 5 days to show based on current offset (using local date construction)
  const getFiveDaysToShow = () => {
    const today = new Date();
    // Reset time to avoid any time-based issues
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + currentDateOffset - 1);

    const days = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      days.push({
        date: date,
        dateString: formatDateForAPI(date),
        displayName: getDateDisplayName(date),
        isToday: date.toDateString() === today.toDateString(),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' })
      });
    }
    return days;
  };

  // Get current title based on the view window
  const getCurrentTitle = () => {
    const centerDate = new Date();
    centerDate.setHours(0, 0, 0, 0);
    centerDate.setDate(centerDate.getDate() + currentDateOffset);
    return centerDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const fiveDays = getFiveDaysToShow();

  // FIXED: Create fallback classes with proper structure
  const fallbackClasses = [
    { id: 'temp-1', name: 'Class 1', order: 0, created_at: '', updated_at: '', user: '' },
    { id: 'temp-2', name: 'Class 2', order: 1, created_at: '', updated_at: '', user: '' },
    { id: 'temp-3', name: 'Class 3', order: 2, created_at: '', updated_at: '', user: '' },
    { id: 'temp-4', name: 'Class 4', order: 3, created_at: '', updated_at: '', user: '' },
    { id: 'temp-5', name: 'Class 5', order: 4, created_at: '', updated_at: '', user: '' },
    { id: 'temp-6', name: 'Class 6', order: 5, created_at: '', updated_at: '', user: '' }
  ];

  // FIXED: Improved display classes logic
  const displayClasses = useMemo(() => {
    if (!isAuthenticated) {
      return fallbackClasses;
    }

    if (!initialized || isLoading) {
      return fallbackClasses;
    }

    if (!classes || classes.length === 0) {
      return fallbackClasses;
    }

    // Sort authenticated classes by order
    return [...classes].sort((a, b) => a.order - b.order);
  }, [isAuthenticated, initialized, isLoading, classes]);

  // Navigation functions for the header
  const handlePrevious = () => {
    setCurrentDateOffset(prev => prev - 1);
  };

  const handleNext = () => {
    setCurrentDateOffset(prev => prev + 1);
  };

  const handleToday = () => {
    setCurrentDateOffset(0);
  };

  // CHANGED: Optimistic stripe pattern toggle
  const handleToggleStripePattern = (classId: string, dateString: string) => {
    if (!isAuthenticated) return;
    
    const cellKey = `${classId}-${dateString}`;
    const isCurrentlyStriped = stripedCells.has(cellKey);
    
    // 1. Immediately update local state for instant UI response
    setLocalNoWorkUpdates(prev => ({
      ...prev,
      [cellKey]: !isCurrentlyStriped
    }));
    
    // 2. Make API call in background
    (async () => {
      try {
        if (isCurrentlyStriped) {
          // Remove the no-work day from backend
          const success = await deleteNoWorkDay(classId, dateString);
          if (success) {
            // Success: remove local update since backend is now updated
            setLocalNoWorkUpdates(prev => {
              const updated = { ...prev };
              delete updated[cellKey];
              return updated;
            });
          } else {
            // Failed: rollback local change
            setLocalNoWorkUpdates(prev => {
              const updated = { ...prev };
              delete updated[cellKey];
              return updated;
            });
            if (setError) setError('Failed to update no-work day');
          }
        } else {
          // Add the no-work day to backend
          const success = await createNoWorkDay({
            planner_class: classId,
            date: dateString
          });
          if (success) {
            // Success: remove local update since backend is now updated
            setLocalNoWorkUpdates(prev => {
              const updated = { ...prev };
              delete updated[cellKey];
              return updated;
            });
          } else {
            // Failed: rollback local change
            setLocalNoWorkUpdates(prev => {
              const updated = { ...prev };
              delete updated[cellKey];
              return updated;
            });
            if (setError) setError('Failed to update no-work day');
          }
        }
      } catch (error) {
        // Error: rollback local change
        setLocalNoWorkUpdates(prev => {
          const updated = { ...prev };
          delete updated[cellKey];
          return updated;
        });
        console.error('Failed to toggle no-work day:', error);
        if (setError) setError('Failed to update no-work day');
      }
    })();
  };

  // FIXED: Only allow drag and drop for authenticated users with real classes
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!isAuthenticated) return;
    
    e.dataTransfer.effectAllowed = 'move';
    setDragState({
      isDragging: true,
      draggedIndex: index,
      dragOverIndex: null
    });
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!isAuthenticated) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    setDragState(prev => ({
      ...prev,
      dragOverIndex: index
    }));
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isAuthenticated) return;
    
    // Only clear dragOverIndex if we're actually leaving the draggable area
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragState(prev => ({
        ...prev,
        dragOverIndex: null
      }));
    }
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    if (!isAuthenticated) return;
    
    e.preventDefault();
    
    const { draggedIndex } = dragState;
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragState({
        isDragging: false,
        draggedIndex: null,
        dragOverIndex: null
      });
      return;
    }

    // Create new order for classes
    const sortedClasses = [...classes].sort((a, b) => a.order - b.order);
    const reorderedClasses = [...sortedClasses];
    const draggedClass = reorderedClasses.splice(draggedIndex, 1)[0];
    reorderedClasses.splice(dropIndex, 0, draggedClass);

    // Update order property for each class
    const updatePromises = reorderedClasses.map((cls, index) => 
      updateClass(cls.id, { order: index })
    );

    try {
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Failed to reorder classes:', error);
    }

    setDragState({
      isDragging: false,
      draggedIndex: null,
      dragOverIndex: null
    });
  };

  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      draggedIndex: null,
      dragOverIndex: null
    });
  };

  // FIXED: Class management handlers - only work when authenticated
  const handleAddClass = async () => {
    if (!isAuthenticated || !newClassName.trim()) return;
    
    const success = await createClass(newClassName.trim());
    if (success) {
      setNewClassName('');
      setShowAddClass(false);
    }
  };

  const handleRemoveClass = (classId: string, className: string) => {
    if (!isAuthenticated) return;
    
    setDeleteConfirmation({
      show: true,
      classId,
      className
    });
  };

  const confirmDeleteClass = async () => {
    if (!isAuthenticated || !deleteConfirmation.classId) return;
    
    await deleteClass(deleteConfirmation.classId);
    setDeleteConfirmation({
      show: false,
      classId: '',
      className: ''
    });
  };

  const cancelDeleteClass = () => {
    setDeleteConfirmation({
      show: false,
      classId: '',
      className: ''
    });
  };

  const startEditingClass = (classId: string, className: string) => {
    if (!isAuthenticated) return;
    
    setEditingClass(classId);
    setEditingClassValue(className);
  };

  const handleUpdateClass = async () => {
    if (!isAuthenticated || !editingClass || !editingClassValue.trim()) return;
    
    const success = await updateClass(editingClass, { name: editingClassValue.trim() });
    if (success) {
      setEditingClass(null);
      setEditingClassValue('');
    }
  };

  const cancelEditingClass = () => {
    setEditingClass(null);
    setEditingClassValue('');
  };

  // FIXED: Assignment management handlers - only work when authenticated
  const handleAddAssignment = (classId: string, dateString: string) => {
    if (!isAuthenticated) return;
    
    const inputKey = `${classId}-${dateString}`;
    setNewAssignmentInputs(prev => ({ ...prev, [inputKey]: '' }));
  };

const handleCreateAssignment = async (classId: string, dateString: string) => {
    if (!isAuthenticated) return;
    
    const inputKey = `${classId}-${dateString}`;
    const title = newAssignmentInputs[inputKey];
    
    if (!title || !title.trim()) {
      // Remove the input without creating assignment
      const updated = { ...newAssignmentInputs };
      delete updated[inputKey];
      setNewAssignmentInputs(updated);
      return;
    }

    // Get the count of existing assignments for this class/date to set order
    const existingAssignments = organizedAssignments[classId]?.[dateString] || [];
    
    const success = await createAssignment({
      title: title.trim(),
      date: dateString,
      planner_class: classId,
      completed: false,
      order: existingAssignments.length
    });

    if (success) {
      // Remove the input field
      const updated = { ...newAssignmentInputs };
      delete updated[inputKey];
      setNewAssignmentInputs(updated);
      
      // If "no work" pattern is enabled for this cell, automatically turn it off
      // since we just added work to this day
      const cellKey = `${classId}-${dateString}`;
      if (stripedCells.has(cellKey)) {
        try {
          await deleteNoWorkDay(classId, dateString);
        } catch (error) {
          console.error('Failed to remove no-work day after adding assignment:', error);
        }
      }
    }
  };

  const handleAssignmentInputChange = (classId: string, dateString: string, value: string) => {
    if (!isAuthenticated) return;
    
    const inputKey = `${classId}-${dateString}`;
    setNewAssignmentInputs(prev => ({ ...prev, [inputKey]: value }));
  };

  const cancelNewAssignment = (classId: string, dateString: string) => {
    if (!isAuthenticated) return;
    
    const inputKey = `${classId}-${dateString}`;
    const updated = { ...newAssignmentInputs };
    delete updated[inputKey];
    setNewAssignmentInputs(updated);
  };

  const handleUpdateAssignment = async () => {
    if (!isAuthenticated || !editingAssignment || !editingAssignmentValue.trim()) return;
    
    const success = await updateAssignment(editingAssignment, { title: editingAssignmentValue.trim() });
    if (success) {
      setEditingAssignment(null);
      setEditingAssignmentValue('');
    }
  };

  const startEditingAssignment = (assignmentId: string, currentTitle: string) => {
    if (!isAuthenticated) return;
    
    setEditingAssignment(assignmentId);
    setEditingAssignmentValue(currentTitle);
  };

  const cancelEditingAssignment = () => {
    setEditingAssignment(null);
    setEditingAssignmentValue('');
  };

  // CHANGED: Optimistic toggle assignment
  const handleToggleAssignment = (assignmentId: string, currentCompleted: boolean) => {
    if (!isAuthenticated) return;
    
    // 1. Immediately update local state for instant UI response
    setLocalAssignmentUpdates(prev => ({
      ...prev,
      [assignmentId]: { completed: !currentCompleted }
    }));
    
    // 2. Make API call in background
    updateAssignment(assignmentId, { completed: !currentCompleted })
      .then(success => {
        if (success) {
          // Success: remove local update since backend is now updated
          setLocalAssignmentUpdates(prev => {
            const updated = { ...prev };
            delete updated[assignmentId];
            return updated;
          });
        } else {
          // Failed: rollback local change
          setLocalAssignmentUpdates(prev => {
            const updated = { ...prev };
            delete updated[assignmentId];
            return updated;
          });
          if (setError) setError('Failed to update assignment');
        }
      })
      .catch(error => {
        // Error: rollback local change
        setLocalAssignmentUpdates(prev => {
          const updated = { ...prev };
          delete updated[assignmentId];
          return updated;
        });
        console.error('Error toggling assignment:', error);
        if (setError) setError('Failed to update assignment');
      });
  };

  // CHANGED: Optimistic delete assignment
  const handleDeleteAssignment = (assignmentId: string) => {
    if (!isAuthenticated) return;
    
    // 1. Immediately mark as deleted for instant UI response
    setLocalAssignmentUpdates(prev => ({
      ...prev,
      [assignmentId]: { deleted: true }
    }));
    
    // 2. Make API call in background
    deleteAssignment(assignmentId)
      .then(success => {
        if (success) {
          // Success: remove local update since backend is now updated
          setLocalAssignmentUpdates(prev => {
            const updated = { ...prev };
            delete updated[assignmentId];
            return updated;
          });
        } else {
          // Failed: rollback local change (show assignment again)
          setLocalAssignmentUpdates(prev => {
            const updated = { ...prev };
            delete updated[assignmentId];
            return updated;
          });
          if (setError) setError('Failed to delete assignment');
        }
      })
      .catch(error => {
        // Error: rollback local change
        setLocalAssignmentUpdates(prev => {
          const updated = { ...prev };
          delete updated[assignmentId];
          return updated;
        });
        console.error('Error deleting assignment:', error);
        if (setError) setError('Failed to delete assignment');
      });
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    } else if (e.key === 'Escape') {
      if (editingClass) cancelEditingClass();
      if (editingAssignment) cancelEditingAssignment();
    }
  };

  // Enhanced getRowHeight function that accounts for text wrapping
  const getRowHeight = (classId: string) => {
    if (!isAuthenticated) return 70; // Default height for fallback classes
    
    let maxHeight = 0;
    
    fiveDays.forEach(day => {
      const dayAssignments = organizedAssignments[classId]?.[day.dateString] || [];
      const hasNewInput = newAssignmentInputs[`${classId}-${day.dateString}`] !== undefined ? 1 : 0;
      
      // Calculate height for this day's column
      let columnHeight = 0;
      
      // Height for existing assignments
      dayAssignments.forEach(assignment => {
        // Estimate height based on text length
        const titleLength = assignment.title?.length || 0;
        
        if (titleLength <= 30) {
          columnHeight += 28; // Single line
        } else if (titleLength <= 60) {
          columnHeight += 40; // Two lines
        } else if (titleLength <= 90) {
          columnHeight += 56; // Three lines
        } else {
          columnHeight += 70; // Four lines or more
        }
      });
      
      // Height for new input if present
      if (hasNewInput) {
        columnHeight += 28; // Default height for input
      }
      
      if (columnHeight > maxHeight) {
        maxHeight = columnHeight;
      }
    });
    
    // Minimum height + padding
    return Math.max(70, maxHeight + 40);
  };

  // Create a mock calendar API for the header navigation
  const mockCalendarApi = {
    prev: handlePrevious,
    next: handleNext,
    today: handleToday,
    changeView: () => {} // Not used in planner
  };

  const mockCalendarRef = {
    current: {
      getApi: () => mockCalendarApi
    }
  };

  // FIXED: Better loading state handling
  if (isAuthenticated && !initialized && isLoading) {
    return (
      <div className="planner-container">
        <CustomCalendarHeader 
          calendarRef={mockCalendarRef}
          currentTitle={getCurrentTitle()} 
          currentView="planner" 
          onViewChange={() => {}} 
          isAuthenticated={isAuthenticated}
          rightSidebarOpen={rightSidebarOpen}
          activeAppView={activeAppView}
          onAppViewChange={onAppViewChange}
        />
        <div className="planner-loading">Loading your classes...</div>
      </div>
    );
  }

  return (
    <div className="planner-container">
      {/* Use the same header as Calendar with navigation functionality */}
      <CustomCalendarHeader 
        calendarRef={mockCalendarRef}
        currentTitle={getCurrentTitle()} 
        currentView="planner" 
        onViewChange={() => {}} 
        isAuthenticated={isAuthenticated}
        rightSidebarOpen={rightSidebarOpen}
        activeAppView={activeAppView}
        onAppViewChange={onAppViewChange}
      />

      {/* Delete Confirmation Modal - only show when authenticated */}
      {isAuthenticated && (
        <DeleteConfirmationModal
          show={deleteConfirmation.show}
          className={deleteConfirmation.className}
          onConfirm={confirmDeleteClass}
          onCancel={cancelDeleteClass}
        />
      )}

      <div className="planner-content">
        <ClassesSidebar
          classes={displayClasses}
          isAuthenticated={isAuthenticated}
          showAddClass={showAddClass}
          newClassName={newClassName}
          editingClass={editingClass}
          editingClassValue={editingClassValue}
          dragState={dragState}
          getRowHeight={getRowHeight}
          onToggleAddClass={setShowAddClass}
          onNewClassNameChange={setNewClassName}
          onCreateClass={handleAddClass}
          onStartEditClass={startEditingClass}
          onUpdateEditClass={setEditingClassValue}
          onSaveEditClass={handleUpdateClass}
          onCancelEditClass={cancelEditingClass}
          onDeleteClass={handleRemoveClass}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onKeyPress={handleKeyPress}
        />

        <PlannerGrid
          classes={displayClasses}
          days={fiveDays}
          organizedAssignments={organizedAssignments}
          isAuthenticated={isAuthenticated}
          dragState={dragState}
          editingAssignment={editingAssignment}
          editingAssignmentValue={editingAssignmentValue}
          newAssignmentInputs={newAssignmentInputs}
          stripedCells={stripedCells}
          getRowHeight={getRowHeight}
          onToggleAssignment={handleToggleAssignment}
          onStartEditAssignment={startEditingAssignment}
          onUpdateAssignmentEdit={setEditingAssignmentValue}
          onSaveAssignmentEdit={handleUpdateAssignment}
          onCancelAssignmentEdit={cancelEditingAssignment}
          onDeleteAssignment={handleDeleteAssignment}
          onAddAssignment={handleAddAssignment}
          onNewAssignmentChange={handleAssignmentInputChange}
          onCreateAssignment={handleCreateAssignment}
          onCancelNewAssignment={cancelNewAssignment}
          onKeyPress={handleKeyPress}
          onToggleStripePattern={handleToggleStripePattern}
        />
      </div>
    </div>
  );
};

export default Planner;