import React, { useState } from 'react';
import '../../styles/streakindicator.css';

interface StreakIndicatorProps {
  currentStreak: number;
  maxStreak: number;
  assignmentsCompletedToday: number;
  totalAssignmentsToday: number;
  weekActivity: boolean[];
  isLit?: boolean;
}

const StreakIndicator: React.FC<StreakIndicatorProps> = ({ 
  currentStreak, 
  maxStreak,
  assignmentsCompletedToday,
  totalAssignmentsToday,
  weekActivity = [false, false, false, false, false, false, false],
  isLit = false 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const progress = Math.min((currentStreak / maxStreak) * 100, 100);
  const isFilled = progress >= 100;
  const todayComplete = assignmentsCompletedToday >= totalAssignmentsToday;
  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

return (
  <div className="streak-indicator-wrapper">
    {showTooltip && (
      <div className="streak-tooltip">
        You can only miss 2 days of the week of activity
      </div>
    )}
    
    <div 
      className="streak-indicator"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="streak-content">
        {/* Pure CSS Fire Icon */}
        <div className={`fire-icon ${isFilled || isLit ? 'lit' : 'unlit'}`}>
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

        {/* Center Info */}
        <div className="streak-center">
          <div className="streak-number">{currentStreak}</div>
          <div className="streak-label">day streak</div>
          <div className="streak-bar-bg">
            <div 
              className="streak-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Week Activity */}
        <div className="week-activity">
          {weekActivity.map((completed, index) => (
            <div key={index} className="day-column">
              <div className={`activity-dot ${completed ? 'completed' : 'missed'}`} />
              <span className="day-letter">{daysOfWeek[index]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
}

export default StreakIndicator;