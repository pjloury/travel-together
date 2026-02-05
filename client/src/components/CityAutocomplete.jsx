import { useState } from 'react';

// Simple city input for now - can be upgraded to Google Places later
// For Phase 1, we use a simple text input
export default function CityAutocomplete({ onSelect, countryCode, placeholder = "Add a city..." }) {
  const [value, setValue] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (value.trim()) {
      onSelect({
        cityName: value.trim(),
        placeId: null // Would be set by Google Places in full implementation
      });
      setValue('');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="city-input-form">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="city-input"
      />
      <button type="submit" className="add-city-btn">+</button>
    </form>
  );
}

