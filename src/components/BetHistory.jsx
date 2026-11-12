import React, { useState } from 'react';
import { ArrowLeft, History, Pencil } from 'lucide-react';
import { calculatePnL, closureDateTime, formatExitOdds, formatMatchDate, getPositionAmounts, localDateKey, matchesHistoryPeriod } from '../utils/betting.js';
import { teamsForBet, teamsForBets } from '../utils/betTeams.js';
import PositionEditor from './PositionEditor.jsx';

const signedEuros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  signDisplay: 'exceptZero',
});

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

function closedAtLabel(bet) {
  const date = closureDateTime(bet.closedAt);
  return date ? date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }) : bet.closedAt;
}

function PositionDetails({ bet, result, onClose }) {
  const { liability, matchedStake } = getPositionAmounts(bet.type, bet.entryOdds, bet.stake);
  const fields = [
    ['Marché', bet.marketName || 'Non renseigné'],
    ['Type de position', bet.type === 'LAY' ? 'Contre (Lay)' : 'Pour (Back)'],
    ['Date du match', formatMatchDate(bet.matchDate, bet.matchTime) || 'Non renseignée'],
    ['Ouverture', bet.timestamp || 'Non renseignée'],
    ['Cote d’entrée', bet.entryOdds.toFixed(2)],
    ['Cote de sortie', formatExitOdds(bet.exitOdds)],
    [bet.type === 'LAY' ? 'Mise Lay' : 'Mise Back', euros.format(matchedStake)],
    ...(bet.type === 'LAY' ? [['Liability', euros.format(liability)]] : []),
    ['Coupure', closedAtLabel(bet) || 'Non renseignée'],
  ];
  return (
    <dialog
      ref={(dialog) => { if (dialog && !dialog.open) dialog.showModal(); }}
      onClose={onClose}
      onKeyDown={(event) => { if (event.key === 'Escape') event.stopPropagation(); }}
      aria-labelledby="position-details-title"
      className="m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-y-auto bg-slate-950 p-0 text-slate-100"
    >
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
        <form method="dialog">
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
            <ArrowLeft className="h-4 w-4" /> Retour à l’historique
          </button>
        </form>
        <header className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 id="position-details-title" className="text-sm font-medium text-slate-400">Détail de la position fermée</h2>
          <p className="mt-1 break-words text-2xl font-bold">{bet.matchName || 'Match non renseigné'}</p>
          <p className="mt-4 text-sm text-slate-400">Résultat net</p>
          <p className={`text-3xl font-bold tabular-nums ${result > 0 ? 'text-emerald-400' : result < 0 ? 'text-rose-400' : 'text-slate-100'}`}>
            {signedEuros.format(result)}
          </p>
        </header>
        <dl className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <dt className="text-xs font-medium text-slate-400">{label}</dt>
              <dd className="mt-1 break-words text-base font-semibold text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  );
}

export default function BetHistory({ bets, matches = [], marketCatalog, onClear, onEdit, onDelete, onReopen }) {
  const [historyFilter, setHistoryFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('matches-today');
  const [specificDate, setSpecificDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('recent');
  const [editingBet, setEditingBet] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const detailsBet = detailsId ? bets.find((bet) => bet.id === detailsId) : null;
  const [pendingReopenId, setPendingReopenId] = useState(null);
  const teams = teamsForBets(bets, matches);
  const markets = [...new Set([
    ...bets.map((bet) => bet.marketName),
    ...matches.flatMap((match) => (match.markets ?? []).map((market) => market.name)),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const resultFor = (bet) => {
    if (Number.isFinite(bet.finalPnL)) return bet.finalPnL;
    return calculatePnL(bet.type, Number(bet.entryOdds), bet.exitOdds, Number(bet.stake));
  };
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const singleDate = { today: localDateKey(today), yesterday: localDateKey(yesterday), exact: specificDate }[dateFilter];
  const from = dateFilter === 'range' ? startDate : singleDate;
  const to = dateFilter === 'range' ? endDate : singleDate;
  const invalidRange = Boolean(from && to && from > to);
  const matchDates = new Map(matches.map((match) => [match.id, match.matchDate]));
  const filteredBets = bets.filter((bet) => {
    if (dateFilter === 'matches-today'
      && (matchDates.get(bet.matchId) || bet.matchDate) !== localDateKey(today)) return false;
    if (!matchesHistoryPeriod(bet, from, to)) return false;
    const matchesTeamOrMatch = historyFilter === 'all'
      || (historyFilter.startsWith('team:') && teamsForBet(bet, matches).includes(historyFilter.slice(5)))
      || (historyFilter.startsWith('match:') && bet.matchId === historyFilter.slice(6));
    const result = resultFor(bet);
    const matchesResult = resultFilter === 'all'
      || (resultFilter === 'lost' && result < 0)
      || (resultFilter === 'won' && result >= 0);
    const matchesType = typeFilter === 'all' || bet.type === typeFilter;
    const matchesMarket = marketFilter === 'all' || bet.marketName === marketFilter;
    return matchesTeamOrMatch && matchesResult && matchesType && matchesMarket;
  });
  const totalPnL = Number(filteredBets.reduce((total, bet) => total + resultFor(bet), 0).toFixed(2));
  const visibleBets = [...filteredBets];
  if (sortOrder === 'oldest') visibleBets.reverse();
  if (sortOrder === 'lowest-pnl') visibleBets.sort((a, b) => resultFor(a) - resultFor(b));
  if (sortOrder === 'highest-pnl') visibleBets.sort((a, b) => resultFor(b) - resultFor(a));
  return <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl"><div className="flex flex-wrap items-center justify-between gap-2 mb-4"><h3 className="text-base font-semibold text-slate-200 flex items-center gap-2"><History className="w-5 h-5 text-emerald-400" />Historique des Positions Fermées</h3><div className="flex flex-wrap items-center gap-2"><select aria-label="Filtrer par résultat" value={resultFilter} onChange={(event) => setResultFilter(event.target.value)} className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-300"><option value="all">Tous les résultats</option><option value="lost">Perdus</option><option value="won">Gagnés</option></select><select aria-label="Filtrer par type de pari" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-300"><option value="all">Tous les types</option><option value="BACK">Back · Pour</option><option value="LAY">Lay · Contre</option></select><select aria-label="Filtrer par marché" value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} className="max-w-48 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-300"><option value="all">Tous les marchés</option>{markets.map((market) => <option key={market} value={market}>{market}</option>)}</select><select aria-label="Filtrer l’historique par équipe ou match" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)} className="max-w-48 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-300"><option value="all">Toutes les équipes et matchs</option><optgroup label="Équipes">{teams.map((team) => <option key={`team:${team}`} value={`team:${team}`}>{team}</option>)}</optgroup><optgroup label="Matchs">{matches.map((match) => <option key={`match:${match.id}`} value={`match:${match.id}`}>{match.homeTeam} vs {match.awayTeam}{match.matchDate ? ` · ${match.matchDate}` : ''}</option>)}</optgroup></select><select aria-label="Trier l’historique" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-300"><option value="recent">Plus récents</option><option value="oldest">Plus anciens</option><option value="lowest-pnl">P&amp;L croissant</option><option value="highest-pnl">P&amp;L décroissant</option></select>{bets.length > 0 && <button onClick={onClear} className="text-xs text-slate-500 hover:text-rose-400 transition">Effacer Historique</button>}</div></div>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="text-xs text-slate-400">
        Période
        <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="mt-1 block rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200">
          <option value="matches-today">Matchs du jour</option>
          <option value="all">Toutes les dates</option>
          <option value="today">Coupures d’aujourd’hui</option>
          <option value="yesterday">Coupures d’hier</option>
          <option value="exact">Date de coupure précise</option>
          <option value="range">Intervalle de coupure</option>
        </select>
      </label>
      {dateFilter === 'exact' && (
        <label className="text-xs text-slate-400">
          Jour
          <input type="date" value={specificDate} onChange={(event) => setSpecificDate(event.target.value)} className="mt-1 block rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200" />
        </label>
      )}
      {dateFilter === 'range' && (
        <>
          <label className="text-xs text-slate-400">
            Du
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200" />
          </label>
          <label className="text-xs text-slate-400">
            Au
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200" />
          </label>
        </>
      )}
    </div>
    {invalidRange && <p role="alert" className="mb-3 text-xs text-rose-300">La date de fin doit être égale ou postérieure à la date de début.</p>}
    {(from || to) && bets.some((bet) => !closureDateTime(bet.closedAt)) && (
      <p className="mb-3 text-xs text-slate-400">Pour les anciennes coupures, le filtre utilise la date du match si elle est connue.</p>
    )}
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
      <span className="text-slate-300">
        {visibleBets.length} {visibleBets.length > 1 ? 'positions trouvées' : 'position trouvée'}
      </span>
      <span className="text-slate-300">
        Résultat net total{' '}
        <strong className={totalPnL > 0 ? 'text-emerald-400' : totalPnL < 0 ? 'text-rose-400' : 'text-slate-200'}>
          {signedEuros.format(totalPnL)}
        </strong>
      </span>
    </div>
    {visibleBets.length === 0 && <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">{bets.length ? 'Aucune position pour ce filtre.' : 'Aucune position fermée pour le moment.'}</div>}
    <div className="space-y-2.5 pr-1">{visibleBets.map((bet) => { const amounts = getPositionAmounts(bet.type, bet.entryOdds, bet.stake); const result = resultFor(bet); return <article key={bet.id} className="relative flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-slate-950 p-3 hover:border-slate-600">
      <button
        type="button"
        aria-label={`Voir les détails de la position · ${bet.matchName || 'Match'} · ${bet.marketName || 'Marché'}`}
        onClick={() => setDetailsId(bet.id)}
        className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
      />
      <div className="min-w-0 space-y-1"><div className="text-[10px] text-slate-300">{bet.marketName ?? 'Over 1.5 goals'}</div><div className="text-[10px] text-slate-500">{bet.matchName || 'Match'}{bet.matchDate ? ` · ${formatMatchDate(bet.matchDate, bet.matchTime)}` : ''}</div><div className="flex items-center gap-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bet.type === 'BACK' ? 'bg-blue-500/20 text-blue-400' : 'bg-rose-500/20 text-rose-400'}`}>{bet.type === 'BACK' ? 'POUR' : 'CONTRE'}</span><span className="text-xs text-slate-300 font-mono">{bet.entryOdds.toFixed(2)} → {formatExitOdds(bet.exitOdds)}</span><span className="text-[10px] text-slate-500 font-mono">({closedAtLabel(bet)})</span></div><div className="text-[11px] text-slate-500">{bet.type === 'LAY' ? `Liability: ${amounts.liability.toFixed(2)} € · Mise Lay: ${amounts.matchedStake.toFixed(2)} €` : `Mise Back: ${Number(bet.stake).toFixed(2)} €`}</div></div><div className="pointer-events-none relative z-10 flex flex-wrap items-center gap-2"><div className="text-right"><div className={`font-mono text-sm font-bold ${result >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{result >= 0 ? '+' : ''}{result.toFixed(2)} €</div><span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{result < 0 ? 'Perdu' : 'Gagné'} &amp; Sauvegardé</span></div><button
      type="button"
      onClick={() => setPendingReopenId(bet.id)}
      className="pointer-events-auto rounded-lg border border-slate-700 px-3 py-2 text-xs text-indigo-300 hover:bg-slate-800"
    >
      Annuler la coupure
    </button><button type="button" title="Modifier ou supprimer" onClick={() => setEditingBet(bet)} className="pointer-events-auto rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><Pencil className="h-4 w-4" /></button></div>
      {pendingReopenId === bet.id && (
        <div className="relative z-10 w-full rounded-lg border border-slate-700 p-3 text-sm text-slate-200">
          <p role="status">Rouvrir cette position et annuler le résultat de la coupure ({result.toFixed(2)} €) ?</p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setPendingReopenId(null)} className="rounded-lg px-3 py-2 hover:bg-slate-800">
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingReopenId(null);
                onReopen(bet);
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-500"
            >
              Rouvrir la position
            </button>
          </div>
        </div>
      )}
    </article>; })}</div>
    {detailsBet && <PositionDetails bet={detailsBet} result={resultFor(detailsBet)} onClose={() => setDetailsId(null)} />}
    {editingBet && <PositionEditor bet={editingBet} matches={matches} marketCatalog={marketCatalog} closed onClose={() => setEditingBet(null)} onSave={(changes) => { onEdit(editingBet, changes); setEditingBet(null); }} onDelete={(bet) => { onDelete(bet); setEditingBet(null); }} />}
  </section>;
}
