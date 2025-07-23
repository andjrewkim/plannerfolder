import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Send, Sparkles, User } from 'lucide-react';
import { authAPI } from '../../lib/auth'; // Adjust path as needed

interface RightSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  forceClose?: boolean;
  navbarVisible?: boolean;
  onEventChange?: () => void; // Add this prop to trigger calendar refresh
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
  changes_applied?: boolean; // Add this to check if the AI made calendar changes
}

const RightSidebar: React.FC<RightSidebarProps> = ({ 
  isOpen: controlledIsOpen, 
  onToggle,
  forceClose = false,
  navbarVisible = false,
  onEventChange // Add this prop
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m your AI assistant. I can help you edit events, answer questions, and schedule your day.',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen));

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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Send message to LLM backend
      const { response: llmResponse, calendarUpdated } = await sendMessageToLLM(inputMessage);
      
      // Add AI response
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: llmResponse,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiResponse]);

      // Trigger calendar refresh if the AI made changes to the calendar
      if (calendarUpdated && onEventChange) {
        console.log('AI made calendar changes, refreshing calendar...');
        onEventChange();
      }
    } catch (error) {
      // Add error message to chat
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
          top: '0px', // Always stay at top
          height: '100vh', // Always full height
          transition: 'transform 0.3s ease-in-out'
        }}
      >
        
      {/* Tab/Toggle Button */}
      <div className="absolute -left-6 top-16">
        <button
          onClick={handleToggle}
          className="text-white py-4 px-1 rounded-l-md shadow-md transition-colors duration-200 focus:outline-none"
          style={{
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            width: '24px', // keeps it narrow horizontally
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
        <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col">
          
          {/* Header */}
          <div 
            className="p-4 border-b border-gray-200"
            style={{
              backgroundColor: 'hsl(var(--primary) / 0.05)',
              borderBottomColor: 'hsl(var(--border))'
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))'
                }}
              >
                <Sparkles className="w-5 h-5" />
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

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
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
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.sender === 'user' 
                      ? 'rounded-br-none' 
                      : 'rounded-bl-none'
                  }`}
                  style={{
                    backgroundColor: message.sender === 'user' 
                      ? 'hsl(var(--primary))' 
                      : 'hsl(var(--muted))',
                    color: message.sender === 'user' 
                      ? 'hsl(var(--primary-foreground))' 
                      : 'hsl(var(--foreground))'
                  }}
                >
                  <div className="flex items-start gap-2">
                    {message.sender === 'ai' && (
                      <Sparkles 
                        className="w-4 h-4 mt-0.5" 
                        style={{ color: 'hsl(var(--primary))' }}
                      />
                    )}
                    {message.sender === 'user' && (
                      <User 
                        className="w-4 h-4 mt-0.5" 
                        style={{ color: 'hsl(var(--primary-foreground) / 0.7)' }}
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p 
                        className="text-xs mt-1"
                        style={{
                          color: message.sender === 'user' 
                            ? 'hsl(var(--primary-foreground) / 0.7)' 
                            : 'hsl(var(--muted-foreground))'
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
                  className="p-3 rounded-lg rounded-bl-none"
                  style={{
                    backgroundColor: 'hsl(var(--muted))',
                    color: 'hsl(var(--foreground))'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles 
                      className="w-4 h-4" 
                      style={{ color: 'hsl(var(--primary))' }}
                    />
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
          </div>

          {/* Input Area */}
          <div 
            className="p-4 border-t"
            style={{
              backgroundColor: 'hsl(var(--muted) / 0.3)',
              borderTopColor: 'hsl(var(--border))'
            }}
          >
            <div className="flex gap-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about your calendar..."
                disabled={isTyping || !!error}
                className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:border-transparent disabled:cursor-not-allowed"
                style={{
                  borderColor: 'hsl(var(--border))',
                  backgroundColor: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  focusRingColor: 'hsl(var(--primary))',
                  disabledBackgroundColor: 'hsl(var(--muted))',
                } as React.CSSProperties}
                rows={1}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping || !!error}
                className="p-3 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: !inputMessage.trim() || isTyping || !!error 
                    ? 'hsl(var(--muted))' 
                    : 'hsl(var(--primary))',
                  color: !inputMessage.trim() || isTyping || !!error 
                    ? 'hsl(var(--muted-foreground))' 
                    : 'hsl(var(--primary-foreground))',
                  ':hover': {
                    backgroundColor: 'hsl(var(--primary) / 0.9)'
                  }
                } as React.CSSProperties}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RightSidebar;