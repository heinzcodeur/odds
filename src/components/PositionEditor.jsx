import React from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { formatMatchDate, TOTAL_WIN_EXIT_ODDS } from '../utils/betting.js';
import ParticipantSelect from './ParticipantSelect.jsx';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100';

export default function PositionEditor({ bet, matches, marketCatalog = [], closed, onSave, onDelete, onReopen, onClose }) {
  const [confirmReopen, setConfirmReopen] = React.useState(false);
  const [tag, setTag] = React.useState(bet.tag ?? 'prod');
  const [type, setType] = React.useState(bet.type);
  const [entryOdds, setEntryOdds] = React.useState(String(bet.entryOdds));
  const [stake, setStake] = React.useState(String(bet.stake));
  const hasExitQuote = closed && bet.exitOdds !== null && bet.exitOdds !== TOTAL_WIN_EXIT_ODDS;
  const [exitOdds, setExitOdds] = React.useState(String(bet.exitOdds ?? ''));
  const originalMarketId = bet.marketId ?? 'default';
  const [marketId, setMarketId] = React.useState(originalMarketId);
  const originalMatch = matches.find((match) => match.id === (bet.matchId ?? 'legacy-match'));
  const [homeTeam, setHomeTeam] = React.useState(originalMatch?.homeTeam ?? '');
  const [awayTeam, setAwayTeam] = React.useState(originalMatch?.awayTeam ?? '');
  const [matchId, setMatchId] = React.useState(originalMatch?.id ?? '');
  const homeTeams = [...new Set(matches.map((match) => match.homeTeam))].sort((a, b) => a.localeCompare(b, 'fr'));
  const awayTeams = [...new Set(matches.map((match) => match.awayTeam))].sort((a, b) => a.localeCompare(b, 'fr'));
  const matchingMatches = matches.filter((match) => match.homeTeam === homeTeam && match.awayTeam === awayTeam);
  const chosenMatch = matchingMatches.length === 1 ? matchingMatches[0] : matchingMatches.find((match) => match.id === matchId);
  const matchMarkets = chosenMatch?.markets ?? [];
  const matchChanged = chosenMatch && chosenMatch.id !== originalMatch?.id;
  const canUseMarket = (id) => closed || (!matchChanged && id === originalMarketId)
    || matchMarkets.length < 30 || matchMarkets.some((market) => market.id === id);
  const marketOptions = new Map(marketCatalog.map(({ id, name }) => [id, name]));
  for (const match of matches) {
    for (const { id, name } of match.markets ?? []) {
      if (!marketOptions.has(id)) marketOptions.set(id, name);
    }
  }
  for (const { id, name } of matchMarkets) marketOptions.set(id, name);
  if (!marketOptions.has(originalMarketId)) marketOptions.set(originalMarketId, bet.marketName || originalMarketId);
  const options = [...marketOptions].sort(([idA, nameA], [idB, nameB]) => nameA.localeCompare(nameB, 'fr') || idA.localeCompare(idB));
  const labelCounts = new Map();
  for (const [, name] of options) labelCounts.set(name, (labelCounts.get(name) ?? 0) + 1);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const save = (event) => {
    event.preventDefault();
    const entry = Number(entryOdds), amount = Number(stake), exit = Number(exitOdds);
    if (!chosenMatch || !canUseMarket(marketId) || !Number.isFinite(entry) || entry <= 1 || !Number.isFinite(amount) || amount <= 0 || (hasExitQuote && (!Number.isFinite(exit) || exit <= 1))) return;
    const marketChange = marketId === originalMarketId
      ? {} : { marketId, categoryId: marketId, marketName: marketOptions.get(marketId) };
    const matchChange = matchChanged ? {
      matchId: chosenMatch.id,
      matchName: `${chosenMatch.homeTeam} vs ${chosenMatch.awayTeam}`,
      matchDate: chosenMatch.matchDate,
      matchTime: chosenMatch.matchTime,
      marketName: marketOptions.get(marketId),
    } : {};
    onSave({ type, tag, entryOdds: entry, stake: amount, ...(hasExitQuote ? { exitOdds: exit } : {}), ...matchChange, ...marketChange });
  };
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="position-editor-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
    <header className="mb-4 flex items-center justify-between"><h3 id="position-editor-title" className="flex items-center gap-2 text-lg font-bold text-slate-100"><Pencil className="h-4 w-4 text-amber-300" />Modifier la position</h3><button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button></header>
    <form onSubmit={save} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400">Type<select value={type} onChange={(event) => setType(event.target.value)} className={inputClass}><option value="BACK">Back · Pour</option><option value="LAY">Lay · Contre</option></select></label><label className="text-xs text-slate-400">Marché
      <select value={marketId} onChange={(event) => setMarketId(event.target.value)} className={inputClass}>
        {options.map(([id, name]) => (
          <option key={id} value={id} disabled={!canUseMarket(id)}>
            {labelCounts.get(name) > 1 ? `${name} (${id})` : name}
          </option>
        ))}
      </select></label></div><fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="text-xs text-slate-400">Participants du match</legend>
        <div className="text-xs text-slate-400">Domicile
          <ParticipantSelect label="Participant à domicile" participants={homeTeams} value={homeTeam} onChange={(name) => { setHomeTeam(name); setMatchId(''); }} className={inputClass} />
        </div>
        <div className="text-xs text-slate-400">Visiteur
          <ParticipantSelect label="Participant visiteur" participants={awayTeams} value={awayTeam} onChange={(name) => { setAwayTeam(name); setMatchId(''); }} className={inputClass} />
        </div>
        {matchingMatches.length > 1 && (
          <label className="text-xs text-slate-400 sm:col-span-2">Match à rattacher
            <select value={matchId} onChange={(event) => setMatchId(event.target.value)} className={inputClass}>
              <option value="">Choisir un match</option>
              {matchingMatches.map((match, index) => (
                <option key={match.id} value={match.id}>Match {index + 1} · {formatMatchDate(match.matchDate, match.matchTime) || 'Date non renseignée'}</option>
              ))}
            </select>
          </label>
        )}
        {homeTeam && awayTeam && !matchingMatches.length && (
          <p role="status" className="text-xs text-amber-300 sm:col-span-2">Aucun match enregistré pour ces participants. Crée d’abord le match.</p>
        )}
        {chosenMatch && !canUseMarket(marketId) && (
          <p role="status" className="text-xs text-amber-300 sm:col-span-2">Ce match a atteint sa limite de marchés. Choisis un marché déjà associé au match.</p>
        )}
      </fieldset><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400">Cote d’entrée<input type="number" min="1.01" step="0.01" value={entryOdds} onChange={(event) => setEntryOdds(event.target.value)} className={inputClass} /></label><label className="text-xs text-slate-400">Mise / stake (€)<input type="number" min="0.01" step="0.01" value={stake} onChange={(event) => setStake(event.target.value)} className={inputClass} /></label>{hasExitQuote && <label className="text-xs text-slate-400">Cote de sortie<input type="number" min="1.01" step="0.01" value={exitOdds} onChange={(event) => setExitOdds(event.target.value)} className={inputClass} /></label>}</div>
      <label className="block text-xs text-slate-400">
        Tag de la position
        <select value={tag} onChange={(event) => setTag(event.target.value)} className={inputClass}>
          <option value="prod">prod</option>
          <option value="dry-run">dry-run</option>
        </select>
      </label>
      {closed && onReopen && (
        confirmReopen ? (
          <div className="rounded-lg border border-slate-700 p-3 text-sm text-slate-200">
            <p>Rouvrir cette position et annuler le résultat de la coupure ?</p>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmReopen(false)} className="rounded-lg px-3 py-2 hover:bg-slate-800">Annuler</button>
              <button type="button" onClick={onReopen} className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-500">Rouvrir la position</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmReopen(true)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-indigo-300 hover:bg-slate-800">
            Annuler la coupure
          </button>
        )
      )}
      {confirmDelete ? <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">Supprimer définitivement cette position ?<div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Annuler</button><button type="button" onClick={() => onDelete(bet)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500">Supprimer</button></div></div> : <footer className="flex justify-between border-t border-slate-800 pt-4"><button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" />Supprimer</button><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Annuler</button><button type="submit" disabled={!chosenMatch || !canUseMarket(marketId)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">Enregistrer</button></div></footer>}
    </form>
  </section></div>;
}
