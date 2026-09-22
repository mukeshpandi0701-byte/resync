import React, { useContext } from 'react';
import { AppContext } from '../App';

export default function IdentitySelector() {
  const { actor } = useContext(AppContext);

  const handleSwitch = (e) => {
    localStorage.setItem('resync_actor', e.target.value);
    window.location.reload();
  };

  return (
    <div className="identity-selector" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#697386' }}>ROLE:</span>
      <select 
        value={actor} 
        onChange={handleSwitch}
        style={{
          background: '#FCFAF8', 
          color: '#182235', 
          border: '1px solid #D92F45',
          padding: '4px 10px',
          borderRadius: '6px',
          fontWeight: 600,
          fontSize: '12px',
          outline: 'none',
          cursor: 'pointer'
        }}
      >
        <option value="Inspector A">Inspector A</option>
        <option value="Inspector B">Inspector B</option>
        <option value="Supervisor">Supervisor</option>
      </select>
    </div>
  );
}
