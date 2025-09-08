import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Edit2, FileText, List } from 'lucide-react';
import { useNotes } from '../hooks/useNotes';

// Define types for the component
interface Note {
  id: number;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

const NotesComponent: React.FC = () => {
  const {
    notes,
    loading,
    error,
    activeNoteId,
    activeNote,
    saveStatus,
    lastSaved,
    createNote,
    updateNote,
    deleteNote,
    setActiveNote,
    updateActiveNoteContent,
    updateActiveNoteTitle
  } = useNotes();

  const [isEditingTitle, setIsEditingTitle] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addNewTab = async (): Promise<void> => {
    const newNote = await createNote({
      title: "New Note",
      content: ""
    });
  };

  const removeTab = async (noteId: number): Promise<void> => {
    if (notes.length === 1) return;
    await deleteNote(noteId);
  };

  const updateTabContent = (content: string): void => {
    setHasUnsavedChanges(true);
    updateActiveNoteContent(content);
  };

  // Track when content is saved
  useEffect(() => {
    if (saveStatus === 'saved') {
      setHasUnsavedChanges(false);
    }
  }, [saveStatus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;

    if (e.key === 'Tab') {
      e.preventDefault();
      
      // Get current line
      const lines = value.split('\n');
      const beforeCursor = value.slice(0, selectionStart);
      const lineIndex = beforeCursor.split('\n').length - 1;
      const currentLine = lines[lineIndex];
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const cursorPosInLine = selectionStart - lineStart;

      if (e.shiftKey) {
        // Remove bullet point (Shift+Tab)
        if (currentLine.startsWith('• ')) {
          const newLine = currentLine.slice(2);
          const newLines = [...lines];
          newLines[lineIndex] = newLine;
          const newContent = newLines.join('\n');
          updateTabContent(newContent);
          
          // Maintain cursor position
          setTimeout(() => {
            const newCursorPos = selectionStart - 2;
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, newCursorPos);
          }, 0);
        }
      } else {
        // Add bullet point (Tab at start of line or empty line)
        if (cursorPosInLine === 0 || currentLine.trim() === '') {
          const newLine = '• ' + currentLine;
          const newLines = [...lines];
          newLines[lineIndex] = newLine;
          const newContent = newLines.join('\n');
          updateTabContent(newContent);
          
          // Move cursor after bullet
          setTimeout(() => {
            const newCursorPos = lineStart + 2;
            textarea.selectionStart = textarea.selectionEnd = newCursorPos;
          }, 0);
        }
      }
    } else if (e.key === 'Enter') {
      const lines = value.split('\n');
      const beforeCursor = value.slice(0, selectionStart);
      const lineIndex = beforeCursor.split('\n').length - 1;
      const currentLine = lines[lineIndex];

      if (currentLine.startsWith('• ')) {
        e.preventDefault();
        
        const bulletContent = currentLine.slice(2);
        
        if (bulletContent.trim() === '') {
          // Empty bullet point - remove it and don't add new bullet
          const newLines = [...lines];
          newLines[lineIndex] = '';
          const newContent = newLines.join('\n');
          updateTabContent(newContent);
          
          setTimeout(() => {
            const lineStart = newContent.split('\n').slice(0, lineIndex).join('\n').length;
            const newPos = lineStart + (lineIndex > 0 ? 1 : 0);
            textarea.selectionStart = textarea.selectionEnd = newPos;
          }, 0);
        } else {
          // Add new bullet point on next line
          const beforeLine = value.slice(0, selectionStart);
          const afterLine = value.slice(selectionStart);
          const newContent = beforeLine + '\n• ' + afterLine;
          updateTabContent(newContent);
          
          setTimeout(() => {
            const newPos = selectionStart + 3; // +1 for \n, +2 for "• "
            textarea.selectionStart = textarea.selectionEnd = newPos;
          }, 0);
        }
      }
    } else if (e.key === 'Backspace') {
      // Handle backspace at start of bullet line
      const lines = value.split('\n');
      const beforeCursor = value.slice(0, selectionStart);
      const lineIndex = beforeCursor.split('\n').length - 1;
      const currentLine = lines[lineIndex];
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const cursorPosInLine = selectionStart - lineStart;

      if (currentLine.startsWith('• ') && cursorPosInLine === 2 && selectionStart === selectionEnd) {
        e.preventDefault();
        // Remove bullet point
        const newLine = currentLine.slice(2);
        const newLines = [...lines];
        newLines[lineIndex] = newLine;
        const newContent = newLines.join('\n');
        updateTabContent(newContent);
        
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = lineStart;
        }, 0);
      }
    }
  };

  const addBulletPoint = (): void => {
    if (!activeNote || !textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const { selectionStart, value } = textarea;
    
    // Get current line
    const lines = value.split('\n');
    const beforeCursor = value.slice(0, selectionStart);
    const lineIndex = beforeCursor.split('\n').length - 1;
    const currentLine = lines[lineIndex];
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    
    let newLines = [...lines];
    let newCursorPos = selectionStart;
    
    if (currentLine.startsWith('• ')) {
      // Remove bullet point
      newLines[lineIndex] = currentLine.slice(2);
      newCursorPos = Math.max(lineStart, selectionStart - 2);
    } else {
      // Add bullet point
      newLines[lineIndex] = '• ' + currentLine;
      newCursorPos = selectionStart + 2;
    }
    
    const newContent = newLines.join('\n');
    updateTabContent(newContent);
    
    // Maintain cursor position
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
      textarea.focus();
    }, 0);
  };

  const startEditingTitle = (noteId: number, currentTitle: string): void => {
    setIsEditingTitle(noteId);
    setEditTitle(currentTitle);
  };

  const saveTitle = async (noteId: number): Promise<void> => {
    const title = editTitle.trim() || "Untitled";
    await updateNote(noteId, { title });
    setIsEditingTitle(null);
    setEditTitle("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, noteId: number): void => {
    if (e.key === 'Enter') saveTitle(noteId);
    if (e.key === 'Escape') setIsEditingTitle(null);
  };

  const handleMouseEnter = (element: HTMLElement, styles: React.CSSProperties): void => {
    Object.assign(element.style, styles);
  };

  const handleMouseLeave = (element: HTMLElement, styles: React.CSSProperties): void => {
    Object.assign(element.style, styles);
  };

  // Show loading state
  if (loading && notes.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: '600px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(var(--card))',
        color: 'hsl(var(--foreground))'
      }}>

      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div style={{
        width: '100%',
        height: '600px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(var(--card))',
        color: 'hsl(var(--destructive))'
      }}>
        <p>Error loading notes: {error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '8px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '743px',
      background: 'hsl(var(--card))',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
      color: 'hsl(var(--foreground))',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Add CSS for animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      {/* Header */}
      <div style={{
        padding: '4px 12px',
        background: 'hsl(var(--calendar-background))',
        borderBottom: '1px solid hsl(var(--border) / 0.5)',
        borderTop: '1px solid hsl(var(--border) / 0.5)',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          content: '',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none'
        }}></div>
        <h1 style={{
          fontSize: 'clamp(18px, 2.5vw, 28px)',
          fontWeight: 600,
          margin: 0,
          color: 'hsl(var(--foreground))',
          letterSpacing: '-0.025em',
        }}>
          Notes
        </h1>
      </div>

      {/* Content */}
      <div style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Sidebar */}
        <div style={{
          width: 'clamp(120px, 15vw, 160px)',
          background: 'hsl(var(--sidebar))',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Sidebar Header */}
          <div style={{
            padding: '8px 10px',
            borderBottom: '1px solid hsl(var(--border) / 0.5)',
            flexShrink: 0,
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            background: 'hsl(var(--sidebar))',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%'
            }}>
              <h2 style={{
                fontSize: 'clamp(11px, 1.2vw, 14px)',
                fontWeight: 600,
                margin: 0,
                color: 'hsl(var(--foreground))'
              }}>
                Notes
              </h2>
              <button
                onClick={addNewTab}
                disabled={loading}
                style={{
                  width: '18px',
                  height: '18px',
                  border: '1px solid hsl(var(--primary) / 0.2)',
                  background: 'hsl(var(--real-background))',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '18px',
                  color: 'hsl(var(--accent))',
                  fontWeight: 500,
                  transition: 'transform 0.15s ease',
                  opacity: loading ? 0.5 : 1
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
              >
                +
              </button>
            </div>
          </div>

          {/* Tabs List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {notes.length === 0 ? (
              <div style={{
                padding: '20px 10px',
                textAlign: 'center',
                color: 'hsl(var(--muted-foreground))',
                fontSize: '12px'
              }}>
                No notes yet. Click + to create one!
              </div>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderBottom: '1px solid hsl(var(--border) / 0.5)',
                    transition: 'background-color 0.15s ease',
                    background: activeNoteId === note.id ? 'hsl(var(--secondary) / 0.15)' : 'hsl(var(--sidebar))',
                    borderLeft: activeNoteId === note.id ? '4px solid hsl(var(--primary))' : '1px solid transparent',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveNote(note.id)}
                  onMouseEnter={(e) => {
                    if (activeNoteId !== note.id) {
                      e.currentTarget.style.background = 'hsl(var(--secondary) / 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeNoteId !== note.id) {
                      e.currentTarget.style.background = 'hsl(var(--sidebar))';
                    }
                  }}
                >
                  {isEditingTitle === note.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => saveTitle(note.id)}
                      onKeyDown={(e) => handleInputKeyDown(e, note.id)}
                      style={{
                        flex: 1,
                        background: 'hsl(var(--background))',
                        fontSize: 'clamp(11px, 1.2vw, 14px)',
                        fontWeight: 500,
                        color: 'hsl(var(--foreground))',
                        padding: '2px 4px',
                        outline: 'none',
                        width: '100%',
                        borderRadius: '3px',
                        border: 'none'
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: 'clamp(11px, 1.2vw, 14px)',
                        fontWeight: 500,
                        color: 'hsl(var(--foreground))',
                        flex: 1,
                        cursor: 'pointer',
                        padding: '2px 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {note.title}
                    </span>
                  )}
                  
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditingTitle(note.id, note.title);
                      }}
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '1px solid hsl(var(--border) / 0.5)',
                        background: 'hsl(var(--background))',
                        color: 'hsl(var(--muted-foreground))',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '3px',
                        fontSize: '10px',
                        opacity: 0,
                        transition: 'all 0.15s ease',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'hsl(var(--primary)/0.1)';
                        e.currentTarget.style.color = 'hsl(var(--primary-foreground))';
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'hsl(var(--background))';
                        e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
                        e.currentTarget.style.borderColor = 'hsl(var(--border) / 0.5)';
                      }}
                    >
                      <Edit2 size={10} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTab(note.id);
                      }}
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '1px solid hsl(var(--border) / 0.5)',
                        background: 'hsl(var(--background))',
                        color: 'hsl(var(--muted-foreground))',
                        cursor: 'pointer',
                        display: notes.length > 1 ? 'flex' : 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '3px',
                        fontSize: '12px',
                        opacity: 0,
                        transition: 'all 0.15s ease',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'hsl(var(--destructive))';
                        e.currentTarget.style.color = 'hsl(var(--destructive-foreground))';
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.borderColor = 'hsl(var(--destructive))';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'hsl(var(--background))';
                        e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
                        e.currentTarget.style.borderColor = 'hsl(var(--border) / 0.5)';
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden'
        }}>
          {/* Content Header */}
          <div style={{
            display: 'flex',
            background: 'hsl(var(--calendar-background))',
            borderBottom: '1px solid hsl(var(--border) / 0.5)',
            borderLeft: '1px solid hsl(var(--border) / 0.5)',
            borderRight: '1px solid hsl(var(--border) / 0.5)',
            flexShrink: 0,
            height: '38px'
          }}>
            <div style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'clamp(10px, 1.1vw, 13px)',
              fontWeight: 600,
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'hsl(var(--sidebar))',
              transition: 'all 0.2s ease',
              position: 'relative',
              flex: 1,
              width: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>
                  {activeNote?.title || 'Select a note'}
                </span>
                
                {/* Bullet Point Button */}
                {activeNote && (
                  <button
                    onClick={addBulletPoint}
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '1px solid hsl(var(--border) / 0.5)',
                      background: 'hsl(var(--background))',
                      color: 'hsl(var(--muted-foreground))',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '3px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'hsl(var(--primary)/0.1)';
                      e.currentTarget.style.color = 'hsl(var(--primary))';
                      e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'hsl(var(--background))';
                      e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
                      e.currentTarget.style.borderColor = 'hsl(var(--border) / 0.5)';
                    }}
                    title="Toggle bullet point (Tab)"
                  >
                    <List size={12} />
                  </button>
                )}
              </div>
              
              {/* Save Status */}
              {activeNote && (
                <div style={{
                  fontSize: 'clamp(12px, 1.3vw, 14px)',
                  color: (hasUnsavedChanges || saveStatus === 'saving') ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))',
                  fontWeight: 500,
                  textTransform: 'none',
                  letterSpacing: 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {(hasUnsavedChanges || saveStatus === 'saving') ? (
                    <>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        border: '2px solid transparent',
                        borderTop: '2px solid currentColor',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Saving...
                    </>
                  ) : (
                    'Saved ✓'
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content Body */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            background: 'hsl(var(--calendar-background))',
            scrollbarWidth: 'thin',
            scrollbarColor: 'hsl(var(--muted-foreground) / 0.4) hsl(var(--muted) / 0.1)',
            border: '1px solid hsl(var(--border) / 0.5)',
            borderTop: 'none'
          }}>
            <div style={{
              background: 'hsl(var(--real-sidebar))',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              height: '100%',
              boxSizing: 'border-box'
            }}>
              {activeNote ? (
                <textarea
                  ref={textareaRef}
                  value={activeNote.content}
                  onChange={(e) => updateTabContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Start writing your notes here..."
                  style={{
                    width: '100%',
                    height: '100%',
                    resize: 'none',
                    outline: 'none',
                    fontSize: 'clamp(14px, 1.4vw, 16px)',
                    lineHeight: '1.5',
                    background: 'transparent',
                    color: 'hsl(var(--foreground))',
                    fontFamily: 'inherit',
                    padding: '8px',
                    borderRadius: '4px',
                    border: 'none'
                  }}
                />
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: '16px'
                }}>
                  {notes.length === 0 ? 'Create your first note!' : 'Select a note to start writing'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesComponent;