
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Send, Sparkles, User } from 'lucide-react';
import { authAPI } from '../../lib/auth';
import { useAppState } from '../hooks/useAppState'; // Added for refresh logic

// Debounce utility function (copied from Sidebar)
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const RotatingGradientAnimation = ({ size = 128 }) => {
  const [rotation, setRotation] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 1) % 360);
    }, 16); // ~60fps
    return () => clearInterval(interval);
  }, []);

  const thickness = size * 0.15; // ring thickness
  const feather = 0.5; // small feather for smoothness

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `conic-gradient(
          from ${rotation}deg,
          #9dd8ffff,
          #38BDF8,
          #0e7ce9ff,
          #38BDF8,
          #9dd8ffff
        )`,
        WebkitMaskImage: `radial-gradient(
          circle,
          transparent ${size / 2 - thickness - feather}px,
          black ${size / 2 - thickness}px
        )`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        boxShadow: `0 0 ${size * 0.3}px rgba(56, 189, 248, 0.6),
                    0 0 ${size * 0.5}px rgba(14, 165, 233, 0.4)`,
      }}
    />
  );
};

interface RightSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  forceClose?: boolean;
  navbarVisible?: boolean;
  onEventChange?: () => void;
  events?: any[];
  tasks?: any[];
  onEventCreate?: (eventData: any) => Promise<any>;
  onEventUpdate?: (eventId: string, updates: any) => Promise<any>;
  onEventDelete?: (eventId: string) => Promise<boolean>;
  onTaskCreate?: (taskData: any) => Promise<any>;
  onTaskUpdate?: (taskId: string, updates: any) => Promise<any>;
  onTaskDelete?: (taskId: string) => Promise<boolean>;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface LLMResponse {
  response: string;
  message_id?: string;
  error?: string;
  changes_applied?: boolean;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ 
  isOpen: controlledIsOpen, 
  onToggle,
  forceClose = false,
  navbarVisible = false,
  onEventChange,
  events = [],
  tasks = [],
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  onTaskCreate,
  onTaskUpdate,
  onTaskDelete
}) => {
  // State variables
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m your AI assistant. I can help you edit events, answer questions, and schedule your day. You are limited to 5 messages a week.',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get access to useAppState for proper data refresh (copying Sidebar pattern)
  const { initializeData } = useAppState();
  
  // Refs for proper component lifecycle management (copying Sidebar pattern)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef<boolean>(true);
  const refreshInProgressRef = useRef<boolean>(false);
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen));

  // Cleanup on unmount (copied from Sidebar)
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounced refresh function (copied exactly from Sidebar)
  const debouncedRefresh = useCallback(
    debounce(async () => {
      if (refreshInProgressRef.current || !isMountedRef.current) return;
      
      refreshInProgressRef.current = true;
      try {
        await initializeData(true); // Force fresh data fetch
        if (onEventChange) {
          onEventChange(); // Update refresh trigger
        }
      } finally {
        refreshInProgressRef.current = false;
      }
    }, 500),
    [initializeData, onEventChange]
  );

  // Auto-scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'end'
    });
  };

  // Effect to scroll to bottom when messages change or when typing starts/stops
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Effect to handle force close
  useEffect(() => {
    if (forceClose && isOpen) {
      if (controlledIsOpen !== undefined && onToggle) {
        onToggle();
      } else {
        setInternalIsOpen(false);
      }
    }
  }, [forceClose, isOpen, controlledIsOpen, onToggle]);

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = await authAPI.checkAuthStatus();
      if (!isAuth) {
        setError('Please log in to use the chat feature');
      }
    };
    
    checkAuth();
  }, []);

  // Function to send message to LLM backend
  const sendMessageToLLM = async (message: string): Promise<{ response: string; calendarUpdated: boolean }> => {
    try {
      setError(null);

      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/llm-text/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to get LLM response');
      }

      const data: LLMResponse = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      return {
        response: data.response || 'No response received',
        calendarUpdated: data.changes_applied || false
      };
    } catch (error) {
      console.error('LLM request error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      throw error;
    }
  };

  // Main message handler with Sidebar's exact refresh pattern
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const originalMessage = inputMessage;
    setInputMessage('');
    setIsTyping(true);

    try {
      console.log('Sending message to AI:', originalMessage);
      
      const { response: llmResponse, calendarUpdated } = await sendMessageToLLM(originalMessage);
      
      console.log('AI Response received:', {
        response: llmResponse,
        calendarUpdated: calendarUpdated
      });
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: llmResponse,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiResponse]);

      // Use the exact same refresh logic as Sidebar
      if (calendarUpdated) {
        console.log('🔄 AI made calendar changes, triggering refresh using Sidebar pattern...');
        debouncedRefresh(); // This is exactly what Sidebar does!
      } else {
        console.log('ℹ️ No calendar changes were made by the AI');
      }
      
    } catch (error) {
      console.error('❌ Error processing AI message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={handleToggle}
        />
      )}
      
      {/* Sidebar Container */}
      <div 
        className={`fixed right-0 h-full z-50 transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          top: '0px',
          height: '100vh',
          transition: 'transform 0.3s ease-in-out'
        }}
      >
        
        {/* Tab/Toggle Button */}
        <div className="absolute -left-[18px] top-16">
          <button
            onClick={handleToggle}
            className="py-5 px-0 rounded-l-md shadow-md transition-colors duration-200 focus:outline-none"
            style={{
              backgroundColor: 'hsl(var(--primary))',
              color: 'hsl(var(--calendar-background))',
              width: '18px',
            } as React.CSSProperties}
            aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
          >
            {isOpen ? (
              <ChevronRight className="w-4 h-4 mx-auto" />
            ) : (
              <ChevronLeft className="w-4 h-4 mx-auto" />
            )}
          </button>
        </div>

        {/* Sidebar Content */}
        <div 
          className="w-80 h-full border-l flex flex-col"
          style={{
            backgroundColor: 'hsl(var(--sidebar))',
            borderLeftColor: 'hsl(var(--border))'
          }}
        >
          
          {/* Header */}
          <div 
            className="p-3 border-b flex-shrink-0"
            style={{
              backgroundColor: 'hsl(var(--primary) / 0.05)',
              borderBottomColor: 'hsl(var(--border))'
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  color: 'hsl(var(--primary))'
                }}
              >
                <RotatingGradientAnimation size={32}/>
              </div>
              <div>
                <h2 
                  className="text-lg font-semibold"
                  style={{ color: 'hsl(var(--foreground))' }}
                >
                  AI Assistant
                </h2>
                <p 
                  className="text-xs"
                  style={{ color: 'hsl(var(--muted-foreground))' }}
                >
                  Ready to help with your calendar
                </p>
              </div>
            </div>
          </div>

          {/* Chat Messages - Updated with better scrolling */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-hidden flex flex-col"
          >
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {error && (
                <div 
                  className="border rounded-lg p-3"
                  style={{
                    backgroundColor: 'hsl(var(--destructive) / 0.1)',
                    borderColor: 'hsl(var(--destructive) / 0.2)'
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: 'hsl(var(--destructive))' }}
                    ></div>
                    <div>
                      <p 
                        className="text-sm font-medium"
                        style={{ color: 'hsl(var(--destructive))' }}
                      >
                        Error
                      </p>
                      <p 
                        className="text-xs"
                        style={{ color: 'hsl(var(--destructive))' }}
                      >
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[92%] px-3 py-2 rounded-lg shadow-sm ${
                      message.sender === 'user' 
                        ? 'rounded-br-none' 
                        : 'rounded-bl-none'
                    }`}
                    style={{
                      backgroundColor: message.sender === 'user' 
                        ? 'hsl(var(--primary) / 0.1)' 
                        : 'hsl(var(--muted) / 0.8)',
                      color: 'hsl(var(--foreground))',
                      border: `1px solid ${message.sender === 'user' 
                        ? 'hsl(var(--primary) / 0.2)' 
                        : 'hsl(var(--border) / 0.5)'}`,
                      lineHeight: '1.5'
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {message.sender === 'ai' && (
                        <div className="-ml-1 flex-shrink-0">
                          <RotatingGradientAnimation size={18} />
                        </div>
                      )}
                      {message.sender === 'user' && (
                        <User 
                          className="w-4 h-4 mt-0.5 flex-shrink-0" 
                          style={{ color: 'hsl(var(--primary))' }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p 
                          className="text-sm whitespace-pre-wrap break-words"
                          style={{ 
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                            lineHeight: '1.4',
                            margin: 0
                          }}
                        >
                          {message.content}
                        </p>
                        <p 
                          className="text-xs mt-1 opacity-70"
                          style={{
                            color: 'hsl(var(--muted-foreground))'
                          }}
                        >
                          {message.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div 
                    className="px-3 py-2 rounded-lg rounded-bl-none shadow-sm"
                    style={{
                      backgroundColor: 'hsl(var(--muted) / 0.8)',
                      color: 'hsl(var(--foreground))',
                      border: '1px solid hsl(var(--border) / 0.5)'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0">
                        <RotatingGradientAnimation size={18} />
                      </div>
                      <div className="flex gap-1">
                        <div 
                          className="w-2 h-2 rounded-full animate-bounce"
                          style={{ backgroundColor: 'hsl(var(--muted-foreground))' }}
                        ></div>
                        <div 
                          className="w-2 h-2 rounded-full animate-bounce"
                          style={{ 
                            backgroundColor: 'hsl(var(--muted-foreground))',
                            animationDelay: '0.1s' 
                          }}
                        ></div>
                        <div 
                          className="w-2 h-2 rounded-full animate-bounce"
                          style={{ 
                            backgroundColor: 'hsl(var(--muted-foreground))',
                            animationDelay: '0.2s' 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Invisible element to scroll to */}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div 
            className="p-3 border-t flex-shrink-0"
            style={{
              backgroundColor: 'hsl(var(--background) / 0.5)',
              borderTopColor: 'hsl(var(--border))',
              backdropFilter: 'blur(8px)'
            }}
          >
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me about your calendar..."
                  disabled={isTyping || !!error}
                  className="w-full p-3 pr-12 border rounded-lg resize-none focus:outline-none focus:ring-2 disabled:cursor-not-allowed transition-all duration-200"
                  style={{
                    borderColor: 'hsl(var(--border))',
                    backgroundColor: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    focusRingColor: 'hsl(var(--primary))',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    lineHeight: '1.4',
                    minHeight: '44px',
                    maxHeight: '120px'
                  } as React.CSSProperties}
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isTyping || !!error}
                  className="absolute right-2 top-1/2 transform -translate-y-[60%] p-2 rounded-md transition-all duration-200 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: !inputMessage.trim() || isTyping || !!error 
                      ? 'hsl(var(--muted))' 
                      : 'hsl(var(--darker-border))',
                    color: !inputMessage.trim() || isTyping || !!error 
                      ? 'hsl(var(calendar))' 
                      : 'hsl(var(--primary-foreground))',
                    opacity: !inputMessage.trim() || isTyping || !!error ? 0.5 : 1
                  } as React.CSSProperties}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RightSidebar;