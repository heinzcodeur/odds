import React from 'react';
import { MATCH_SPORTS } from '../utils/betting.js';

export default function SportFilter({ value, onChange }) {
  return (
    <select aria-label="Filtrer par sport" value={value} onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-300">
      <option value="all">Tous les sports</option>
      {Object.entries(MATCH_SPORTS).map(([sport, label]) => (
        <option key={sport} value={sport}>{label}</option>
      ))}
      <option value="unknown">Sport non renseigné</option>
    </select>
  );
}
