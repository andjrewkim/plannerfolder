import React from 'react';

const ScheduleList = ({ result }: { result: any }) => {
  if (!result) return null;

  return (
    <div className="extracted-info">
      <h2>Extracted Information:</h2>
      <p>
        <strong>Event:</strong> <span>{result.event}</span>
      </p>
      <p>
        <strong>Time:</strong> <span>{result.time}</span>
      </p>
      <p>
        <strong>Date:</strong> <span>{result.date}</span>
      </p>
    </div>
  );
};

export default ScheduleList;
