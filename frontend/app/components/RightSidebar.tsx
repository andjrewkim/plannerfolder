import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Send, Bot, User } from 'lucide-react';

interface RightSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  forceClose?: boolean;
  navbarVisible?: boolean;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ 
  isOpen: controlledIsOpen, 
  onToggle,
  forceClose = false,
  navbarVisible = false
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m your AI assistant. I can help you with calendar management, scheduling, and answer questions about your events. How can I assist you today?',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
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

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: generateAIResponse(inputMessage),
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1000);
  };

  const generateAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes('schedule') || input.includes('event')) {
      return 'I can help you schedule events! You can create events using the form on the left, and I can suggest optimal times based on your existing calendar. What type of event would you like to schedule?';
    } else if (input.includes('calendar') || input.includes('view')) {
      return 'Your calendar supports multiple views including month, week, and day views. You can switch between them using the view controls. Would you like me to explain any specific calendar features?';
    } else if (input.includes('help') || input.includes('what can you do')) {
      return 'I can help you with:\n• Creating and managing events\n• Finding optimal meeting times\n• Calendar navigation tips\n• Scheduling suggestions\n• Answering questions about your appointments\n\nWhat would you like to know more about?';
    } else {
      return 'I understand you\'re asking about "' + userInput + '". I\'m here to help with calendar management and scheduling. Could you be more specific about what you need assistance with?';
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
          top: navbarVisible ? '60px' : '0px',
          height: navbarVisible ? 'calc(100vh - 60px)' : '100vh',
          transition: 'transform 0.3s ease-in-out, top 0.4s ease-in-out, height 0.4s ease-in-out'
        }}
      >
        
        {/* Tab/Toggle Button */}
        <div className="absolute -left-8 top-14">

          <button
            onClick={handleToggle}
            className="text-white p-2 rounded-l-md shadow-md transition-colors duration-200 focus:outline-none"
            style={{
              background: 'hsl(var(--primary) / 0.9)'
            } as React.CSSProperties}
            aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
          >
            {isOpen ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="w-80 h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col">
          
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  AI Assistant
                </h2>
                <p className="text-xs text-gray-500">Ready to help with your calendar</p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  message.sender === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}>
                  <div className="flex items-start gap-2">
                    {message.sender === 'ai' && (
                      <Bot className="w-4 h-4 mt-0.5 text-blue-600" />
                    )}
                    {message.sender === 'user' && (
                      <User className="w-4 h-4 mt-0.5 text-blue-100" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
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
                <div className="bg-gray-100 p-3 rounded-lg rounded-bl-none">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-600" />
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about your calendar..."
                className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '100px' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping}
                className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
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