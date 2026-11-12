import React, { useState } from 'react';

export default function ParticipantSelect({ label, participants, value, otherParticipant, onChange, onCreate, className }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');

  const [creatingParticipant, setCreatingParticipant] = useState(false);
  const createParticipant = async (event) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name || creatingParticipant) return;
    setCreatingParticipant(true);
    const message = await onCreate(name);
    setCreatingParticipant(false);
    setError(message);
    if (message) return;
    onChange(name);
    setDraft(null);
  };

  const select = (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={className}>
      <option value="">Choisir un participant</option>
      {participants.map((name) => (
        <option key={name} value={name} disabled={name === otherParticipant && name !== value}>{name}</option>
      ))}
    </select>
  );
  if (!onCreate) return select;

  return (
    <div className="min-w-0 space-y-1">
      {select}
      {draft === null ? (
        <button type="button" onClick={() => setDraft('')} className="text-left text-xs text-indigo-300 hover:underline">
          + Créer un joueur ou une équipe
        </button>
      ) : (
        <form onSubmit={createParticipant} className="space-y-1.5 rounded-lg border border-slate-700 bg-slate-900 p-2">
          <input
            autoFocus
            required
            aria-label={`Nouveau nom — ${label}`}
            placeholder="Nom du joueur ou de l’équipe"
            maxLength={60}
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setError(''); }}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
          />
          {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
          <div className="flex flex-wrap gap-1.5">
            <button type="submit" disabled={creatingParticipant} className="rounded-md bg-emerald-600 px-2 py-1.5 text-xs text-white">Créer et sélectionner</button>
            <button type="button" disabled={creatingParticipant} onClick={() => { setDraft(null); setError(''); }} className="rounded-md px-2 py-1.5 text-xs text-slate-300">Annuler</button>
          </div>
        </form>
      )}
    </div>
  );
}
