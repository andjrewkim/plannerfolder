import React, { useState, useEffect, useRef } from 'react';

const DEV_MODE = false;
const MOCK_TIME = {
  hours: 12,
  minutes: 40,
  seconds: 54,
  day: 2
};

interface SchedulePeriod {
  name: string;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
}

interface BellSchedule {
  id: string;
  name: string;
  periods: SchedulePeriod[];
}

const SCHEDULES: BellSchedule[] = [
  {
    id: 'regular',
    name: 'Regular Schedule',
    periods: [
      { name: 'Period 0', startTime: '7:25 AM', endTime: '8:22 AM' },
      { name: 'Period 1', startTime: '8:30 AM', endTime: '9:27 AM' },
      { name: 'Period 2', startTime: '9:34 AM', endTime: '10:36 AM' },
      { name: 'Break', startTime: '10:36 AM', endTime: '10:44 AM', isBreak: true },
      { name: 'Period 3', startTime: '10:51 AM', endTime: '11:48 AM' },
      { name: 'Period 4', startTime: '11:55 AM', endTime: '12:52 PM', isBreak: false },
      { name: 'Lunch', startTime: '12:52 PM', endTime: '1:22 PM', isBreak: true },
      { name: 'Period 5', startTime: '1:29 PM', endTime: '2:26 PM' },
      { name: 'Period 6', startTime: '2:33 PM', endTime: '3:30 PM' },
      { name: 'Period 7', startTime: '3:38 PM', endTime: '4:35 PM' },
    ],
  },
  {
    id: 'tuesday',
    name: 'Tuesday Prof Dev Schedule',
    periods: [
      { name: 'Period 0', startTime: '7:25 AM', endTime: '8:13 AM' },
      { name: 'Prof Dev', startTime: '8:20 AM', endTime: '9:17 AM', isBreak: true },
      { name: 'Period 1', startTime: '9:24 AM', endTime: '10:12 AM' },
      { name: 'Period 2', startTime: '10:19 AM', endTime: '11:12 AM' },
      { name: 'Nutrition', startTime: '11:12 AM', endTime: '11:20 AM', isBreak: true },
      { name: 'Period 3', startTime: '11:27 AM', endTime: '12:15 PM' },
      { name: 'Period 4', startTime: '12:22 PM', endTime: '1:10 PM' },
      { name: 'Lunch', startTime: '1:10 PM', endTime: '1:40 PM', isBreak: true },
      { name: 'Period 5', startTime: '1:47 PM', endTime: '2:35 PM' },
      { name: 'Period 6', startTime: '2:42 PM', endTime: '3:30 PM' },
      { name: 'Period 7', startTime: '3:35 PM', endTime: '4:23 PM' },
    ],
  },
];

const getCurrentTime = () => {
  if (DEV_MODE) {
    const now = new Date();
    now.setHours(MOCK_TIME.hours);
    now.setMinutes(MOCK_TIME.minutes);
    now.setSeconds(MOCK_TIME.seconds);
    return now;
  }
  return new Date();
};

const getCurrentDay = () => {
  if (DEV_MODE) {
    return MOCK_TIME.day;
  }
  return new Date().getDay();
};

const formatCurrentTime = (): string => {
  const now = getCurrentTime();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minutesStr = minutes.toString().padStart(2, '0');
  return `${hours}:${minutesStr} ${ampm}`;
};

const timeToMinutes = (time: string): number => {
  const [timeStr, period] = time.includes('AM') || time.includes('PM') 
    ? [time.slice(0, -2).trim(), time.slice(-2)]
    : [time, null];
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  let totalHours = hours;
  
  if (period === 'PM' && hours !== 12) {
    totalHours += 12;
  } else if (period === 'AM' && hours === 12) {
    totalHours = 0;
  }
  
  return totalHours * 60 + minutes;
};

const isWeekend = (): boolean => {
  const day = getCurrentDay();
  return day === 0 || day === 6;
};

const isTuesday = (): boolean => {
  const day = getCurrentDay();
  return day === 2;
};

