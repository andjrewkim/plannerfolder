import React from 'react';

const ScheduleList = ({ result }: { result: any[] }) => {
  if (!result || result.length === 0) return <p>No events to display.</p>;

  return (
    <div className="extracted-info">
      <h2>Extracted Information:</h2>
      {result.map((event, index) => (
        <div key={index}>
          <p>
            <strong>Event:</strong> <span>{event.event}</span>
          </p>
          <p>
            <strong>Time:</strong> <span>{event.time}</span>
          </p>
          <p>
            <strong>Date:</strong> <span>{event.date}</span>
          </p>
        </div>
      ))}
    </div>
  );
};

export default ScheduleList;
