'use client';
import React, { useState, useRef, useEffect } from 'react';
import { authAPI } from '../../lib/auth'; // Adjust path as needed

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface LLMResponse {
  response: string;
  message_id?: string;
  error?: string;
}

const LLMChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Function to send message to LLM backend
  const sendMessageToLLM = async (message: string): Promise<string> => {
    try {
      setIsLoading(true);
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
            // Add any additional parameters your backend expects
            // conversation_id: conversationId, // if you track conversations
            // model: 'gpt-3.5-turbo', // if you allow model selection
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

      return data.response || 'No response received';
    } catch (error) {
      console.error('LLM request error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessageText = inputValue.trim();
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userMessageText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    try {
      // Send message to LLM backend
      const llmResponse = await sendMessageToLLM(userMessageText);
      
      // Add AI response
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: llmResponse,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error processing your message. Please try again.',
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

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

  return (
    <div
      ref={chatRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '300px',
        height: isMinimized ? '30px' : '400px',
        border: '1px solid black',
        borderRadius: '8px',
        backgroundColor: 'white',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        overflow: 'hidden'
      }}
    >
      <div 
        onMouseDown={handleMouseDown}
        style={{
          padding: '8px',
          backgroundColor: '#f0f0f0',
          borderBottom: '1px solid #ddd',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span style={{ fontWeight: 'bold' }}>bleh bleh bleh</span>
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          {isMinimized ? '+' : '-'}
        </button>
      </div>

      {!isMinimized && (
        <>
          <div style={{ 
            height: '300px', 
            overflowY: 'auto',
            padding: '8px',
            backgroundColor: '#fafafa'
          }}>
            {error && (
              <div style={{
                color: 'red',
                fontSize: '12px',
                marginBottom: '8px',
                padding: '4px',
                backgroundColor: '#ffebee',
                borderRadius: '4px'
              }}>
                {error}
              </div>
            )}
            
            {messages.map((message) => (
              <div 
                key={message.id}
                style={{
                  marginBottom: '8px',
                  padding: '6px',
                  borderRadius: '4px',
                  backgroundColor: message.isUser ? '#e3f2fd' : '#f5f5f5'
                }}
              >
                <strong style={{ color: message.isUser ? '#1976d2' : '#424242' }}>
                  {message.isUser ? 'You' : 'AI'}:
                </strong>
                <div style={{ marginTop: '2px', fontSize: '14px' }}>
                  {message.text}
                </div>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div style={{
                padding: '6px',
                fontStyle: 'italic',
                color: '#666'
              }}>
                AI is thinking...
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '8px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading || !!error}
                style={{
                  flex: 1,
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <button 
                type="submit"
                disabled={isLoading || !!error || !inputValue.trim()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isLoading || !!error || !inputValue.trim() ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !!error || !inputValue.trim() ? 0.6 : 1
                }}
              >
                {isLoading ? '...' : 'Send'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default LLMChat;