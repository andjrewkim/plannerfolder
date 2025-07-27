import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  onChange, 
  options,
  style,
  className,
  placeholder = 'Select option...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(option => option.value === value);

  const selectOption = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          position: 'relative'
        }}
        className={className}
      >
        <span style={{ 
          color: selectedOption ? 'hsl(var(--text-color))' : 'hsl(var(--text-muted))',
          flex: 1,
          fontSize: '13px'
        }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          size={14} 
          color="hsl(var(--border))" 
          style={{ 
            marginLeft: '4px',
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }} 
        />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 10000,
          backgroundColor: 'hsl(var(--input-field-bg))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          maxHeight: '200px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--border)) transparent'
        }}>
          {options.map(option => (
            <button
              key={option.value}
              onClick={() => selectOption(option.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                backgroundColor: option.value === value 
                  ? 'hsl(var(--accent-foreground)/0.2)' 
                  : 'transparent',
                color: option.value === value
                  ? 'hsl(var(--accent-foreground))'
                  : 'hsl(var(--text-color))',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: option.value === value ? '600' : '400'
              }}
              onMouseEnter={(e) => {
                if (option.value !== value) {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--accent-foreground)/0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (option.value !== value) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                } else {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--accent-foreground)/0.2)';
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          /* Custom scrollbar styling */
          div::-webkit-scrollbar {
            width: 6px;
          }
          
          div::-webkit-scrollbar-track {
            background: transparent;
          }
          
          div::-webkit-scrollbar-thumb {
            background: hsl(var(--border));
            border-radius: 3px;
          }
          
          div::-webkit-scrollbar-thumb:hover {
            background: hsl(var(--accent-foreground)/0.3);
          }
        `
      }} />
    </div>
  );
};

export default CustomSelect;