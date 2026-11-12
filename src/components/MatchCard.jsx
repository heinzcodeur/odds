import React from 'react';
import { Activity, Pause, Play, FastForward, RotateCcw, Pencil, Check, X } from 'lucide-react';
import { defaultMatchSchedule, formatMatchDate, formatTimer } from '../utils/betting.js';
import MarketManager from './MarketManager.jsx';
import ParticipantSelect from './ParticipantSelect.jsx';

function MarketQuote({ side, odds, setOdds, positionsToClose = 0, onCashoutAt }) {
  const isBack = side === 'BACK';
  const [draftBackOdds, setDraftBackOdds] = React.useState(null);
  const commitBackOdds = () => {
    if (draftBackOdds === null) return;
    const value = Number(draftBackOdds);
    setDraftBackOdds(null);
    if (Number.isFinite(value) && value >= 1.01) setOdds(value);
  };
  const sideLabel = isBack ? 'Back' : 'Lay';
  const styles = isBack
    ? { panel: 'border-blue-500/30 bg-blue-500/10', label: 'text-blue-300', price: 'text-blue-100' }
    : { panel: 'border-rose-500/30 bg-rose-500/10', label: 'text-rose-300', button: 'hover:bg-rose-500/15 focus:ring-rose-400', price: 'text-rose-100' };
  return <div className={`rounded-lg border p-3 ${styles.panel}`}>
    <span className={`block text-xs font-semibold ${styles.label}`}>Cote {sideLabel}</span>
    {positionsToClose > 0 ? (
      <button
        type="button"
        onClick={() => onCashoutAt('BACK', Number(odds))}
        aria-label={`Utiliser la cote Lay ${Number(odds).toFixed(2)} pour fermer ${positionsToClose} position${positionsToClose > 1 ? 's' : ''} Back`}
        className={`mt-1 flex w-full cursor-pointer items-baseline justify-between rounded-md text-left transition focus:outline-none focus:ring-2 ${styles.button}`}
      >
        <span className={`font-mono text-2xl font-bold ${styles.price}`}>{Number(odds).toFixed(2)}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Fermer {positionsToClose} Back</span>
      </button>
    ) : (
      <div className="mt-1 flex items-baseline justify-between">
        <span className={`font-mono text-2xl font-bold ${styles.price}`}>{Number(odds).toFixed(2)}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Cote marché</span>
      </div>
    )}
    <label className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-[10px] text-slate-400">
      Modifier la cote
      <input aria-label={`Modifier cote ${sideLabel}`} type="number" min="1.01" step="0.01" value={draftBackOdds ?? odds}
        onChange={(event) => {
          if (isBack) setDraftBackOdds(event.target.value);
          else setOdds(Number(event.target.value));
        }}
        onBlur={isBack ? commitBackOdds : undefined}
        onKeyDown={(event) => {
          if (isBack && event.key === 'Enter') event.currentTarget.blur();
        }} className="w-20 rounded bg-slate-950/70 px-2 py-1 text-right font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500" />
    </label>
  </div>;
}

