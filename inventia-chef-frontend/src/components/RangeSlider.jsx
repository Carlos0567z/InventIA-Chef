import React from 'react';
import './RangeSlider.css';

const RangeSlider = ({ min, max, value, onChange, label, unit = '' }) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const backgroundStyle = {
    background: `linear-gradient(to right, #f43f5e ${percentage}%, #e2e8f0 ${percentage}%)`
  };

  return (
    <div className="range-slider-container">
      <div className="range-slider-header">
        <span className="range-slider-label">{label}</span>
        <span className="range-slider-value">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-slider-input"
        style={backgroundStyle}
      />
      <div className="range-slider-footer">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
};

export default RangeSlider;
