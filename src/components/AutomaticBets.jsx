import React, { useEffect, useState } from 'react';
import { formatMatchDate, getPositionAmounts, matchAvailableForAutomaticBets } from '../utils/betting.js';

export default function AutomaticBets({ matches, markets, defaultOdds, defaultStake, onCreate }) {
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [market, setMarket] = useState('over-0-5');
  const [type, setType] = useState('BACK');
  const [odds, setOdds] = useState(defaultOdds);
  const [stake, setStake] = useState(defaultStake);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [open]);
  const eligible = matches.filter((match) => (!match.sport || match.sport === 'football') && matchAvailableForAutomaticBets(match, now));
  eligible.sort((a, b) => a.matchTime.localeCompare(b.matchTime));
  const selectedMatches = eligible.filter((match) => selected.includes(match.id));
  const numericOdds = Number(odds);
  const numericStake = Number(stake);
  const validAmounts = Number.isFinite(numericOdds) && numericOdds >= 1.01
    && Number.isFinite(numericStake) && numericStake >= 0.01;
  const amounts = validAmounts ? getPositionAmounts(type, numericOdds, numericStake) : null;
  const exposure = amounts ? (type === 'LAY' ? amounts.liability : numericStake) : null;
  const inputClass = 'mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100';
  return <div>
    <button type="button" onClick={() => { setNow(new Date()); setOpen(true); setError(''); setSuccess(''); }}
      className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-300">
      Paris automatiques
    </button>
    {success && <p role="status" className="mt-2 text-sm text-emerald-300">{success}</p>}
    {open && <dialog
      ref={(dialog) => { if (dialog && !dialog.open) dialog.showModal(); }}
      onClose={() => setOpen(false)}
      aria-labelledby="automatic-bets-title"
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 backdrop:bg-black/60">
      <h2 id="automatic-bets-title" className="text-lg font-semibold">Paris automatiques · dry-run</h2>
      <form onSubmit={(event) => {
        event.preventDefault();
        const message = onCreate({
          matchIds: selectedMatches.map(({ id }) => id),
          marketId: market, type, odds: Number(odds), stake: Number(stake),
        });
        if (message) { setError(message); return; }
        setSuccess(`${selectedMatches.length} positions dry-run créées.`);
        setSelected([]);
        setOpen(false);
      }} className="mt-4 space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm text-slate-300">Sélectionne au moins deux matchs de football du jour</legend>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {eligible.map((match) => <label key={match.id} className="flex items-center gap-3 rounded-lg border border-slate-800 p-3 text-sm">
              <input type="checkbox" checked={selected.includes(match.id)} onChange={(event) =>
                setSelected((items) => event.target.checked ? [...items, match.id] : items.filter((id) => id !== match.id))} />
              <span>{match.homeTeam} – {match.awayTeam}
                <span className="block text-xs text-slate-400">{formatMatchDate(match.matchDate, match.matchTime)}</span>
              </span>
            </label>)}
            {!eligible.length && <p className="text-sm text-slate-400">Aucun match de football du jour disponible.</p>}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
          <label>Marché<select value={market} onChange={(event) => setMarket(event.target.value)} className={inputClass}>
            {markets.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          <label>Type<select value={type} onChange={(event) => setType(event.target.value)} className={inputClass}>
            <option value="BACK">Back</option><option value="LAY">Lay</option>
          </select></label>
          <label>Cote d’entrée<input required type="number" min="1.01" step="0.01" value={odds}
            onChange={(event) => setOdds(event.target.value)} className={inputClass} /></label>
          <label>{type === 'LAY' ? 'Mise Lay par match (€)' : 'Mise par match (€)'}<input required type="number" min="0.01" step="0.01" value={stake}
            onChange={(event) => setStake(event.target.value)} className={inputClass} /></label>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300" aria-live="polite">
          <p>{type === 'LAY' ? 'Liability par match' : 'Somme engagée par match'} · {exposure === null ? '—' : exposure.toFixed(2) + ' €'}</p>
          <p>{selectedMatches.length} positions · Somme totale engagée · {exposure === null ? '—' : (selectedMatches.length * exposure).toFixed(2) + ' €'}</p>
          <p className="mt-1 text-xs text-slate-400">Objectif de gain à 40 %</p>
        </div>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-slate-800">Annuler</button>
          <button type="submit" disabled={selectedMatches.length < 2}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold disabled:opacity-40">Créer les positions dry-run</button>
        </div>
      </form>
    </dialog>}
  </div>;
}
