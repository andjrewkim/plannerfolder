import React, { useState, useEffect, useRef } from 'react';
import { useStreaks } from '../../contexts/useStreaks';
import '../../styles/streakindicator.css';

const StreakIndicator: React.FC = () => {
  const { streakData, loading } = useStreaks();
  const [showTooltip, setShowTooltip] = useState(false);
  const [celebrationActive, setCelebrationActive] = useState(false);
  const [displayedStreak, setDisplayedStreak] = useState(0);
  const [oldStreak, setOldStreak] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const prevStreakRef = useRef(0);
  const hasInitialized = useRef(false);

  const { 
    currentStreak, 
    maxStreak, 
    assignmentsCompletedToday, 
    totalAssignmentsToday, 
    weekActivity, 
    isLit 
  } = streakData;

  // Initialize displayed streak on first load
  useEffect(() => {
    if (!hasInitialized.current && !loading) {
      setDisplayedStreak(currentStreak);
      prevStreakRef.current = currentStreak;
      hasInitialized.current = true;
    }
  }, [currentStreak, loading]);

  // Detect streak changes and trigger animations
  useEffect(() => {
    if (!hasInitialized.current) return;

    
    // Only animate if streak actually increased
    if (currentStreak > prevStreakRef.current && currentStreak > 0) {
      console.log('🎉 Streak increased! Triggering celebration');
      
      // Start celebration
      setCelebrationActive(true);
      
      // Start rolling animation
      setOldStreak(prevStreakRef.current);
      setIsRolling(true);
      
      // Update displayed value after a short delay
      setTimeout(() => {
        setDisplayedStreak(currentStreak);
      }, 100);
      
      // End rolling animation
      setTimeout(() => {
        setIsRolling(false);
        setOldStreak(null);
        prevStreakRef.current = currentStreak;
      }, 800);
      
      // End celebration
      setTimeout(() => {
        setCelebrationActive(false);
      }, 1500);
    } else if (currentStreak !== prevStreakRef.current) {
      // Streak changed but didn't increase (reset or initial load)
      setDisplayedStreak(currentStreak);
      prevStreakRef.current = currentStreak;
    }
  }, [currentStreak]);

  const progress = Math.min((currentStreak / maxStreak) * 100, 100);
  const isFilled = progress >= 100;
  const daysOfWeek = ['M', 'T', 'W', 'T', 'F'];
  
  // Filter weekActivity to only show Monday-Friday (indices 1-5)
  const weekdayActivity = weekActivity.slice(1, 6);
  
  // Get current day (0=Sun, 1=Mon, ..., 6=Sat)
  const today = new Date().getDay();
  
  // Calculate completed and missed days (only count past weekdays as missed)
  let completedDays = 0;
  let missedDays = 0;
  
  weekdayActivity.forEach((completed, index) => {
    const actualDayIndex = index + 1; // 1=Mon, 2=Tue, ..., 5=Fri
    
    // Only count if the day has already passed (is before or equal to today)
    if (actualDayIndex <= today) {
      if (completed) {
        completedDays++;
      } else {
        missedDays++;
      }
    }
  });

  if (loading && !hasInitialized.current) {
    return (
      <div className="streak-indicator-wrapper">
        <div className="streak-indicator">
          <div className="streak-content">
            <div className="fire-icon unlit">
              <div className="fire-rotation-wrapper">
                <div className="fire-container">
                  <div className="flame-wrapper flame-left-wrapper">
                    <div className="flame flame-left"></div>
                  </div>
                  <div className="flame-wrapper flame-right-wrapper">
                    <div className="flame flame-right"></div>
                  </div>
                  <div className="flame flame-main"></div>
                  <div className="flame flame-center"></div>
                </div>
              </div>
            </div>
            <div className="streak-center">
              <div className="streak-top-row">
                <div className="streak-number-container">
                  <div className="streak-number-wrapper">
                    <div className="streak-number">0</div>
                  </div>
                </div>
                <div className="streak-label-wrapper">
                  <span className="streak-label">Day</span>
                  <span className="streak-label">Streak</span>
                </div>
              </div>
              <div className="streak-bar-container">
                <div className="streak-bar-bg">
                  <div className="streak-bar-fill" style={{ width: '0%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="streak-indicator-wrapper">
      {showTooltip && (
        <div className="streak-tooltip">
          <div className="tooltip-title">Don't let the fire go out.</div>
          <div className="tooltip-text">
            Complete 1 action a day to keep the fire alive.
          </div>
          <div className="tooltip-stats">
            <span className="tooltip-stat-good">{completedDays} days active</span>
            <span className="tooltip-divider">•</span>
            <span className={missedDays > 2 ? "tooltip-stat-bad" : "tooltip-stat-ok"}>
              {missedDays} weekdays missed
            </span>
          </div>
          <div className="tooltip-rule">
            The fire cannot go out during weekends. Enjoy your break!
          </div>
        </div>
      )}
      
      <div 
        className="streak-indicator"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="streak-content">
          {/* Fire Icon with Animation */}
          <div className={`fire-icon ${isFilled || isLit ? 'lit' : 'unlit'}`}>
            <div className="fire-rotation-wrapper">
              <div className="fire-container">
                {/* Flame layers */}
                <div className="flame-wrapper flame-left-wrapper">
                  <div className="flame flame-left"></div>
                </div>
                <div className="flame-wrapper flame-right-wrapper">
                  <div className="flame flame-right"></div>
                </div>
                <div className="flame flame-main"></div>
                <div className="flame flame-center"></div>
              </div>
            </div>
            
            {/* Celebration particles - falling sparks that light the fire */}
            {celebrationActive && (
              <div className="celebration-particles">
                {[...Array(12)].map((_, i) => {
                  const xOffset = (Math.random() - 0.5) * 30; // Random horizontal spread -15px to +15px
                  const rotation = (Math.random() - 0.5) * 40; // Random rotation -20deg to +20deg
                  return (
                    <div 
                      key={i} 
                      className="particle"
                      style={{
                        '--particle-x': `${xOffset}px`,
                        '--particle-rotate': `${rotation}deg`,
                        '--particle-delay': `${i * 0.05}s`
                      } as React.CSSProperties}
                    />
                  );
                })}
              </div>
            )}
            
            {/* Glow pulse effect */}
            {(isFilled || isLit) && (
              <div className="fire-glow"></div>
            )}
          </div>

          {/* Center Streak Info */}
          <div className="streak-center">
            <div className="streak-top-row">
              <div className="streak-number-container">
                <div className="streak-number-wrapper">
                  {isRolling && oldStreak !== null && (
                    <div className="streak-number rolling-out">
                      {oldStreak}
                    </div>
                  )}
                  <div className={`streak-number ${isRolling ? 'rolling-in' : ''}`}>
                    {displayedStreak}
                  </div>
                </div>
                {celebrationActive && (
                  <div className="streak-plus-one">+1</div>
                )}
              </div>
              <div className="streak-label-wrapper">
                <span className="streak-label">Day</span>
                <span className="streak-label">Streak</span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="streak-bar-container">
              <div className="streak-bar-bg">
                <div 
                  className={`streak-bar-fill ${isFilled ? 'complete' : ''}`}
                  style={{ width: `${progress}%` }}
                >
                  {isFilled && <div className="bar-shimmer"></div>}
                </div>
              </div>
              <div className="streak-progress-text">
              </div>
            </div>
          </div>

          {/* Week Activity Dots */}
          <div className="week-activity">
            <div className="week-label">This Week</div>
            <div className="week-dots-container">
              {weekdayActivity.map((completed, index) => {
                // The actual day index in the full week (1=Mon, 2=Tue, etc.)
                const actualDayIndex = index + 1;
                const isToday = actualDayIndex === today;
                
                return (
                  <div key={actualDayIndex} className="day-column">
                    <div 
                      className={`activity-dot ${completed ? 'completed' : 'missed'} ${isToday ? 'today' : ''}`}
                      title={`${daysOfWeek[index]} - ${completed ? 'Completed' : 'Missed'}`}
                    >
                      {isToday && <div className="today-ring"></div>}
                      {completed && (
                        <svg className="check-icon" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className={`day-letter ${isToday ? 'today' : ''}`}>
                      {daysOfWeek[index]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreakIndicator;