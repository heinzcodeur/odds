import React, { useEffect, useState } from 'react';
import { COMBINED_SYSTEMS, combinedSummary } from '../utils/combinedBets.js';
import { formatMatchDate, matchAvailableForCombinedBets } from '../utils/betting.js';
import { marketFitsSport, marketPresetsForSport, marketCategory } from '../utils/marketSports.js';

const subBetResults = {
  pending: { label: 'En cours', color: 'text-slate-400' },
  won: { label: 'Gagné', color: 'text-emerald-300' },
  lost: { label: 'Perdu', color: 'text-rose-300' },
  void: { label: 'Remboursé', color: 'text-amber-300' },
};

function marketsFor(match, catalog, matches) {
  const options = new Map(marketPresetsForSport(match.sport).map((market) => [market.id, market]));
  for (const other of matches) {
    if (other.sport !== match.sport) continue;
    for (const market of other.markets ?? []) if (marketFitsSport(market.id, match.sport)) options.set(market.id, market);
  }
  for (const market of catalog) {
    if (market.sport && market.sport !== match.sport && match.sport) options.delete(market.id);
    else if (options.has(market.id) || (match.sport && marketCategory(market, matches) === match.sport)) {
      options.set(market.id, market);
    }
  }
  return [...options.values()];
}

