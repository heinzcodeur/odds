import { MATCH_SPORTS } from '../utils/betting.js';
import React from 'react';

export default function SportSelect({ value, onChange, placeholder = 'Non renseigné' }) {
  return (
    <label className="text-xs text-slate-400">
      Sport
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)}
        className="ml-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200">
        <option value="">{placeholder}</option>
        {Object.entries(MATCH_SPORTS).map(([sport, label]) => (
          <option key={sport} value={sport}>{label}</option>
        ))}
      </select>
    </label>
  );
}
