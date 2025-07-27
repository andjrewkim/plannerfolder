import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CustomTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  className?: string;
}

const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ 
  value, 
  onChange, 
  style,
  className 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minuteScrollRef = useRef<HTMLDivElement>(null);

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

  // Scroll to selected time when opening
  useEffect(() => {
    if (isOpen && value) {
      const [hour, minute] = value.split(':').map(Number);
      
      setTimeout(() => {
        if (hourScrollRef.current) {
          const hourElement = hourScrollRef.current.children[hour] as HTMLElement;
          if (hourElement) {
            hourScrollRef.current.scrollTop = hourElement.offsetTop - 80;
          }
        }
        
        if (minuteScrollRef.current) {
          const minuteElement = minuteScrollRef.current.children[minute] as HTMLElement;
          if (minuteElement) {
            minuteScrollRef.current.scrollTop = minuteElement.offsetTop - 80;
          }
        }
      }, 0);
    }
  }, [isOpen, value]);

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hour, minute] = timeStr.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    return `${displayHour}:${minute} ${period}`;
  };

  const formatValueTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hour: 9, minute: 0 }; // Default to 9:00 AM
    const [hour, minute] = timeStr.split(':').map(Number);
    return { hour, minute };
  };

  const selectTime = (hour: number, minute: number) => {
    onChange(formatValueTime(hour, minute));
    setIsOpen(false);
  };

  const { hour: currentHour, minute: currentMinute } = parseTime(value);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
        className={className}
      >
        <span style={{ color: value ? 'hsl(var(--text-color))' : 'hsl(var(--text-muted))', fontSize: '13px' }}>
          {value ? formatDisplayTime(value) : '--:--'}
        </span>
        <Clock size={14} color="hsl(var(--border))" style={{ marginLeft: '4px', flexShrink: 0 }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 10000,
          backgroundColor: 'hsl(var(--input-field-bg))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          width: '200px'
        }}>
          <div style={{
            display: 'flex',
            height: '200px'
          }}>
            {/* Hours column */}
            <div style={{ flex: 1, borderRight: '1px solid hsl(var(--border))' }}>
              <div style={{
                padding: '8px 0',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: '500',
                color: 'hsl(var(--text-muted))',
                borderBottom: '1px solid hsl(var(--border))'
              }}>
                Hour
              </div>
              <div
                ref={hourScrollRef}
                style={{
                  height: '168px',
                  overflowY: 'auto',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'hsl(var(--border)) transparent'
                }}
              >
                {hours.map(hour => (
                  <button
                    key={hour}
                    onClick={() => selectTime(hour, currentMinute)}
                    style={{
                      width: '100%',
                      padding: '6px 12px',
                      border: 'none',
                      backgroundColor: hour === currentHour 
                        ? 'hsl(var(--accent-foreground))' 
                        : 'transparent',
                      color: hour === currentHour
                        ? 'hsl(var(--primary-foreground))'
                        : 'hsl(var(--text-color))',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontWeight: hour === currentHour ? '600' : '400'
                    }}
                    onMouseEnter={(e) => {
                      if (hour !== currentHour) {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--accent-foreground)/0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (hour !== currentHour) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes column */}
            <div style={{ flex: 1 }}>
              <div style={{
                padding: '8px 0',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: '500',
                color: 'hsl(var(--text-muted))',
                borderBottom: '1px solid hsl(var(--border))'
              }}>
                Minute
              </div>
              <div
                ref={minuteScrollRef}
                style={{
                  height: '168px',
                  overflowY: 'auto',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'hsl(var(--border)) transparent'
                }}
              >
                {minutes.map(minute => (
                  <button
                    key={minute}
                    onClick={() => selectTime(currentHour, minute)}
                    style={{
                      width: '100%',
                      padding: '6px 12px',
                      border: 'none',
                      backgroundColor: minute === currentMinute 
                        ? 'hsl(var(--accent-foreground))' 
                        : 'transparent',
                      color: minute === currentMinute
                        ? 'hsl(var(--primary-foreground))'
                        : 'hsl(var(--text-color))',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontWeight: minute === currentMinute ? '600' : '400'
                    }}
                    onMouseEnter={(e) => {
                      if (minute !== currentMinute) {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--accent-foreground)/0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (minute !== currentMinute) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {minute.toString().padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          </div>
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

export default CustomTimePicker;