'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { authAPI } from '../../lib/auth';
import { useAppState } from '../hooks/useAppState';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isError?: boolean;
  actionPerformed?: boolean; // Track if this message resulted in calendar actions
}

interface UsageInfo {
  messages_used: number;
  messages_remaining: number;
  weekly_limit: number;
  week_start: string;
  reset_date: string;
  can_send_message: boolean;
}

interface LLMResponse {
  success: boolean;
  response?: string;
  error?: string;
  error_type?: string;
  message?: string;
  usage_info?: UsageInfo;
  message_id?: string;
  // Production addition: track what actions were performed
  actions_performed?: {
    events_created?: number;
    events_updated?: number;
    events_deleted?: number;
    tasks_created?: number;
    tasks_updated?: number;
    tasks_deleted?: number;
  };
}

const LLMChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [isLimitExceeded, setIsLimitExceeded] = useState(false);
  
  // Full integration with useAppState
  const { 
    isLoading: appLoading,
    error: appError,
    setError: setAppError,
    setLoading: setAppLoading,
    initializeData,
    events,
    tasks
  } = useAppState();

  // Local loading state for chat-specific operations
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Combined loading state
  const isLoading = appLoading || isChatLoading;
  
  // Combined error state with priority to chat errors
  const error = chatError || appError;

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (chatRef.current) {
      const rect = chatRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Function to fetch current usage status
  const fetchUsageStatus = useCallback(async () => {
    try {
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/llm-usage-status/`,
        { method: 'GET' }
      );
      

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.usage) {
          setUsageInfo(data.usage);
          setIsLimitExceeded(!data.usage.can_send_message);
        }
      }
    } catch (error) {
      console.error('Failed to fetch usage status:', error);
    }
  }, []);

  // Enhanced function to send message to LLM backend with full context
  const sendMessageToLLM = useCallback(async (message: string): Promise<{ response: string; actionsPerformed: boolean }> => {
    try {
      setIsChatLoading(true);
      setChatError(null);
      setAppError(null); // Clear app errors when starting new chat

      // Provide full calendar context to LLM
      const requestBody = {
        message: message,
        include_calendar: true,
        // Production enhancement: provide current state context
        context: {
          current_events_count: events.length,
          current_tasks_count: tasks.length,
          // You could include recent events, upcoming events, etc.
          upcoming_events: events
            .filter(e => new Date(e.date) >= new Date())
            .slice(0, 10)
            .map(e => ({ id: e.id, name: e.event_name, date: e.date }))
        }
      };

      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/llm-text/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );

      const data: LLMResponse = await response.json();
      
      // Handle limit exceeded
      if (data.error_type === 'LIMIT_EXCEEDED') {
        setIsLimitExceeded(true);
        if (data.usage_info) {
          setUsageInfo(data.usage_info);
        }
        throw new Error(data.message || data.error || 'Weekly message limit exceeded');
      }
      
      // Handle other errors
      if (!data.success || data.error) {
        throw new Error(data.error || data.message || 'Failed to get LLM response');
      }

      // Update usage info
      if (data.usage_info) {
        setUsageInfo(data.usage_info);
        setIsLimitExceeded(!data.usage_info.can_send_message);
      }

      // Production enhancement: check if actions were performed
      const actionsPerformed = !!(data.actions_performed && (
        data.actions_performed.events_created ||
        data.actions_performed.events_updated ||
        data.actions_performed.events_deleted ||
        data.actions_performed.tasks_created ||
        data.actions_performed.tasks_updated ||
        data.actions_performed.tasks_deleted
      ));

      return {
        response: data.response || 'No response received',
        actionsPerformed
      };

    } catch (error) {
      console.error('LLM request error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setChatError(errorMessage);
      throw error;
    } finally {
      setIsChatLoading(false);
    }
  }, [events, tasks, setAppError]);

  // Production-grade data refresh strategy
  const refreshCalendarData = useCallback(async (reason: string) => {
    console.log(`Refreshing calendar data: ${reason}`);
    try {
      setAppLoading(true);
      await initializeData(true); // Force refresh
      console.log('Calendar data refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh calendar data:', error);
      setAppError('Failed to refresh calendar data after LLM action');
    }
  }, [initializeData, setAppLoading, setAppError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || isLimitExceeded) return;

    const userMessageText = inputValue.trim();
    const userMessageId = Date.now().toString();
    
    // Add user message
    const userMessage: Message = {
      id: userMessageId,
      text: userMessageText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    try {
      // Send message to LLM backend
      const { response: llmResponse, actionsPerformed } = await sendMessageToLLM(userMessageText);
      
      // Add AI response
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: llmResponse,
        isUser: false,
        timestamp: new Date(),
        actionPerformed: actionsPerformed
      };
      
      setMessages(prev => [...prev, aiMessage]);

      // Production enhancement: Always refresh if actions were performed
      if (actionsPerformed) {
        await refreshCalendarData('LLM performed calendar actions');
      }
      
    } catch (error) {
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: error instanceof Error ? error.message : 'Sorry, I encountered an error processing your message.',
        isUser: false,
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Initialize chat and check auth status
  useEffect(() => {
    const initializeChat = async () => {
      const isAuth = await authAPI.checkAuthStatus();
      if (!isAuth) {
        setChatError('Please log in to use the chat feature');
        return;
      }
      
      await fetchUsageStatus();
    };
    
    initializeChat();
  }, [fetchUsageStatus]);

  // Format reset date for display
  const formatResetDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div
      ref={chatRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '340px', // Slightly wider for production
        height: isMinimized ? '30px' : '500px', // Taller for more context
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        backgroundColor: 'white',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        zIndex: 1000,
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <div 
        onMouseDown={handleMouseDown}
        style={{
          padding: '12px 16px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #e9ecef',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <span style={{ fontWeight: '600', fontSize: '14px', color: '#212529' }}>
            AI Calendar Assistant
          </span>
          {usageInfo && (
            <div style={{ 
              fontSize: '11px', 
              color: usageInfo.messages_remaining <= 1 ? '#dc3545' : '#6c757d',
              marginTop: '2px'
            }}>
              {usageInfo.messages_remaining}/{usageInfo.weekly_limit} messages left
            </div>
          )}
        </div>
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#6c757d',
            padding: '4px',
            borderRadius: '4px'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {isMinimized ? '▲' : '▼'}
        </button>
      </div>

      {!isMinimized && (
        <>
          <div style={{ 
            height: '380px', 
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: '#ffffff'
          }}>
            {error && (
              <div style={{
                color: '#721c24',
                fontSize: '13px',
                marginBottom: '12px',
                padding: '12px',
                backgroundColor: '#f8d7da',
                borderRadius: '8px',
                border: '1px solid #f5c6cb'
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {isLimitExceeded && usageInfo && (
              <div style={{
                color: '#856404',
                fontSize: '13px',
                marginBottom: '12px',
                padding: '12px',
                backgroundColor: '#fff3cd',
                borderRadius: '8px',
                border: '1px solid #ffeaa7'
              }}>
                <strong>Weekly limit reached!</strong><br />
                You've used all {usageInfo.weekly_limit} messages this week.<br />
                Resets on {formatResetDate(usageInfo.reset_date)}.
              </div>
            )}

            {/* Context indicator */}
            <div style={{
              fontSize: '11px',
              color: '#6c757d',
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              Context: {events.length} events, {tasks.length} tasks
            </div>
            
            {messages.map((message) => (
              <div 
                key={message.id}
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: message.isUser 
                    ? '#e7f3ff' 
                    : message.isError 
                      ? '#f8d7da' 
                      : '#f8f9fa',
                  border: message.actionPerformed ? '2px solid #28a745' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong style={{ 
                    color: message.isUser 
                      ? '#0066cc' 
                      : message.isError 
                        ? '#721c24' 
                        : '#495057',
                    fontSize: '13px'
                  }}>
                    {message.isUser ? 'You' : message.isError ? 'Error' : 'AI Assistant'}
                  </strong>
                  {message.actionPerformed && (
                    <span style={{
                      fontSize: '10px',
                      color: '#28a745',
                      backgroundColor: '#d4edda',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      fontWeight: '500'
                    }}>
                      Action Performed
                    </span>
                  )}
                </div>
                <div style={{ 
                  fontSize: '14px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  color: '#212529'
                }}>
                  {message.text}
                </div>
                <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '6px' }}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div style={{
                padding: '16px',
                textAlign: 'center',
                color: '#6c757d'
              }}>
                <div style={{ 
                  display: 'inline-block',
                  width: '20px',
                  height: '20px',
                  border: '2px solid #f3f3f3',
                  borderTop: '2px solid #007bff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  {isChatLoading ? 'AI is thinking...' : 'Updating calendar...'}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} style={{ 
            padding: '16px',
            borderTop: '1px solid #e9ecef',
            backgroundColor: '#f8f9fa'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  isLimitExceeded 
                    ? "Weekly limit reached" 
                    : "Ask me to create, edit, or check your calendar..."
                }
                disabled={isLoading || !!error || isLimitExceeded}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #ced4da',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: isLimitExceeded ? '#e9ecef' : 'white',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#007bff'}
                onBlur={(e) => e.target.style.borderColor = '#ced4da'}
              />
              <button 
                type="submit"
                disabled={isLoading || !!error || !inputValue.trim() || isLimitExceeded}
                style={{
                  padding: '12px 16px',
                  backgroundColor: isLimitExceeded ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading || !!error || !inputValue.trim() || isLimitExceeded 
                    ? 'not-allowed' 
                    : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  minWidth: '70px'
                }}
              >
                {isLoading ? '...' : 'Send'}
              </button>
            </div>
            
            {usageInfo && usageInfo.messages_remaining <= 2 && usageInfo.messages_remaining > 0 && (
              <div style={{
                fontSize: '11px',
                color: '#fd7e14',
                marginTop: '8px',
                textAlign: 'center',
                fontWeight: '500'
              }}>
                ⚠️ {usageInfo.messages_remaining} message{usageInfo.messages_remaining !== 1 ? 's' : ''} remaining this week
              </div>
            )}
          </form>
        </>
      )}
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LLMChat;