const isCurrentPeriod = (start: string, end: string): boolean => {
  const now = getCurrentTime();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

const isInPassingPeriod = (prevEnd: string, nextStart: string): boolean => {
  const now = getCurrentTime();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = timeToMinutes(prevEnd);
  const startMinutes = timeToMinutes(nextStart);
  
  return currentMinutes >= endMinutes && currentMinutes < startMinutes;
};

const getTimeRemaining = (endTime: string): string => {
  const now = getCurrentTime();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentSeconds = now.getSeconds();
  const endMinutes = timeToMinutes(endTime);
  
  const totalSecondsRemaining = (endMinutes - currentMinutes) * 60 - currentSeconds;
  
  if (totalSecondsRemaining <= 0) return '0 min';
  
  const mins = Math.floor(totalSecondsRemaining / 60);
  const secs = totalSecondsRemaining % 60;
  
  if (mins === 0) return `${secs} sec`;
  return `${mins} min ${secs} sec`;
};

const getTimeUntilStart = (startTime: string): string => {
  const now = getCurrentTime();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentSeconds = now.getSeconds();
  const startMinutes = timeToMinutes(startTime);
  
  const totalSecondsUntil = (startMinutes - currentMinutes) * 60 - currentSeconds;
  
  if (totalSecondsUntil <= 0) return '0 min';
  
  const mins = Math.floor(totalSecondsUntil / 60);
  const secs = totalSecondsUntil % 60;
  
  if (mins === 0) return `${secs} sec`;
  return `${mins} min ${secs} sec`;
};

const getProgressPercentage = (startTime: string, endTime: string): number => {
  const now = getCurrentTime();
  const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  if (currentMinutes < startMinutes) return 0;
  if (currentMinutes >= endMinutes) return 100;
  
  const progress = ((currentMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
  return Math.min(100, Math.max(0, progress));
};

const BellSchedule: React.FC = () => {
  const tuesday = isTuesday();
  const [currentSchedule] = useState<BellSchedule>(tuesday ? SCHEDULES[1] : SCHEDULES[0]);
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [isVisible, setIsVisible] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 4000);
    
    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    if (activeItemRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeElement = activeItemRef.current;
      
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentTime]);
  
  const weekend = isWeekend();
  
  let currentPeriodIndex = -1;
  let isInPassing = false;
  let passingPeriodInfo: { from: SchedulePeriod; to: SchedulePeriod } | null = null;
  
  if (!weekend) {
    for (let i = 0; i < currentSchedule.periods.length; i++) {
      const period = currentSchedule.periods[i];
      if (isCurrentPeriod(period.startTime, period.endTime)) {
        currentPeriodIndex = i;
        break;
      }
    }
    
    if (currentPeriodIndex === -1) {
      for (let i = 0; i < currentSchedule.periods.length - 1; i++) {
        const currentPeriod = currentSchedule.periods[i];
        const nextPeriod = currentSchedule.periods[i + 1];
        
        if (isInPassingPeriod(currentPeriod.endTime, nextPeriod.startTime)) {
          isInPassing = true;
          passingPeriodInfo = { from: currentPeriod, to: nextPeriod };
          currentPeriodIndex = i;
          break;
        }
      }
    }
  }

  const currentPeriod = currentPeriodIndex >= 0 ? currentSchedule.periods[currentPeriodIndex] : null;
  const progressPercentage = currentPeriod && !isInPassing ? getProgressPercentage(currentPeriod.startTime, currentPeriod.endTime) : 0;

  return (
    <div className="bell-schedule-wrapper">
      <style>{`
        .bell-schedule-wrapper {
          margin-top:-7px;
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          min-height: 0;
        }
        
        .bell-countdown {
          padding: 1.5vh 4%;
          background: hsl(var(--sidebarItem));
          border-radius: 8px;
          margin: 0 4% 1.5vh 4%;
          flex-shrink: 0;
        }
        
        .bell-countdown-content {
    
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .bell-status {
          font-size: 10px;
          font-weight: 600;
          color: hsl(var(--muted-foreground));
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        
        .bell-time {
        
          margin-bottom: 2px;
          font-size: clamp(20px, 3vh, 28px);
          font-weight: 600;
          color: hsl(var(--foreground));
          font-variant-numeric: tabular-nums;
          line-height: 1;
          letter-spacing: -.5px;
        }
        
        .bell-progress-bar {
          width: 100%;
          height: 4px;
          background: hsl(var(--muted) / 0.3);
          border-radius: 2px;
          margin-top: 1vh;
          overflow: hidden;
        }
        
        .bell-progress-fill {
          height: 100%;
          background: hsl(var(--accent));
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        
        .bell-periods {
          margin-top:-9px;

          flex: 1;
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          min-height: 0;
          padding: 0 4%;
        }
        
        .bell-periods::-webkit-scrollbar {
          display: none;
        }
        
        .bell-period {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.8vh 3%;
          background: hsl(var(--sidebarItem));
          border-radius: 6px;
          margin-bottom: 0.5vh;
          position: relative;
          min-height: 0;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        
        .bell-period:hover {
          background: hsl(var(--muted) / 0.2);
          transform: translateY(-1px);
        }
        
        .bell-period.active {
          background: hsl(var(--accent) / 0.05);
          border: 1px solid hsl(var(--accent) / 0.1);
        }
        
        .bell-period.passing {
          background: hsl(var(--accent) / 0.08);
          border: 1px solid hsl(var(--accent) / 0.2);
        }
        
        .bell-period-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .bell-period-name {
          font-size: 13px;
          font-weight: 500;
          color: hsl(var(--foreground));
          letter-spacing: -0.1px;
        }
        
        .bell-period.active .bell-period-name {
          font-weight: 600;
          color: hsl(var(--accent-foreground));
        }
        
        .bell-period.passing .bell-period-name {
          font-weight: 600;
          color: hsl(var(--accent-foreground));
        }
        
        .bell-period.break-row .bell-period-name {
          color: hsl(var(--muted-foreground));
        }
        
        .bell-now-dot {
          margin-top: 2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: hsl(var(--accent));
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }
        
        .bell-period-times {
          font-size: 14px;
          color: hsl(var(--accent-foreground)/0.6);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          font-weight: 600;
          background: hsl(var(--muted) / 0.4);
          padding: 5px 12px;
          border-radius: 6px;
          letter-spacing: -0.3px;
        }
        
        .bell-period.active .bell-period-times {
          color: hsl(var(--accent-foreground)/0.8);
          background: hsl(var(--accent) / 0.15);
          font-weight: 600;
        }
        
        .bell-period.passing .bell-period-times {
          color: hsl(var(--accent-foreground)/0.8);
          background: hsl(var(--accent) / 0.15);
          font-weight: 600;
        }
      `}</style>
      
      {isVisible && (
        <>
      <div className="bell-countdown">
        <div className="bell-countdown-content">
          <span className="bell-status">
            {weekend ? 'Weekend' : isInPassing ? 'Until Class' : currentPeriodIndex >= 0 ? (currentSchedule.periods[currentPeriodIndex].isBreak ? 'Break Ends' : 'Class Ends') : 'Current Time'}
          </span>
          <span className="bell-time">
            {weekend ? 'No School' : isInPassing && passingPeriodInfo ? getTimeUntilStart(passingPeriodInfo.to.startTime) : currentPeriodIndex >= 0 ? getTimeRemaining(currentSchedule.periods[currentPeriodIndex].endTime) : formatCurrentTime()}
          </span>
        </div>
        {!weekend && currentPeriod && !isInPassing && (
          <div className="bell-progress-bar">
            <div className="bell-progress-fill" style={{ width: `${progressPercentage}%` }}></div>
          </div>
        )}
      </div>
      
      <div className="bell-periods" ref={scrollContainerRef}>
        {currentSchedule.periods.map((period, index) => {
          const isCurrent = !weekend && currentPeriodIndex === index && !isInPassing;
          const isPassing = !weekend && isInPassing && currentPeriodIndex === index;
          
          return (
            <div
              key={index}
              ref={(isCurrent || isPassing) ? activeItemRef : null}
              className={`bell-period ${isCurrent ? 'active' : ''} ${isPassing ? 'passing' : ''} ${period.isBreak ? 'break-row' : ''}`}
            >
              <div className="bell-period-left">
                <span className="bell-period-name">{period.name}</span>
                {(isCurrent || isPassing) && (
                  <div className="bell-now-dot"></div>
                )}
              </div>
              <span className="bell-period-times">
                {period.startTime} – {period.endTime}
              </span>
            </div>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
};

export default BellSchedule;