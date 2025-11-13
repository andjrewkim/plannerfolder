import React, { useState, useRef, useMemo, useEffect } from 'react';
import CustomCalendarHeader from '../CustomCalHeader';
import { usePlanner } from '../../hooks/usePlanner';
import { useStreaks } from '../../contexts/useStreaks';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import ClassesSidebar from './ClassesSidebar';
import PlannerGrid from './PlannerGrid';
import { PostHog } from 'posthog-js';

import '../../styles/planner.css';

type ViewType = 'calendar' | 'your-new-view';

export interface PlannerProps {
  rightSidebarOpen?: boolean;
  activeAppView?: ViewType;
  onAppViewChange?: (newView: ViewType) => void;
  isAuthenticated?: boolean;
  settingsUnlocked: boolean;
  posthog?: PostHog;
}

interface DragState {
  isDragging: boolean;
  draggedIndex: number | null;
  dragOverIndex: number | null;
}

const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      if (width <= 768) {
        setScreenSize('mobile');
      } else if (width <= 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return screenSize;
};

const Planner: React.FC<PlannerProps> = ({
  rightSidebarOpen = false,
  activeAppView = 'your-new-view',
  onAppViewChange,
  isAuthenticated = false,
  settingsUnlocked = false,
  posthog,
}) => {
  const screenSize = useScreenSize();
  
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
    createNoWorkDay,
    deleteNoWorkDay,
    noWorkDays,
    setError
  } = usePlanner();

  const [newClassName, setNewClassName] = useState('');
  const [showAddClass, setShowAddClass] = useState(false);
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [editingClassValue, setEditingClassValue] = useState('');
  const [editingAssignment, setEditingAssignment] = useState<{id: string; date: string} | null>(null);
  const [editingAssignmentValue, setEditingAssignmentValue] = useState('');
  
  const [newAssignmentInputs, setNewAssignmentInputs] = useState<Record<string, {
    title: string;
    startDate: string;
    endDate: string;
  }>>({});
  
  const { updateStreakForAction, hasUpdatedToday } = useStreaks();
  
  const [localAssignmentUpdates, setLocalAssignmentUpdates] = useState<Record<string, { completed?: boolean; deleted?: boolean }>>({});
  const [localNoWorkUpdates, setLocalNoWorkUpdates] = useState<Record<string, boolean>>({});
  const [currentDateOffset, setCurrentDateOffset] = useState(0);

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedIndex: null,
    dragOverIndex: null
  });

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    classId: string;
    className: string;
  }>({
    show: false,
    classId: '',
    className: ''
  });

  const dummyCalendarRef = useRef(null);

  // Helper functions - defined before useMemo hooks that use them
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateDisplayName = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  };

  const getDaysToShow = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let daysCount: number;
    let startOffset: number;
    
    switch (screenSize) {
      case 'mobile':
        daysCount = 2;
        startOffset = currentDateOffset;
        break;
      case 'tablet':
        daysCount = 3;
        startOffset = currentDateOffset - 1;
        break;
      default:
        daysCount = 5;
        startOffset = currentDateOffset - 1;
        break;
    }

    const startDate = new Date(today);
    startDate.setDate(today.getDate() + startOffset);

    const days = [];
    for (let i = 0; i < daysCount; i++) {
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

  const isAssignmentActiveOnDate = (assignment: any, dateString: string): boolean => {
    if (!assignment.start_date || !assignment.end_date) {
      return assignment.date === dateString;
    }
    return assignment.start_date <= dateString && dateString <= assignment.end_date;
  };

  const stripedCells = useMemo(() => {
    if (!isAuthenticated) return new Set<string>();
    
    const cellSet = new Set<string>();
    
    if (noWorkDays) {
      noWorkDays.forEach(noWorkDay => {
        const cellKey = `${noWorkDay.planner_class}-${noWorkDay.date}`;
        cellSet.add(cellKey);
      });
    }
    
    Object.entries(localNoWorkUpdates).forEach(([cellKey, isNoWork]) => {
      if (isNoWork) {
        cellSet.add(cellKey);
      } else {
        cellSet.delete(cellKey);
      }
    });
    
    return cellSet;
  }, [isAuthenticated, noWorkDays, localNoWorkUpdates]);

  const organizedAssignments = useMemo(() => {
    if (!isAuthenticated) return {};
    
    const baseAssignments = getAssignmentsByClassAndDate();
    const updatedAssignments: typeof baseAssignments = {};
    
    const displayDates = getDaysToShow().map(day => day.dateString);
    
    for (const [classId, dateAssignments] of Object.entries(baseAssignments)) {
      updatedAssignments[classId] = {};
      
      displayDates.forEach(dateString => {
        updatedAssignments[classId][dateString] = [];
      });
      
      const allClassAssignments = Object.values(dateAssignments).flat();
      
      allClassAssignments.forEach(assignment => {
        displayDates.forEach(dateString => {
          if (isAssignmentActiveOnDate(assignment, dateString)) {
            const localUpdate = localAssignmentUpdates[assignment.id];
            if (localUpdate?.deleted) return;
            
            const updatedAssignment = {
              ...assignment,
              ...(localUpdate?.completed !== undefined && { completed: localUpdate.completed })
            };
            
            updatedAssignments[classId][dateString].push(updatedAssignment);
          }
        });
      });
      
      displayDates.forEach(dateString => {
        const seen = new Set();
        updatedAssignments[classId][dateString] = updatedAssignments[classId][dateString]
          .filter(a => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
          })
          .sort((a, b) => a.order - b.order);
      });
    }
    
    return updatedAssignments;
  }, [isAuthenticated, getAssignmentsByClassAndDate, localAssignmentUpdates, currentDateOffset, screenSize]);

  const getCurrentTitle = () => {
    const centerDate = new Date();
    centerDate.setHours(0, 0, 0, 0);
    centerDate.setDate(centerDate.getDate() + currentDateOffset);
    return centerDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const daysToShow = getDaysToShow();

  useEffect(() => {
    const root = document.documentElement;
    const columnsCount = daysToShow.length;
    const todayColumnIndex = daysToShow.findIndex(day => day.isToday);
    
    root.style.setProperty('--grid-columns', columnsCount.toString());
    root.style.setProperty('--today-column-index', todayColumnIndex.toString());
  }, [daysToShow]);

  const fallbackClasses = [
    { id: 'temp-1', name: 'Class 1', order: 0, created_at: '', updated_at: '', user: '' },
    { id: 'temp-2', name: 'Class 2', order: 1, created_at: '', updated_at: '', user: '' },
    { id: 'temp-3', name: 'Class 3', order: 2, created_at: '', updated_at: '', user: '' },
    { id: 'temp-4', name: 'Class 4', order: 3, created_at: '', updated_at: '', user: '' },
    { id: 'temp-5', name: 'Class 5', order: 4, created_at: '', updated_at: '', user: '' },
    { id: 'temp-6', name: 'Class 6', order: 5, created_at: '', updated_at: '', user: '' }
  ];

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

    return [...classes].sort((a, b) => a.order - b.order);
  }, [isAuthenticated, initialized, isLoading, classes]);

  const handlePrevious = () => {
    setCurrentDateOffset(prev => prev - 1);
  };

  const handleNext = () => {
    setCurrentDateOffset(prev => prev + 1);
  };

  const handleToday = () => {
    setCurrentDateOffset(0);
  };

  const handleToggleStripePattern = async (classId: string, dateString: string) => {
    if (!isAuthenticated) return;
    
    const cellKey = `${classId}-${dateString}`;
    const isCurrentlyStriped = stripedCells.has(cellKey);
    
    setLocalNoWorkUpdates(prev => ({
      ...prev,
      [cellKey]: !isCurrentlyStriped
    }));
    
    if (!isCurrentlyStriped && !hasUpdatedToday) {
      await updateStreakForAction();
    }
    
    try {
      if (isCurrentlyStriped) {
        const success = await deleteNoWorkDay(classId, dateString);
        if (!success && setError) {
          setError('Failed to update no-work day');
        }
      } else {
        const success = await createNoWorkDay({
          planner_class: classId,
          date: dateString
        });
        if (!success && setError) {
          setError('Failed to update no-work day');
        }
      }
      
      setLocalNoWorkUpdates(prev => {
        const updated = { ...prev };
        delete updated[cellKey];
        return updated;
      });
    } catch (error) {
      setLocalNoWorkUpdates(prev => {
        const updated = { ...prev };
        delete updated[cellKey];
        return updated;
      });
      console.error('Failed to toggle no-work day:', error);
      if (setError) setError('Failed to update no-work day');
    }
  };

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

    const sortedClasses = [...classes].sort((a, b) => a.order - b.order);
    const reorderedClasses = [...sortedClasses];
    const draggedClass = reorderedClasses.splice(draggedIndex, 1)[0];
    reorderedClasses.splice(dropIndex, 0, draggedClass);

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

  const handleAddAssignment = (classId: string, dateString: string) => {
    if (!isAuthenticated) return;
    
    const inputKey = `${classId}-${dateString}`;
    setNewAssignmentInputs(prev => ({ 
      ...prev, 
      [inputKey]: {
        title: '',
        startDate: dateString,
        endDate: dateString
      }
    }));
  };

  const handleCreateAssignment = async (classId: string, dateString: string) => {
    if (!isAuthenticated) return;
    
    const inputKey = `${classId}-${dateString}`;
    const assignmentData = newAssignmentInputs[inputKey];
    
    if (!assignmentData || !assignmentData.title.trim()) {
      const updated = { ...newAssignmentInputs };
      delete updated[inputKey];
      setNewAssignmentInputs(updated);
      return;
    }

    const existingAssignments = organizedAssignments[classId]?.[dateString] || [];
    
    if (!hasUpdatedToday) {
      await updateStreakForAction();
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const success = await createAssignment({
      title: assignmentData.title.trim(),
      start_date: assignmentData.startDate,
      end_date: assignmentData.endDate,
      planner_class: classId,
      completed: false,
      order: existingAssignments.length
    });

    if (success) {
      const updated = { ...newAssignmentInputs };
      delete updated[inputKey];
      setNewAssignmentInputs(updated);
      
      const startDate = new Date(assignmentData.startDate);
      const endDate = new Date(assignmentData.endDate);
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const cellKey = `${classId}-${formatDateForAPI(currentDate)}`;
        if (stripedCells.has(cellKey)) {
          try {
            await deleteNoWorkDay(classId, formatDateForAPI(currentDate));
          } catch (error) {
            console.error('Failed to remove no-work day:', error);
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    if (success && posthog) {
      posthog.capture('assignment_created', {
        class_id: classId,
        start_date: assignmentData.startDate,
        end_date: assignmentData.endDate,
        is_multi_day: assignmentData.startDate !== assignmentData.endDate,
        has_title: !!assignmentData.title.trim(),
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleAssignmentInputChange = (classId: string, dateString: string, field: 'title' | 'startDate' | 'endDate', value: string) => {
    if (!isAuthenticated) return;
    
    const inputKey = `${classId}-${dateString}`;
    const currentInput = newAssignmentInputs[inputKey];
    
    let updatedInput = {
      ...currentInput,
      [field]: value
    };
    
    if (field === 'startDate' && value > updatedInput.endDate) {
      updatedInput.endDate = value;
    } else if (field === 'endDate' && value < updatedInput.startDate) {
      updatedInput.endDate = updatedInput.startDate;
    }
    
    setNewAssignmentInputs(prev => ({
      ...prev,
      [inputKey]: updatedInput
    }));
  };

  const cancelNewAssignment = (classId: string, dateString: string) => {
    if (!isAuthenticated) return;
    
    const inputKey = `${classId}-${dateString}`;
    const updated = { ...newAssignmentInputs };
    delete updated[inputKey];
    setNewAssignmentInputs(updated);
  };

  // Update handleUpdateAssignment:
  const handleUpdateAssignment = async () => {
    if (!isAuthenticated || !editingAssignment || !editingAssignmentValue.trim()) return;
    
    const success = await updateAssignment(editingAssignment.id, { title: editingAssignmentValue.trim() });
    if (success) {
      setEditingAssignment(null);
      setEditingAssignmentValue('');
    }
  };


  // Update startEditingAssignment:
  const startEditingAssignment = (assignmentId: string, currentTitle: string, dateString: string) => {
    if (!isAuthenticated) return;
    
    setEditingAssignment({ id: assignmentId, date: dateString });
    setEditingAssignmentValue(currentTitle);
  };

  // Update cancelEditingAssignment:
  const cancelEditingAssignment = () => {
    setEditingAssignment(null);
    setEditingAssignmentValue('');
  };


  const handleToggleAssignment = (assignmentId: string, currentCompleted: boolean) => {
    if (!isAuthenticated) return;
    
    setLocalAssignmentUpdates(prev => ({
      ...prev,
      [assignmentId]: { completed: !currentCompleted }
    }));
    
    updateAssignment(assignmentId, { completed: !currentCompleted })
      .then(success => {
        if (success) {
          setLocalAssignmentUpdates(prev => {
            const updated = { ...prev };
            delete updated[assignmentId];
            return updated;
          });
        } else {
          setLocalAssignmentUpdates(prev => {
            const updated = { ...prev };
            delete updated[assignmentId];
            return updated;
          });
          if (setError) setError('Failed to update assignment');
        }
      })
      .catch(error => {
        setLocalAssignmentUpdates(prev => {
          const updated = { ...prev };
          delete updated[assignmentId];
          return updated;
        });
        console.error('Error toggling assignment:', error);
        if (setError) setError('Failed to update assignment');
      });
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    if (!isAuthenticated) return;
    
    setLocalAssignmentUpdates(prev => ({
      ...prev,
      [assignmentId]: { deleted: true }
    }));
    
    deleteAssignment(assignmentId)
      .then(success => {
        if (success) {
          setLocalAssignmentUpdates(prev => {
            const updated = { ...prev };
            delete updated[assignmentId];
            return updated;
          });
        } else {
          setLocalAssignmentUpdates(prev => {
            const updated = { ...prev };
            delete updated[assignmentId];
            return updated;
          });
        }
      })
      .catch(error => {
        setLocalAssignmentUpdates(prev => {
          const updated = { ...prev };
          delete updated[assignmentId];
          return updated;
        });
        console.error('Error deleting assignment:', error);
      });
  };

  // Update handleKeyPress to handle Escape properly:
  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    } else if (e.key === 'Escape') {
      if (editingClass) cancelEditingClass();
      if (editingAssignment) cancelEditingAssignment();
    }
  };

  const handleUpdateAssignmentDateRange = async (assignmentId: string, newEndDate: string) => {
    if (!isAuthenticated) return;
    
    console.log('Updating assignment:', assignmentId, 'to end date:', newEndDate);
    
    const success = await updateAssignment(assignmentId, { 
      end_date: newEndDate 
    });
    
    if (!success && setError) {
      setError('Failed to update assignment date range');
    }
  };


  const getRowHeight = (classId: string) => {
    if (!isAuthenticated) return 70;

    const measureTextWidth = (text: string, font = "14px Inter, sans-serif") => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return text.length * 8; // fallback
      context.font = font;
      return context.measureText(text).width;
    };

    const containerWidth = 151; // adjust to your grid column width
    let maxHeight = 0;

    daysToShow.forEach(day => {
      const dayAssignments = organizedAssignments[classId]?.[day.dateString] || [];
      const hasNewInput = newAssignmentInputs[`${classId}-${day.dateString}`] !== undefined ? 1 : 0;

      let columnHeight = 0;

      dayAssignments.forEach(assignment => {
        const title = assignment.title || "";
        const textWidth = measureTextWidth(title);
        const lineHeight = 24;
        const lineCount = Math.ceil(textWidth / containerWidth);
        const assignmentHeight = 0 + lineCount * lineHeight;
        columnHeight += assignmentHeight;
      });

      if (hasNewInput) {
        columnHeight += 27;
      }

      if (columnHeight > maxHeight) {
        maxHeight = columnHeight;
      }
    });

    // Base padding for header/margins
    return Math.max(70, maxHeight + 40);
  };

  const mockCalendarApi = {
    prev: handlePrevious,
    next: handleNext,
    today: handleToday,
    changeView: () => {}
  };

  const mockCalendarRef = {
    current: {
      getApi: () => mockCalendarApi
    }
  };

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
          currentStreak={5}
          maxStreak={7}
          isStreakLit={false}
        />
      </div>
    );
  }

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
          days={daysToShow}
          organizedAssignments={organizedAssignments}
          isAuthenticated={isAuthenticated}
          settingsUnlocked={settingsUnlocked}
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
          onUpdateDateRange={handleUpdateAssignmentDateRange}

        />
      </div>
    </div>
  );
};

export default Planner;