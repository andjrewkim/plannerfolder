import { useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../../lib/auth'; // Adjust path based on your project structure

export interface NoteTab {
  id: number;
  title: string;
  content: string;
  order: number;
  user?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateNoteData {
  title: string;
  content?: string;
  order?: number;
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  order?: number;
}

interface UseNotesReturn {
  notes: NoteTab[];
  loading: boolean;
  error: string | null;
  activeNoteId: number | null;
  activeNote: NoteTab | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  
  // Actions
  fetchNotes: () => Promise<void>;
  createNote: (data: CreateNoteData) => Promise<NoteTab | null>;
  updateNote: (id: number, data: UpdateNoteData) => Promise<NoteTab | null>;
  deleteNote: (id: number) => Promise<boolean>;
  setActiveNote: (id: number | null) => void;
  reorderNotes: (notes: NoteTab[]) => Promise<void>;
  
  // Convenience methods
  updateActiveNoteContent: (content: string) => void;
  updateActiveNoteTitle: (title: string) => Promise<void>;
}

export const useNotes = (): UseNotesReturn => {
  const [notes, setNotes] = useState<NoteTab[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Refs for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<string | null>(null);

  const activeNote = notes.find(note => note.id === activeNoteId) || null;

  // Debounced save function
  const debouncedSave = useCallback(async (noteId: number, content: string) => {
    try {
      setSaveStatus('saving');
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/notes/${noteId}/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save note: ${response.status}`);
      }

      const updatedNote = await response.json();
      setNotes(prev => 
        prev.map(note => 
          note.id === noteId ? updatedNote : note
        )
      );
      
      setSaveStatus('saved');
      setLastSaved(new Date());
      
      // Keep saved status permanently (remove the timeout)
      
    } catch (err) {
      console.error('Failed to save note:', err);
      setSaveStatus('error');
      // Keep error status for 5 seconds, then go to idle
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const clearError = () => setError(null);

  const handleError = (err: any, defaultMessage: string) => {
    console.error(defaultMessage, err);
    setError(err?.message || defaultMessage);
  };

  // Fetch all notes
  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/notes/`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.status}`);
      }

      const data = await response.json();
      const sortedNotes = data.sort((a: NoteTab, b: NoteTab) => a.order - b.order);
      setNotes(sortedNotes);

      // Set first note as active if none is selected and notes exist
      if (!activeNoteId && sortedNotes.length > 0) {
        setActiveNoteId(sortedNotes[0].id);
      }
    } catch (err) {
      handleError(err, 'Failed to fetch notes');
    } finally {
      setLoading(false);
    }
  }, [activeNoteId]);

  // Create a new note
  const createNote = useCallback(async (data: CreateNoteData): Promise<NoteTab | null> => {
    try {
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/notes/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: data.title,
            content: data.content || '',
            order: data.order ?? Math.max(...notes.map(n => n.order), 0) + 1,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create note: ${response.status}`);
      }

      const newNote = await response.json();
      setNotes(prev => [...prev, newNote].sort((a, b) => a.order - b.order));
      setActiveNoteId(newNote.id);
      
      return newNote;
    } catch (err) {
      handleError(err, 'Failed to create note');
      return null;
    }
  }, [notes]);

  // Update a note
  const updateNote = useCallback(async (id: number, data: UpdateNoteData): Promise<NoteTab | null> => {
    try {
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/notes/${id}/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update note: ${response.status}`);
      }

      const updatedNote = await response.json();
      setNotes(prev => 
        prev.map(note => 
          note.id === id ? updatedNote : note
        ).sort((a, b) => a.order - b.order)
      );
      
      return updatedNote;
    } catch (err) {
      handleError(err, 'Failed to update note');
      return null;
    }
  }, []);

  // Delete a note
  const deleteNote = useCallback(async (id: number): Promise<boolean> => {
    try {
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/notes/${id}/`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete note: ${response.status}`);
      }

      setNotes(prev => prev.filter(note => note.id !== id));
      
      // If we deleted the active note, switch to another one
      if (activeNoteId === id) {
        const remainingNotes = notes.filter(note => note.id !== id);
        setActiveNoteId(remainingNotes.length > 0 ? remainingNotes[0].id : null);
      }
      
      return true;
    } catch (err) {
      handleError(err, 'Failed to delete note');
      return false;
    }
  }, [notes, activeNoteId]);

  // Set active note
  const setActiveNote = useCallback((id: number | null) => {
    setActiveNoteId(id);
  }, []);

  // Reorder notes (batch update)
  const reorderNotes = useCallback(async (reorderedNotes: NoteTab[]) => {
    try {
      clearError();
      
      // Update order values
      const notesWithNewOrder = reorderedNotes.map((note, index) => ({
        ...note,
        order: index
      }));

      // Send batch update requests (you might want to implement a batch endpoint)
      const updatePromises = notesWithNewOrder.map(note =>
        authAPI.authenticatedFetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/notes/${note.id}/`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ order: note.order }),
          }
        )
      );

      await Promise.all(updatePromises);
      setNotes(notesWithNewOrder);
    } catch (err) {
      handleError(err, 'Failed to reorder notes');
      // Revert to original order by refetching
      fetchNotes();
    }
  }, [fetchNotes]);

  // Convenience method to update active note content with debouncing
  const updateActiveNoteContent = useCallback((content: string) => {
    if (!activeNoteId) return;
    
    // Immediate optimistic update
    setNotes(prev =>
      prev.map(note =>
        note.id === activeNoteId ? { ...note, content } : note
      )
    );

    // Store the content for debounced save
    pendingContentRef.current = content;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for saving (1 second delay)
    saveTimeoutRef.current = setTimeout(() => {
      if (pendingContentRef.current !== null) {
        debouncedSave(activeNoteId, pendingContentRef.current);
        pendingContentRef.current = null;
      }
    }, 1000);
  }, [activeNoteId, debouncedSave]);

  // Convenience method to update active note title
  const updateActiveNoteTitle = useCallback(async (title: string) => {
    if (!activeNoteId) return;
    
    await updateNote(activeNoteId, { title });
  }, [activeNoteId, updateNote]);

  // Fetch notes on mount
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return {
    notes,
    loading,
    error,
    activeNoteId,
    activeNote,
    saveStatus,
    lastSaved,
    
    // Actions
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    setActiveNote,
    reorderNotes,
    
    // Convenience methods
    updateActiveNoteContent,
    updateActiveNoteTitle,
  };
};