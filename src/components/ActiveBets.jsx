import React, { useEffect, useState } from 'react';
import { CheckCircle2, Layers, Pencil } from 'lucide-react';
import { calculatePnL, formatMatchDate, getPositionAmounts, maxPositionProfit, TOTAL_WIN_EXIT_ODDS } from '../utils/betting.js';
import { teamsForBet, teamsForBets } from '../utils/betTeams.js';
import SportFilter from './SportFilter.jsx';
import PositionEditor from './PositionEditor.jsx';

function parseCashoutQuote(value) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return null;
  const quote = Number(value.replace(',', '.'));
  return Number.isFinite(quote) && quote >= 1.01 ? quote : null;
}

function positionMarketName(bet) {
  return bet.marketName ?? 'Over 1.5 goals';
}

export default function ActiveBets({ bets, matches = [], marketCatalog, getExitOdds, onClose, onCloseAll, onSelectPosition, pnlFor, onEdit, onDelete, onSetTarget, onSetCashout, filteredMatch, onClearMatchFilter }) {
  const [sportFilter, setSportFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('');
  const [cashoutDraft, setCashoutDraft] = useState(null);
  const [selectedPositionId, setSelectedPositionId] = useState(null);
  const selectedPosition = bets.find((bet) => bet.id === selectedPositionId);
  const [editingBet, setEditingBet] = useState(null);
  const [closeError, setCloseError] = useState(false);
  const [pendingClose, setPendingClose] = useState(null);
  const reachedTarget = bets.find((bet) => bet.targetProfit > 0 && Number(pnlFor(bet).toFixed(2)) >= bet.targetProfit);
  const targetPrompt = !pendingClose && editingBet === null && reachedTarget;
  const closure = pendingClose ?? (targetPrompt ? { id: reachedTarget.id, exitOdds: getExitOdds(reachedTarget) } : null);
  const pendingBet = closure ? bets.find((bet) => bet.id === closure.id) : null;
  useEffect(() => setCloseError(false), [pendingBet?.id]);
  useEffect(() => {
    if (!pendingBet && pendingClose) setPendingClose(null);
  }, [pendingBet, pendingClose]);
  const pendingPnL = pendingBet
    ? calculatePnL(pendingBet.type, pendingBet.entryOdds, closure.exitOdds, pendingBet.stake)
    : null;
  const teams = teamsForBets(bets, matches);
  const sportsByMatch = new Map(matches.map(({ id, sport }) => [id, sport]));
  const matchBets = filteredMatch
    ? bets.filter((bet) => (bet.matchId ?? 'legacy-match') === filteredMatch.id)
    : bets;
  const markets = [...new Set(matchBets.map(positionMarketName))].sort((a, b) => a.localeCompare(b, 'fr'));
  const selectedMarket = markets.includes(marketFilter) ? marketFilter : '';
  const scopedBets = filteredMatch ? matchBets : matchBets.filter((bet) =>
    (sportFilter === 'all' || (sportsByMatch.get(bet.matchId) || 'unknown') === sportFilter)
    && (teamFilter === 'all' || teamsForBet(bet, matches).includes(teamFilter)));
  const visibleBets = selectedMarket
    ? scopedBets.filter((bet) => positionMarketName(bet) === selectedMarket)
    : scopedBets;
  const saveCashoutDraft = (bet) => {
    if (cashoutDraft === null) return;
    const quote = parseCashoutQuote(cashoutDraft);
    if (quote === null) return;
    if (quote !== bet.cashoutOdds) onSetCashout(bet.id, quote);
    setCashoutDraft(null);
  };

  const renderPosition = (bet, expanded = false) => {
    const liveExitOdds = getExitOdds(bet);
    const manualQuote = expanded && cashoutDraft !== null;
    const exitOdds = manualQuote ? parseCashoutQuote(cashoutDraft) : liveExitOdds;
    const validQuote = exitOdds !== null;
    const pnl = manualQuote && validQuote
      ? calculatePnL(bet.type, bet.entryOdds, exitOdds, bet.stake)
      : pnlFor(bet);
    const resultLabel = validQuote ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} €` : '—';
    const amounts = getPositionAmounts(bet.type, bet.entryOdds, bet.stake);
      return <article key={bet.id} className="relative bg-slate-950 border border-slate-800/90 rounded-xl p-4 transition hover:border-slate-700">
      {!expanded && <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Voir les détails de la position : ${bet.matchName || 'Match'}${bet.marketName ? ` · ${bet.marketName}` : ''}`}
        onClick={() => {
          setCashoutDraft(null);
          setSelectedPositionId(bet.id);
        }}
        className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
      />}
      <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className={`text-xs font-bold px-2 py-0.5 rounded ${bet.type === 'BACK' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>{bet.type === 'BACK' ? 'POUR (Back)' : 'CONTRE (Lay)'}</span><span className="text-[11px] text-slate-500 font-mono">{bet.timestamp}</span></div><div className={`font-mono text-sm font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{resultLabel}</div></div><div className="mb-1 text-[10px] font-medium text-slate-300">{positionMarketName(bet)} <span className="ml-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">{bet.tag ?? 'prod'}</span></div><div className="mb-2 text-[10px] text-slate-500">{bet.matchName || 'Match'}{bet.matchDate ? ` · ${formatMatchDate(bet.matchDate, bet.matchTime)}` : ''}</div><div className={`grid grid-cols-2 gap-2 ${expanded ? "sm:grid-cols-3 text-sm p-4" : "md:grid-cols-5 text-xs p-2.5"} text-slate-400 mb-3 bg-slate-900/60 rounded-lg border border-slate-800/60`}><div>Cote entrée:<span className="font-mono text-slate-200 font-medium block text-sm">{bet.entryOdds.toFixed(2)}</span></div>{expanded ? <label className="block">
        Cote cashout
        <input type="text" inputMode="decimal" value={cashoutDraft ?? liveExitOdds.toFixed(2)}
          aria-invalid={!validQuote}
          onChange={(event) => setCashoutDraft(event.target.value)}
          onBlur={() => saveCashoutDraft(bet)}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          className="block w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-amber-400" />
        {!validQuote && <span className="block text-xs text-rose-300">Saisis une cote d’au moins 1,01, avec deux décimales maximum.</span>}
        {bet.cashoutOdds != null && <button type="button" onClick={() => {
          onSetCashout(bet.id, null);
          setCashoutDraft(null);
        }} className="mt-1 text-xs text-indigo-300 hover:underline">Revenir à la cote du marché</button>}
      </label> : <div>Cote cashout:<span className="font-mono text-amber-400 font-medium block text-sm">{exitOdds.toFixed(2)}</span></div>}<div>{bet.type === 'LAY' ? 'Mise Lay:' : 'Mise Back:'}<span className="font-mono text-slate-200 font-medium block text-sm">{amounts.matchedStake.toFixed(2)} €</span></div><div>Liability:<span className="font-mono text-rose-300 font-medium block text-sm">{bet.type === 'LAY' ? `${amounts.liability.toFixed(2)} €` : '—'}</span></div>
      <div>Gain net maximal<span className="block font-mono text-sm font-medium text-emerald-300">+{maxPositionProfit(bet.type, bet.entryOdds, bet.stake).toFixed(2)} €</span></div>
      <label className="relative z-10 block">
        Gain objectif (€)
        <input key={bet.targetProfit ?? ''} type="number" min="0.01" step="0.01"
          max={maxPositionProfit(bet.type, bet.entryOdds, bet.stake).toFixed(2)}
          defaultValue={bet.targetProfit ?? ''} placeholder="Aucun"
          className="block w-full rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-slate-200"
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          onBlur={(event) => {
            const input = event.currentTarget;
            if (!input.reportValidity()) return;
            onSetTarget(bet.id, input.value === '' ? null : input.valueAsNumber);
          }} />
      </label>
      </div><div className="relative z-10 grid grid-cols-[1fr_auto] gap-2"><button type="button" disabled={!validQuote} onClick={() => setPendingClose({ id: bet.id, exitOdds })} className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-40 ${pnl >= 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'}`}><CheckCircle2 className="w-4 h-4" />Couper / Cashout {validQuote && `à ${exitOdds.toFixed(2)} (${resultLabel})`}</button><button type="button" aria-label="Modifier ou supprimer" title="Modifier ou supprimer" onClick={() => setEditingBet(bet)} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><Pencil className="h-4 w-4" />{expanded && <span>Modifier</span>}</button>
        <details className="col-span-2 text-xs text-slate-400">
          <summary className="cursor-pointer py-1">Options de coupure</summary>
          <button
            type="button"
            onClick={() => setPendingClose({ id: bet.id, exitOdds: null })}
            className="mt-1 w-full rounded-lg border border-rose-500/30 px-3 py-2 font-semibold text-rose-300 hover:bg-rose-500/10"
          >
            Couper à perte totale ({calculatePnL(bet.type, bet.entryOdds, null, bet.stake).toFixed(2)} €)
          </button>
          <button
            type="button"
            onClick={() => setPendingClose({ id: bet.id, exitOdds: TOTAL_WIN_EXIT_ODDS })}
            className="mt-1 w-full rounded-lg border border-emerald-500/30 px-3 py-2 font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            Couper avec gain total (+{calculatePnL(bet.type, bet.entryOdds, TOTAL_WIN_EXIT_ODDS, bet.stake).toFixed(2)} €)
          </button>
        </details>
      </div></article>;
  };
  return <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl lg:flex lg:min-h-0 lg:flex-col"><div className="flex shrink-0 flex-wrap items-center justify-between gap-2 mb-4"><h3 className="text-base font-semibold text-slate-200 flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-400" />Positions Actives ({visibleBets.length})</h3><div className="flex flex-wrap items-center gap-2">{!filteredMatch && <SportFilter value={sportFilter} onChange={setSportFilter} />}{!filteredMatch && teams.length > 0 && <select aria-label="Filtrer les positions actives par équipe" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="max-w-44 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-300"><option value="all">Toutes les équipes</option>{teams.map((team) => <option key={team} value={team}>{team}</option>)}</select>}{markets.length > 0 && (
      <select aria-label="Filtrer les positions actives par marché" value={selectedMarket} onChange={(event) => setMarketFilter(event.target.value)} className="max-w-48 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-300">
        <option value="">Tous les marchés</option>
        {markets.map((market) => <option key={market} value={market}>{market}</option>)}
      </select>
    )}{matchBets.length > 1 && <button onClick={() => onCloseAll(matchBets)} className="text-xs font-medium px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition">{filteredMatch ? 'Couper les positions du match' : 'Tout Couper'}</button>}</div></div>
    {filteredMatch && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
      <span>{filteredMatch.homeTeam} – {filteredMatch.awayTeam}</span>
      <button type="button" onClick={onClearMatchFilter} className="text-xs text-indigo-300 hover:underline">Afficher toutes les positions</button>
    </div>}
    {filteredMatch && matchBets.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Aucune position active pour ce match.</p>}
    {!filteredMatch && bets.length === 0 && <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">Aucune position active.<br />Ouvrez un pari à gauche pour suivre le Cashout en direct.</div>}
    {visibleBets.length === 0 && matchBets.length > 0 && <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">Aucune position ne correspond aux filtres.</div>}
    <div className="space-y-3 lg:min-h-0 lg:overflow-y-auto">
      {visibleBets.map((bet) => renderPosition(bet))}
    </div>
    {selectedPosition && (
      <dialog
        ref={(dialog) => { if (dialog && !dialog.open) dialog.showModal(); }}
        onClose={() => {
          saveCashoutDraft(selectedPosition);
          setSelectedPositionId(null);
        }}
        aria-labelledby="active-position-title"
        className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl backdrop:bg-black/60 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h3 id="active-position-title" className="text-xl font-semibold">{selectedPosition.matchName || 'Position active'}</h3>
          <form method="dialog">
            <button autoFocus className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">Fermer</button>
          </form>
        </div>
        {renderPosition(selectedPosition, true)}
        <button
          type="button"
          onClick={() => {
            const cashoutOdds = cashoutDraft === null
              ? selectedPosition.cashoutOdds
              : parseCashoutQuote(cashoutDraft);
            if (cashoutDraft !== null && cashoutOdds === null) return;
            saveCashoutDraft(selectedPosition);
            onSelectPosition({ ...selectedPosition, cashoutOdds });
            setSelectedPositionId(null);
          }}
          className="mt-4 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
        >
          Afficher le match
        </button>
      </dialog>
    )}
    {pendingBet && (
      <dialog
        ref={(dialog) => { if (dialog && !dialog.open) dialog.showModal(); }}
        onCancel={(event) => { if (targetPrompt) event.preventDefault(); }}
        onClose={() => { setPendingClose(null); setCloseError(false); }}
        aria-labelledby="close-position-title"
        aria-describedby="close-position-details"
        className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl backdrop:bg-black/60"
      >
        <h3 id="close-position-title" className="text-base font-semibold">{targetPrompt ? 'Objectif atteint. Couper la position ?' : 'Êtes-vous sûr de couper la position ?'}</h3>
        <p id="close-position-details" className="mt-2 text-sm text-slate-400">
          {targetPrompt && <span className="block">{pendingBet.matchName} · {pendingBet.marketName} · Objectif {pendingBet.targetProfit.toFixed(2)} €</span>}
          {closure.exitOdds === null
            ? `Perte totale de ${Math.abs(pendingPnL).toFixed(2)} €.`
            : closure.exitOdds === TOTAL_WIN_EXIT_ODDS
              ? `Gain total de ${pendingPnL.toFixed(2)} €.`
              : `Cashout à ${closure.exitOdds.toFixed(2)} · résultat ${pendingPnL >= 0 ? '+' : ''}${pendingPnL.toFixed(2)} €.`}
        </p>
        {closeError && <p role="alert" className="mt-3 text-sm text-rose-300">Les données ont changé sur un autre écran. Rechargez la page avant de couper cette position.</p>}
        <form method="dialog" className="mt-5 flex flex-wrap justify-end gap-2">
          <button type={targetPrompt ? 'button' : 'submit'}
            onClick={targetPrompt ? () => onSetTarget(pendingBet.id, null) : undefined}
            className="rounded-lg px-3 py-2 text-xs hover:bg-slate-800">
            {targetPrompt ? 'Non, annuler l’objectif' : 'Annuler'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onClose(pendingBet, closure.exitOdds) === false) {
                setCloseError(true);
                return;
              }
              setCloseError(false);
              setPendingClose(null);
            }}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            {targetPrompt ? 'Oui, couper' : 'Confirmer la coupure'}
          </button>
        </form>
      </dialog>
    )}
    {editingBet && <PositionEditor bet={editingBet} matches={matches} marketCatalog={marketCatalog} closed={false} onClose={() => setEditingBet(null)} onSave={(changes) => { onEdit(editingBet, changes); setEditingBet(null); }} onDelete={(bet) => { onDelete(bet); setEditingBet(null); }} />}
  </section>;
}
