import React from 'react';
import '../styles/slider.css';


interface SliderProps {
  onViewChange: (view: string) => void;
}

const Slider: React.FC<SliderProps> = ({ onViewChange }) => {
    console.log('Slider rendered');

  const handleSliderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedView = event.target.value;
    onViewChange(selectedView); // Pass the selected view to parent component
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <label htmlFor="view-slider">Select View: </label>
      <select
        id="view-slider"
        onChange={handleSliderChange}
        style={{ padding: '5px', fontSize: '16px' }}
      >
        <option value="dayGridMonth">Month View</option>
        <option value="timeGridWeek">Week View</option>
        <option value="timeGridDay">Day View</option>
      </select>
    </div>
  );
};

export default Slider;