export default function MatchCard({ participants, onAddParticipant, onManageParticipants, marketCatalog, backOdds, layOdds, setBackOdds, setLayOdds, market, setMarket, markets, selectedMarketId, onSelectMarket, onAddMarket, secondsLeft, isRunning, elapsedMinutes, lastIncrease, teams, matches, currentMatch, selectedMatchId, onSelectMatch, onCreateMatch, onChooseDailyMatch, onSaveMatch, onToggle, onFastForward, onReset, activeBackCount, onCashoutAt }) {
  const [editingTeams, setEditingTeams] = React.useState(false);
  const [newMatchModalOpen, setNewMatchModalOpen] = React.useState(false);
  const [creatingManualMatch, setCreatingManualMatch] = React.useState(false);
  const [dailyFixtures, setDailyFixtures] = React.useState([]);
  const [fixtureStatus, setFixtureStatus] = React.useState('idle');
  const [fixtureError, setFixtureError] = React.useState('');
  const [fixtureQuery, setFixtureQuery] = React.useState('');
  const [teamDrafts, setTeamDrafts] = React.useState(teams);
  const [dateDraft, setDateDraft] = React.useState(currentMatch?.matchDate ?? '');
  const [timeDraft, setTimeDraft] = React.useState(currentMatch?.matchTime ?? '');
  React.useEffect(() => {
    setTeamDrafts([currentMatch?.homeTeam ?? '', currentMatch?.awayTeam ?? '']);
    setDateDraft(currentMatch?.matchDate ?? '');
    setTimeDraft(currentMatch?.matchTime ?? '');
  }, [currentMatch?.id]);
  const validParticipants = teamDrafts.every((name) => participants.includes(name)) && teamDrafts[0] !== teamDrafts[1];
  const saveTeams = () => {
    if (validParticipants) {
      onSaveMatch({ homeTeam: teamDrafts[0].trim(), awayTeam: teamDrafts[1].trim(), matchDate: dateDraft, matchTime: timeDraft });
      setEditingTeams(false);
    }
  };
  const openNewMatchModal = () => {
    setNewMatchModalOpen(true);
    setCreatingManualMatch(false);
    setTeamDrafts(['', '']);
    setDateDraft('');
    setTimeDraft('');
    setFixtureQuery('');
    setFixtureError('');
    const { matchDate: today } = defaultMatchSchedule();
    setDailyFixtures(matches.filter((match) => match.matchDate === today).map((match) => ({
      ...match,
      country: '',
      competition: '',
    })));
    setFixtureStatus('ready');
  };
  const startManualMatch = () => {
    const { matchDate, matchTime } = defaultMatchSchedule();
    setTeamDrafts(['', '']);
    setDateDraft(matchDate);
    setTimeDraft(matchTime);
    setCreatingManualMatch(true);
  };
  const saveManualMatch = () => {
    if (!validParticipants || !dateDraft || !timeDraft) return;
    onCreateMatch({ homeTeam: teamDrafts[0].trim(), awayTeam: teamDrafts[1].trim(), matchDate: dateDraft, matchTime: timeDraft });
    setNewMatchModalOpen(false);
  };
  const filteredFixtures = dailyFixtures.filter((fixture) =>
    `${fixture.homeTeam} ${fixture.awayTeam} ${fixture.country} ${fixture.competition}`.toLocaleLowerCase('fr').includes(fixtureQuery.trim().toLocaleLowerCase('fr'))
  );

  return <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
    <div className="flex items-center justify-between mb-4"><span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><Activity className="w-3.5 h-3.5" /> EN DIRECT</span><div className="flex items-center space-x-2">
      <button onClick={onToggle} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 transition border border-slate-700 flex items-center gap-1.5">{isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}{isRunning ? 'Pause' : 'Reprendre'}</button>
      <button onClick={() => onFastForward(10)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1.5"><FastForward className="w-3.5 h-3.5" />+10 Min (+0.10)</button>
      <button onClick={onReset} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition border border-slate-700" title="Réinitialiser Match"><RotateCcw className="w-3.5 h-3.5" /></button>
    </div></div>
    <div className="mb-4 flex gap-2"><select aria-label="Match actif" value={selectedMatchId ?? ''} onChange={(event) => onSelectMatch(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200">{matches.map((item) => <option key={item.id} value={item.id}>{item.homeTeam} vs {item.awayTeam}{item.matchDate ? ` · ${formatMatchDate(item.matchDate, item.matchTime)}` : ''}</option>)}</select><button type="button" onClick={openNewMatchModal} className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20">+ Nouveau match</button></div>
    <div className="text-center my-5"><div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Match</div>
      {editingTeams ? <div className="max-w-xl mx-auto"><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><ParticipantSelect label="Participant à domicile" participants={participants} value={teamDrafts[0]} otherParticipant={teamDrafts[1]} onChange={(name) => setTeamDrafts(([, second]) => [name, second])} className="min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-center text-sm font-semibold text-slate-100 focus:outline-none focus:border-blue-500" /><span className="text-slate-600 text-xs font-mono px-2 py-0.5 bg-slate-800/80 rounded">VS</span><ParticipantSelect label="Participant visiteur" participants={participants} value={teamDrafts[1]} otherParticipant={teamDrafts[0]} onChange={(name) => setTeamDrafts(([first]) => [first, name])} className="min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-center text-sm font-semibold text-slate-100 focus:outline-none focus:border-blue-500" /></div><div className="mt-2 flex flex-wrap items-center justify-center gap-2"><label className="text-[10px] text-slate-500">Date du match <input aria-label="Date du match" type="date" value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} className="ml-1 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200" /></label><label className="text-[10px] text-slate-500">Heure <input aria-label="Heure du match" type="time" value={timeDraft} onChange={(event) => setTimeDraft(event.target.value)} className="ml-1 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200" /></label><button type="button" onClick={onManageParticipants} className="text-xs text-indigo-300 hover:underline">Créer un joueur ou une équipe</button><button type="button" disabled={!validParticipants} onClick={saveTeams} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500"><Check className="h-3.5 w-3.5" />Enregistrer</button><button onClick={() => { setTeamDrafts(teams); setDateDraft(currentMatch?.matchDate ?? ''); setTimeDraft(currentMatch?.matchTime ?? ''); setEditingTeams(false); }} className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"><X className="h-3.5 w-3.5" />Annuler</button></div></div>
      : <div><div className="flex items-center justify-center gap-3 text-lg font-bold text-slate-100"><span>{teams[0]}</span><span className="text-slate-600 text-xs font-mono px-2 py-0.5 bg-slate-800/80 rounded">VS</span><span>{teams[1]}</span><button aria-label="Modifier le match" title="Modifier le match" onClick={() => setEditingTeams(true)} className="ml-1 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-blue-400"><Pencil className="h-3.5 w-3.5" /></button></div><div className="mt-1 text-xs text-slate-500">{formatMatchDate(currentMatch?.matchDate) || 'Date non définie'}{currentMatch?.matchTime ? ` · ${currentMatch.matchTime}` : ''}</div></div>}
      {!editingTeams && <details className="mx-auto mt-3 max-w-xl text-left"><summary className="cursor-pointer text-[10px] font-semibold text-slate-500 hover:text-slate-300">Historique par équipe</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{[...new Set(teams)].map((team) => <div key={team} className="rounded-lg border border-slate-800 bg-slate-950/70 p-2"><div className="mb-1 text-[10px] font-semibold text-slate-300">{team}</div><div className="space-y-1">{matches.filter((item) => item.homeTeam === team || item.awayTeam === team).sort((a, b) => `${b.matchDate || ''}${b.matchTime || ''}`.localeCompare(`${a.matchDate || ''}${a.matchTime || ''}`)).map((item) => <button type="button" key={item.id} onClick={() => onSelectMatch(item.id)} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[10px] ${item.id === selectedMatchId ? 'bg-indigo-500/10 text-indigo-300' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}>{formatMatchDate(item.matchDate, item.matchTime) || 'Date non définie'} · {item.homeTeam} vs {item.awayTeam}</button>)}</div></div>)}</div></details>}
      <div className="text-xs text-slate-400 mt-2">Temps écoulé : <span className="font-mono text-slate-200">{Math.floor(elapsedMinutes)} min</span></div></div>
    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/80 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Marché actif</div><div className="text-sm font-semibold text-slate-200">{market || 'Marché sans nom'}</div></div>{lastIncrease && <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 animate-pulse">+0.10</span>}</div><label htmlFor="market-name" className="sr-only">Nom du marché actif</label><input id="market-name" maxLength={80} value={market} onChange={(event) => setMarket(event.target.value)} className="mb-3 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
      <MarketManager marketCatalog={marketCatalog} markets={markets} selectedMarketId={selectedMarketId} onSelect={onSelectMarket} onAdd={onAddMarket} />
      <div className="grid grid-cols-2 gap-3"><MarketQuote key={JSON.stringify([selectedMatchId, selectedMarketId])} side="BACK" odds={backOdds} setOdds={setBackOdds} /><MarketQuote side="LAY" odds={layOdds} setOdds={setLayOdds} positionsToClose={activeBackCount} onCashoutAt={onCashoutAt} /></div>
      <p className="mt-2 text-[11px] text-slate-500">La cote Lay peut solder les Back ouverts. Les Lay se ferment automatiquement au gain maximal. Le boost ajoute +0.10 aux deux cotes toutes les 10 minutes.</p></div>
    <span className="sr-only">{formatTimer(secondsLeft)}</span>
    {newMatchModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewMatchModalOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="new-match-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><h2 id="new-match-title" className="text-lg font-bold text-slate-100">Choisir un match du jour</h2><p className="mt-1 text-xs text-slate-400">Sélectionne un match déjà enregistré ou crée-en un nouveau.</p></div><button type="button" aria-label="Fermer" onClick={() => setNewMatchModalOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></header>
        {creatingManualMatch ? <div className="space-y-4 overflow-y-auto p-5"><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3"><div className="text-xs text-slate-400">Domicile<ParticipantSelect onCreate={onAddParticipant} label="Participant à domicile" participants={participants} value={teamDrafts[0]} otherParticipant={teamDrafts[1]} onChange={(name) => setTeamDrafts(([, second]) => [name, second])} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></div><span className="pt-5 text-xs text-slate-500">VS</span><div className="text-xs text-slate-400">Visiteur<ParticipantSelect onCreate={onAddParticipant} label="Participant visiteur" participants={participants} value={teamDrafts[1]} otherParticipant={teamDrafts[0]} onChange={(name) => setTeamDrafts(([first]) => [first, name])} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></div></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400">Date<input aria-label="Date du match" type="date" value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label><label className="text-xs text-slate-400">Heure<input aria-label="Heure du match" type="time" value={timeDraft} onChange={(event) => setTimeDraft(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label></div><footer className="flex justify-between border-t border-slate-800 pt-4"><button type="button" onClick={() => setCreatingManualMatch(false)} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Retour à la liste</button><button type="button" disabled={!validParticipants || !dateDraft || !timeDraft} onClick={saveManualMatch} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">Créer le match</button></footer></div>
          : <><div className="border-b border-slate-800 p-4"><input autoFocus aria-label="Rechercher un match" type="search" value={fixtureQuery} onChange={(event) => setFixtureQuery(event.target.value)} placeholder="Rechercher une équipe ou une compétition…" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500" /></div><div className="min-h-32 flex-1 overflow-y-auto p-4">{fixtureStatus === 'loading' && <p className="py-8 text-center text-sm text-slate-400">Chargement des matchs du jour…</p>}{fixtureStatus === 'error' && <p role="alert" className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">{fixtureError}</p>}{fixtureStatus === 'ready' && filteredFixtures.length === 0 && <p className="py-8 text-center text-sm text-slate-400">{dailyFixtures.length ? 'Aucun match ne correspond à la recherche.' : 'Aucun match du jour enregistré.'}</p>}<div className="space-y-2">{filteredFixtures.map((fixture) => { const alreadyAdded = matches.some((item) => item.homeTeam.trim().toLocaleLowerCase('fr') === fixture.homeTeam.trim().toLocaleLowerCase('fr') && item.awayTeam.trim().toLocaleLowerCase('fr') === fixture.awayTeam.trim().toLocaleLowerCase('fr') && item.matchDate === fixture.matchDate); return <button type="button" key={fixture.id} onClick={() => { onChooseDailyMatch(fixture); setNewMatchModalOpen(false); }} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-left transition hover:border-emerald-500/40 hover:bg-slate-800"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-100">{fixture.homeTeam} <span className="text-slate-500">vs</span> {fixture.awayTeam}</span><span className="mt-1 block truncate text-xs text-slate-400">{[fixture.country, fixture.competition].filter(Boolean).join(' · ')} · {formatMatchDate(fixture.matchDate, fixture.matchTime)}</span></span>{alreadyAdded && <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">Déjà ajouté</span>}</button>; })}</div></div><footer className="border-t border-slate-800 p-4"><button type="button" onClick={startManualMatch} className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-800">+ Créer un match manuellement</button></footer></>}
      </section>
    </div>}
  </section>;
}
