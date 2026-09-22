import React, { useContext } from 'react';
import { AppContext } from '../App';

export default function IdentitySelector() {
  const { actor } = useContext(AppContext);

  const handleSwitch = (e) => {
    localStorage.setItem('resync_actor', e.target.value);
    window.location.reload();
  };

  return (
    <div className="identity-selector" style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
      <span style={{fontSize: '12px', color: '#B1A8C2'}}>USER:</span>
      <select 
        value={actor} 
        onChange={handleSwitch}
        style={{
          background: '#1E1B29', 
          color: '#F8FAFC', 
          border: '1px solid #7C3AED',
          padding: '4px 8px',
          borderRadius: '4px',
          outline: 'none'
        }}
      >
        <option value="Inspector A">Inspector A</option>
        <option value="Inspector B">Inspector B</option>
        <option value="Supervisor">Supervisor</option>
      </select>
    </div>
  );
}