export default function CombinedBets({ matches, catalog, tickets, onSave, onSettle }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);
  const [viewedTicketId, setViewedTicketId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [system, setSystem] = useState('trixie');
  const [selections, setSelections] = useState([]);
  const [unitStake, setUnitStake] = useState('1');
  const [tag, setTag] = useState('dry-run');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [settlement, setSettlement] = useState(null);
  const [results, setResults] = useState({});
  const ticket = tickets.find(({ id }) => id === viewedTicketId);
  const totals = ticket && combinedSummary(ticket);
  const draft = { system, selections, unitStake: Number(unitStake), tag };
  const summary = combinedSummary(draft);
  const definition = COMBINED_SYSTEMS[system];
  const input = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100';
  const update = (id, changes) => setSelections((items) => items.map((item) => item.matchId === id ? { ...item, ...changes } : item));
  const valid = summary.lines.length > 0 && Number(unitStake) >= 0.01 && selections.every((item) => item.marketId && Number(item.odds) >= 1.01);
  const openForm = (ticket) => {
    setEditingId(ticket?.id ?? null);
    setSystem(ticket?.system ?? 'trixie');
    setUnitStake(ticket ? String(ticket.unitStake) : '1');
    setTag(ticket?.tag ?? 'dry-run');
    setSelections(ticket?.selections ?? []);
    setQuery('');
    setError('');
    setNow(new Date());
    setOpen(true);
  };

  const availableMatches = open ? matches.filter((match) => matchAvailableForCombinedBets(match, now)
    && `${match.homeTeam} ${match.awayTeam}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))) : [];

  return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold text-slate-200">Paris combinés ({tickets.filter((ticket) => !ticket.closedAt).length} actifs)</h3>
      <button type="button" onClick={() => openForm()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Créer un combiné</button>
    </div>
    <div className="mt-4 space-y-3">
      {tickets.map((item) => {
        const summary = combinedSummary(item);
        return <button key={item.id} type="button" aria-haspopup="dialog" onClick={() => setViewedTicketId(item.id)}
          className="block w-full rounded-xl border border-slate-700 p-3 text-left text-sm text-slate-300 hover:bg-slate-800">
          {COMBINED_SYSTEMS[item.system].name} · {item.tag} · {item.selections.length} matchs · {summary.totalStake.toFixed(2)} € · {item.closedAt ? `Résultat ${summary.profit.toFixed(2)} €` : 'En cours'}
        </button>;
      })}
    </div>
    {ticket && !open && !settlement && <dialog
      ref={(dialog) => { if (dialog && !dialog.open) dialog.showModal(); }}
      onClose={() => setViewedTicketId(null)} aria-labelledby="combined-detail-title"
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-sm text-slate-300 backdrop:bg-black/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="combined-detail-title" className="text-lg font-semibold text-slate-100">{COMBINED_SYSTEMS[ticket.system].name}</h2>
          <p>{ticket.tag} · Mise totale {totals.totalStake.toFixed(2)} € · {ticket.closedAt ? `Résultat net ${totals.profit.toFixed(2)} €` : 'En cours'}</p>
        </div>
        <button type="button" onClick={() => setViewedTicketId(null)} className="rounded-lg border border-slate-600 px-3 py-2">Fermer</button>
      </div>
      {!ticket.closedAt && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => openForm(ticket)} className="rounded-lg border border-slate-600 px-3 py-2">Modifier</button>
        <button type="button" onClick={() => { setSettlement(ticket); setResults({}); setError(''); }} className="rounded-lg border border-slate-600 px-3 py-2">Renseigner les résultats</button>
      </div>}
      <p className="mt-2">{totals.lines.length} combinaisons · Gain maximal net {totals.maxProfit.toFixed(2)} €</p>
      <ul className="mt-2 space-y-1">{ticket.selections.map((selection) => <li key={selection.matchId}>{selection.matchName} · {selection.marketName} · {Number(selection.odds).toFixed(2)}{ticket.closedAt && ` · ${{ won: 'Gagné', lost: 'Perdu', void: 'Annulé' }[selection.result]}`}</li>)}</ul>
      <div className="mt-4">
        <h4 className="font-semibold text-slate-200">Sous-paris ({totals.subBets.length})</h4>
        <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto">
          {[...totals.subBets].sort((a, b) => a.selections.length - b.selections.length).map((bet) => {
            const status = subBetResults[bet.result];
            const count = bet.selections.length;
            return <li key={JSON.stringify(bet.selections.map(({ matchId }) => matchId))}
              className="rounded-lg border border-slate-800 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{['', 'Simple', 'Double', 'Triple'][count] ?? `Combiné à ${count} sélections`} · Cote {bet.odds.toFixed(2)}</span>
                <span className={status.color}>{status.label}{bet.returnCents !== null && ` · Retour ${(bet.returnCents / 100).toFixed(2)} €`}</span>
              </div>
              <ul className="mt-1 space-y-1 text-xs text-slate-400">
                {bet.selections.map((selection) => <li key={selection.matchId}>{selection.matchName} · {selection.marketName}</li>)}
              </ul>
            </li>;
          })}
        </ul>
      </div>
    </dialog>}
    {open && <dialog ref={(dialog) => { if (dialog && !dialog.open) dialog.showModal(); }} onClose={() => setOpen(false)} aria-labelledby="combined-title"
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 backdrop:bg-black/60">
      <h2 id="combined-title" className="text-lg font-semibold">{editingId ? 'Modifier le pari combiné' : 'Créer un pari combiné'}</h2>
      <form onSubmit={(event) => {
        event.preventDefault();
        const message = onSave({ ...draft, selections: selections.map((selection) => ({ ...selection, odds: Number(selection.odds), result: 'pending' })) }, editingId);
        if (message) { setError(message); return; }
        setOpen(false);
      }} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Système<select value={system} onChange={(event) => setSystem(event.target.value)} className={input}>{Object.entries(COMBINED_SYSTEMS).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}</select></label>
          <label className="text-sm">Mise par combinaison (€)<input required type="number" min="0.01" step="0.01" value={unitStake} onChange={(event) => setUnitStake(event.target.value)} className={input} /></label>
          <label className="text-sm">Tag<select value={tag} onChange={(event) => setTag(event.target.value)} className={input}><option value="dry-run">dry-run</option><option value="prod">prod</option></select></label>
        </div>
        <p className="text-sm text-slate-400">{definition.min === definition.max ? `${definition.min} matchs requis` : `${definition.min} à ${definition.max} matchs`} · Une sélection Back par match</p>
        <input type="search" aria-label="Rechercher un match pour le combiné" placeholder="Rechercher un match…" value={query} onChange={(event) => setQuery(event.target.value)} className={input} />
        <div className="max-h-44 space-y-2 overflow-y-auto">{availableMatches.map((match) => <label key={match.id} className="flex items-center gap-3 rounded-lg border border-slate-800 p-2 text-sm">
          <input type="checkbox" checked={selections.some((item) => item.matchId === match.id)} disabled={selections.length >= definition.max && !selections.some((item) => item.matchId === match.id)} onChange={(event) => {
            if (!event.target.checked) { setSelections((items) => items.filter((item) => item.matchId !== match.id)); return; }
            const market = marketsFor(match, catalog, matches)[0];
            const quote = match.markets?.find(({ id }) => id === market?.id)?.backOdds ?? 1.5;
            setSelections((items) => [...items, { matchId: match.id, matchName: `${match.homeTeam} vs ${match.awayTeam}`, matchDate: match.matchDate, marketId: market?.id ?? '', marketName: market?.name ?? '', odds: quote }]);
          }} />
          <span>{match.homeTeam} – {match.awayTeam}<span className="block text-xs text-slate-400">{formatMatchDate(match.matchDate, match.matchTime)}</span></span>
        </label>)}</div>
        {availableMatches.length === 0 && <p className="text-sm text-slate-400">Aucun match à venir ne correspond à la recherche.</p>}
        {selections.map((selection) => {
          const match = matches.find(({ id }) => id === selection.matchId);
          const options = match ? marketsFor(match, catalog, matches) : [];
          if (selection.marketId && !options.some(({ id }) => id === selection.marketId)) {
            options.push({ id: selection.marketId, name: selection.marketName });
          }
          return <div key={selection.matchId} className="rounded-xl border border-slate-700 p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <p className="font-medium">{selection.matchName}</p>
              <button type="button" aria-label={`Retirer ${selection.matchName}`} onClick={() => setSelections((items) => items.filter(({ matchId }) => matchId !== selection.matchId))} className="text-slate-300 underline">Retirer</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
              <label className="text-xs text-slate-400">Marché<select required value={selection.marketId} onChange={(event) => {
                const market = options.find(({ id }) => id === event.target.value);
                update(selection.matchId, { marketId: market?.id ?? '', marketName: market?.name ?? '', odds: match?.markets?.find(({ id }) => id === market?.id)?.backOdds ?? selection.odds });
              }} className={input}><option value="">Choisir un marché</option>{options.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}</select></label>
              <label className="text-xs text-slate-400">Cote Back<input required type="number" min="1.01" step="0.01" value={selection.odds} onChange={(event) => update(selection.matchId, { odds: event.target.value })} className={input} /></label>
            </div>
          </div>;
        })}
        <div className="rounded-xl border border-indigo-500/30 p-3 text-sm" aria-live="polite">
          <p>{selections.length} matchs · {summary.lines.length} combinaisons · Mise totale {summary.totalStake.toFixed(2)} €</p>
          <p>Retour maximal {summary.maxReturn.toFixed(2)} € · Gain maximal net {summary.maxProfit.toFixed(2)} €</p>
        </div>
        <details className="text-sm text-slate-400"><summary className="cursor-pointer">Voir les combinaisons</summary><ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">{summary.lines.map((line) => <li key={line.join('-')}>{line.map((index) => selections[index].matchName).join(' + ')} · cote {line.reduce((odds, index) => odds * Number(selections[index].odds), 1).toFixed(2)}</li>)}</ul></details>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2">Annuler</button><button disabled={!valid} className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold disabled:opacity-40">{editingId ? 'Enregistrer les modifications' : `Créer le ticket ${tag}`}</button></div>
      </form>
    </dialog>}
    {settlement && <dialog ref={(dialog) => { if (dialog && !dialog.open) dialog.showModal(); }} onClose={() => setSettlement(null)} aria-labelledby="combined-results-title"
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 backdrop:bg-black/60">
      <h2 id="combined-results-title" className="font-semibold">Résultats du {COMBINED_SYSTEMS[settlement.system].name}</h2>
      <form className="mt-4 space-y-3" onSubmit={(event) => {
        event.preventDefault(); const message = onSettle(settlement.id, results);
        if (message) { setError(message); return; } setSettlement(null);
      }}>
        {settlement.selections.map((selection) => <label key={selection.matchId} className="block text-sm">{selection.matchName} · {selection.marketName}<select required value={results[selection.matchId] ?? ''} onChange={(event) => setResults((items) => ({ ...items, [selection.matchId]: event.target.value }))} className={input}><option value="">Choisir le résultat</option><option value="won">Gagné</option><option value="lost">Perdu</option><option value="void">Annulé (cote 1)</option></select></label>)}
        {settlement.selections.every((item) => results[item.matchId]) && <p className="text-sm">Résultat net · {combinedSummary({ ...settlement, selections: settlement.selections.map((selection) => ({ ...selection, result: results[selection.matchId] })) }).profit.toFixed(2)} €</p>}
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setSettlement(null)} className="rounded-lg px-3 py-2">Annuler</button><button className="rounded-lg bg-indigo-600 px-3 py-2">Confirmer le règlement</button></div>
      </form>
    </dialog>}
  </section>;
}
