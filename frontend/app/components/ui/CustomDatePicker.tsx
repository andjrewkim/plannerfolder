import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  className?: string;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ 
  value, 
  onChange, 
  style,
  className 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize current month based on value or today
  useEffect(() => {
    if (value) {
      setCurrentMonth(new Date(value + 'T00:00:00'));
    } else {
      setCurrentMonth(new Date());
    }
  }, [value]);

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

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  const formatValueDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const selectDate = (date: Date) => {
    onChange(formatValueDate(date));
    setIsOpen(false);
  };

  const isSelectedDate = (date: Date) => {
    if (!value) return false;
    const selectedDate = new Date(value + 'T00:00:00');
    return date.toDateString() === selectedDate.toDateString();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
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
        <span style={{ color: value ? 'hsl(var(--text-color))' : 'hsl(var(--text-muted))' }}>
          {value ? formatDisplayDate(value) : 'mm/dd/yyyy'}
        </span>
        <Calendar size={14} color="hsl(var(--border))" style={{ marginLeft: '4px' }} />
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
          padding: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          minWidth: '280px'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
            padding: '0 4px'
          }}>
            <button
              onClick={() => navigateMonth('prev')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                color: 'hsl(var(--text-color))'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(var(--accent-foreground)/0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ChevronLeft size={16} />
            </button>
            
            <span style={{
              fontSize: '14px',
              fontWeight: '500',
              color: 'hsl(var(--text-color))'
            }}>
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            
            <button
              onClick={() => navigateMonth('next')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                color: 'hsl(var(--text-color))'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(var(--accent-foreground)/0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
            marginBottom: '4px'
          }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} style={{
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: '500',
                color: 'hsl(var(--text-muted))',
                padding: '4px'
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px'
          }}>
            {getDaysInMonth(currentMonth).map((date, index) => (
              <div key={index} style={{ height: '32px' }}>
                {date && (
                  <button
                    onClick={() => selectDate(date)}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelectedDate(date) 
                        ? 'hsl(var(--accent-foreground))' 
                        : isToday(date)
                        ? 'hsl(var(--accent-foreground)/0.2)'
                        : 'transparent',
                      color: isSelectedDate(date)
                        ? 'hsl(var(--primary-foreground))'
                        : isToday(date)
                        ? 'hsl(var(--accent-foreground))'
                        : 'hsl(var(--text-color))',
                      fontWeight: isToday(date) ? '600' : '400'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelectedDate(date)) {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--accent-foreground)/0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelectedDate(date)) {
                        e.currentTarget.style.backgroundColor = isToday(date) 
                          ? 'hsl(var(--accent-foreground)/0.2)' 
                          : 'transparent';
                      }
                    }}
                  >
                    {date.getDate()}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;