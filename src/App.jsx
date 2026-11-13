import React, { useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import MatchCard from './components/MatchCard.jsx';
import BetForm from './components/BetForm.jsx';
import ActiveBets from './components/ActiveBets.jsx';
import BetHistory from './components/BetHistory.jsx';
import BackOffice from './components/BackOffice.jsx';
import { History, X } from 'lucide-react';
import useMatchTimer from './hooks/useMatchTimer.js';
import { calculatePnL, maxPositionProfit, participantNameKey, timestamp } from './utils/betting.js';

const DEFAULT_MARKET = { id: 'default', name: 'Over 1.5 goals', backOdds: 1.25, layOdds: 1.26 };

export default function App() {
  const [bankroll, setBankroll] = useState(1000);
  const [marketCatalog, setMarketCatalog] = useState([]);
  const pendingMarketChanges = useRef(new Map());
  const pendingCatalogDeletions = useRef(new Map());
  const [teamCatalog, setTeamCatalog] = useState([]);
  const [markets, setMarkets] = useState([DEFAULT_MARKET]);
  const marketsRef = useRef(markets);
  marketsRef.current = markets;
  const [selectedMarketId, setSelectedMarketId] = useState(DEFAULT_MARKET.id);
  const selectedMarket = markets.find((item) => item.id === selectedMarketId) ?? markets[0] ?? DEFAULT_MARKET;
  const [matches, setMatches] = useState([{ id: 'legacy-match', homeTeam: 'Real Madrid', awayTeam: 'Manchester City', matchDate: '', markets: [DEFAULT_MARKET] }]);
  const [selectedMatchId, setSelectedMatchId] = useState('legacy-match');
  const participants = [...new Set([
    ...teamCatalog.map(({ name }) => name),
    ...matches.flatMap(({ homeTeam, awayTeam }) => [homeTeam, awayTeam]),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const currentMatch = matches.find((item) => item.id === selectedMatchId) ?? matches[0];
  const teams = [currentMatch?.homeTeam ?? '', currentMatch?.awayTeam ?? ''];
  const market = selectedMarket.name;
  const backOdds = Number(selectedMarket.backOdds);
  const layOdds = Number(selectedMarket.layOdds);
  const updateSelectedMarket = (changes) => {
    const current = marketsRef.current;
    const previous = current.find((item) => item.id === selectedMarketId);
    const next = current.map((item) => item.id === selectedMarketId ? { ...item, ...changes } : item);
    marketsRef.current = next;
    setMarkets(next);
    setMatches((items) => items.map((item) => item.id === selectedMatchId ? { ...item, markets: next } : item));

    const adjustedBackOdds = changes.backOdds;
    if (!previous || !Number.isFinite(adjustedBackOdds) || adjustedBackOdds === Number(previous.backOdds)) return;
    const reachedMaximum = matchingLayBets.filter((bet) =>
      calculatePnL(bet.type, bet.entryOdds, adjustedBackOdds, bet.stake) >= maxPositionProfit(bet.type, bet.entryOdds, bet.stake));
    if (!reachedMaximum.length) return;

    saveImmediately.current = true;
    reachedMaximum.forEach((bet) => closePosition(bet, adjustedBackOdds));
    setBetNotice(reachedMaximum.length === 1
      ? 'Position Lay coupée automatiquement au gain maximal.'
      : `${reachedMaximum.length} positions Lay coupées automatiquement au gain maximal.`);
  };
  const setBackOdds = (value) => updateSelectedMarket({ backOdds: Number(value) });
  const setLayOdds = (value) => updateSelectedMarket({ layOdds: Number(value) });
  const setMarket = (value) => updateSelectedMarket({ name: String(value) });
  const [lastIncrease, setLastIncrease] = useState(false);
  const [betType, setBetType] = useState('LAY');
  const entryOdds = betType === 'BACK' ? backOdds : layOdds;
  const [stake, setStake] = useState(100);
  const [activeBets, setActiveBets] = useState([]);
  const [closedBets, setClosedBets] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [backOfficeTab, setBackOfficeTab] = useState(null);
  const [betError, setBetError] = useState('');
  const [betNotice, setBetNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const saveTimeout = useRef();
  const latestSave = useRef();
  const stateRevision = useRef();
  const saveConflict = useRef(false);
  const saveQueued = useRef(false);
  const saveImmediately = useRef(false);
  const [saveStatus, setSaveStatus] = useState('Chargement de la base…');

  useEffect(() => {
    if (!historyOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setHistoryOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [historyOpen]);
  const { secondsLeft, elapsedMinutes, isRunning, setIsRunning, reset: resetTimer, fastForward, restore } = useMatchTimer((amount) => {
    updateSelectedMarket({
      backOdds: Number((backOdds + amount).toFixed(2)),
      layOdds: Number((layOdds + amount).toFixed(2)),
    });
    setLastIncrease(true);
  });

  const addMarkets = (input) => {
    const additions = Array.isArray(input) ? input : [input];
    const next = marketsRef.current.map((item) => ({ ...item }));
    let firstAdded = null;
    for (const preset of additions) {
      let item = next.find((marketItem) => marketItem.id === preset.id);
      if (!item) {
        if (next.length >= 30) continue;
        const name = marketCatalog.find((market) => market.id === preset.id)?.name ?? preset.name;
        item = { ...preset, name, backOdds: 1.25, layOdds: 1.26 };
        next.push(item);
      }
      if (!firstAdded) firstAdded = item;
    }
    if (firstAdded) {
      marketsRef.current = next;
      setMarkets(next);
      setMatches((items) => items.map((matchItem) => matchItem.id === selectedMatchId ? { ...matchItem, markets: next } : matchItem));
      setSelectedMarketId(firstAdded.id);
      setMarketCatalog((catalog) => {
        const definitions = new Map(catalog.map((item) => [item.id, item]));
        for (const { id, name } of next) {
          if (!definitions.has(id)) definitions.set(id, { id, name });
        }
        return [...definitions.values()];
      });
    }
  };

  useEffect(() => {
    fetch('/api/state')
      .then(async (response) => {
        const state = await response.json();
        if (!response.ok) throw new Error(state.error || 'Lecture de la base impossible');
        return state;
      })
      .then((state) => {
        stateRevision.current = state.revision;
        const loadedMarkets = Array.isArray(state.markets) && state.markets.length
          ? state.markets : [{ ...DEFAULT_MARKET, name: state.market ?? DEFAULT_MARKET.name, backOdds: state.backOdds ?? state.odds, layOdds: state.layOdds ?? Number((state.odds + 0.01).toFixed(2)) }];
        const loadedMatches = Array.isArray(state.matches) && state.matches.length ? state.matches : [{ id: 'legacy-match', homeTeam: state.teams?.[0] ?? 'Real Madrid', awayTeam: state.teams?.[1] ?? 'Manchester City', matchDate: '', markets: loadedMarkets }];
        const realMatches = loadedMatches.filter((item) => !String(item.id).startsWith('demo-'));
        const datedMatches = realMatches.filter((item) => Number.isFinite(Date.parse(item.matchDate ?? '')));
        const latestMatch = [...(datedMatches.length ? datedMatches : realMatches.length ? realMatches : loadedMatches)]
          .sort((a, b) => Date.parse(b.matchDate ?? '') - Date.parse(a.matchDate ?? ''))[0];
        const chosenMatchId = loadedMatches.some((item) => item.id === state.selectedMatchId)
          ? state.selectedMatchId : latestMatch?.id ?? loadedMatches[0].id;
        const activeMatch = loadedMatches.find((item) => item.id === chosenMatchId) ?? loadedMatches[0];
        const chosenMarkets = Array.isArray(activeMatch.markets) && activeMatch.markets.length ? activeMatch.markets : loadedMarkets;
        const chosenMarketId = chosenMarkets.some((item) => item.id === state.selectedMarketId) ? state.selectedMarketId : chosenMarkets[0].id;
        marketsRef.current = chosenMarkets;
        setMatches(loadedMatches.map((item) => item.id === chosenMatchId ? { ...item, markets: chosenMarkets } : item));
        setSelectedMatchId(chosenMatchId);
        setMarkets(chosenMarkets);
        setMarketCatalog(state.marketCatalog ?? []);
        setTeamCatalog(state.teamCatalog ?? []);
        setSelectedMarketId(chosenMarketId);
        setBankroll(state.bankroll);
        setBetType(state.betType);
        setStake(state.stake);
        setActiveBets(state.activeBets);
        setClosedBets(state.closedBets);
        restore({ secondsLeft: state.secondsLeft, elapsedMinutes: state.elapsedMinutes, isRunning: state.isRunning });
        setSaveStatus('Données chargées depuis MySQL');
        setLoaded(true);
      })
      .catch((error) => setSaveStatus(`Base indisponible : ${error.message}`));
  }, []);

  useEffect(() => () => window.clearTimeout(saveTimeout.current), []);

  useEffect(() => {
    if (!loaded || saveConflict.current) return;
    setSaveStatus('Modifications en cours de sauvegarde…');
    const enqueueSave = () => {
      if (saveQueued.current) return;
      saveQueued.current = true;
      saveQueue.current = saveQueue.current.then(() => {
        saveQueued.current = false;
        return latestSave.current();
      });
    };
    latestSave.current = save;
    if (saveImmediately.current) {
      saveImmediately.current = false;
      window.clearTimeout(saveTimeout.current);
      saveTimeout.current = undefined;
      enqueueSave();
    } else if (saveTimeout.current === undefined) {
      saveTimeout.current = window.setTimeout(() => {
        saveTimeout.current = undefined;
        enqueueSave();
      }, 900);
    }
    async function save() {
      if (saveConflict.current) return;
      const catalogChanges = [...pendingMarketChanges.current.values()];
      const catalogDeletions = [...pendingCatalogDeletions.current.values()];
      try {
        const response = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: stateRevision.current, bankroll, markets, selectedMarketId, matches, selectedMatchId, odds: backOdds, backOdds, layOdds, market, elapsedMinutes, secondsLeft, isRunning, betType, entryOdds, stake, teams, activeBets, closedBets, marketCatalogChanges: catalogChanges, catalogDeletions }),
        });
        if (response.status === 409) saveConflict.current = true;
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Échec de la sauvegarde');
        }
        stateRevision.current = result.revision;
        for (const change of catalogChanges) {
          if (pendingMarketChanges.current.get(change.id) === change) pendingMarketChanges.current.delete(change.id);
        }
        for (const deletion of catalogDeletions) {
          const key = JSON.stringify([deletion.type, deletion.key]);
          if (pendingCatalogDeletions.current.get(key) === deletion) pendingCatalogDeletions.current.delete(key);
        }
        if (latestSave.current === save) setSaveStatus('Toutes les données sont enregistrées');
      } catch (error) {
        setSaveStatus(`Erreur de sauvegarde : ${error.message}`);
      }
    }
  }, [loaded, bankroll, marketCatalog, markets, selectedMarketId, matches, selectedMatchId, backOdds, layOdds, market, elapsedMinutes, secondsLeft, isRunning, betType, entryOdds, stake, teams, activeBets, closedBets]);

  useEffect(() => {
    if (!lastIncrease) return undefined;
    const timeout = window.setTimeout(() => setLastIncrease(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [lastIncrease]);

  const marketForId = (marketId, matchId) => (matches.find((item) => item.id === matchId)?.markets ?? markets).find((item) => item.id === marketId) ?? selectedMarket;
  const closeOddsFor = (bet) => {
    const matchId = bet.matchId ?? 'legacy-match';
    const marketId = bet.marketId ?? 'default';
    const positionMarket = matchId === selectedMatchId && marketId === selectedMarketId
      ? selectedMarket : marketForId(marketId, matchId);
    return bet.type === 'BACK' ? Number(positionMarket.layOdds) : Number(positionMarket.backOdds);
  };
  const pnlFor = (bet) => calculatePnL(bet.type, bet.entryOdds, closeOddsFor(bet), bet.stake);
  const layLiabilityInPlay = activeBets.reduce((total, bet) => total + (bet.tag !== 'dry-run' && bet.type === 'LAY' ? Number(bet.stake) * (Number(bet.entryOdds) - 1) : 0), 0);
  const availableBankroll = bankroll - layLiabilityInPlay;
  const matchingLayBets = activeBets.filter((bet) => bet.type === 'LAY'
    && (bet.marketId ?? 'default') === selectedMarketId
    && (bet.matchId ?? 'legacy-match') === selectedMatchId);

  const placeBet = (tag = 'prod') => {
    const parsedOdds = Number(entryOdds);
    const parsedStake = Number(stake);
    setBetError('');
    setBetNotice('');
    if (!Number.isFinite(parsedOdds) || parsedOdds <= 1) {
      setBetError('Vérifiez la cote saisie.');
      return { ok: false };
    }
    if (!Number.isFinite(parsedStake) || parsedStake <= 0) {
      setBetError('Vérifiez la cote et le montant saisis.');
      return { ok: false };
    }
    const layLiability = betType === 'LAY' ? parsedStake * (parsedOdds - 1) : 0;
    if (tag !== 'dry-run' && betType === 'LAY' && layLiability > availableBankroll) {
      setBetError(`Liability de ${layLiability.toFixed(2)} € trop élevée : solde disponible ${availableBankroll.toFixed(2)} €.`);
      return { ok: false };
    }
    saveImmediately.current = true;
    setActiveBets((bets) => [{ id: `${Date.now()}-${Math.random()}`, type: betType, tag, entryOdds: parsedOdds, stake: parsedStake, marketId: selectedMarketId, categoryId: selectedMarketId, marketName: market, matchId: selectedMatchId, matchName: `${teams[0]} vs ${teams[1]}`, matchDate: currentMatch?.matchDate ?? '', matchTime: currentMatch?.matchTime ?? '', timestamp: timestamp() }, ...bets]);
    return { ok: true };
  };

  const closePosition = (bet, exitOdds = closeOddsFor(bet)) => {
    saveImmediately.current = true;
    const finalPnL = calculatePnL(bet.type, bet.entryOdds, exitOdds, bet.stake);
    if (bet.tag !== 'dry-run') setBankroll((current) => Number((current + finalPnL).toFixed(2)));
    setClosedBets((bets) => [{ ...bet, exitOdds, finalPnL, closedAt: new Date().toISOString() }, ...bets]);
    setActiveBets((bets) => bets.filter((item) => item.id !== bet.id));
  };

  const ensurePositionMarket = (position) => {
    const match = matches.find((item) => item.id === position.matchId);
    const matchMarkets = match?.id === selectedMatchId ? marketsRef.current : match?.markets ?? [];
    if (!match || matchMarkets.some((item) => item.id === position.marketId) || matchMarkets.length >= 30) return;

    const next = [...matchMarkets, { ...DEFAULT_MARKET, id: position.marketId, name: position.marketName }];
    setMatches((items) => items.map((item) => item.id === match.id ? { ...item, markets: next } : item));
    if (match.id === selectedMatchId) {
      marketsRef.current = next;
      setMarkets(next);
    }
  };

  const editActivePosition = (bet, changes) => {
    saveImmediately.current = true;
    if (changes.marketId || changes.matchId) ensurePositionMarket({ ...bet, ...changes });
    setActiveBets((items) => items.map((item) => item.id === bet.id ? { ...item, ...changes } : item));
  };
  const editClosedPosition = (bet, changes) => {
    saveImmediately.current = true;
    const oldPnL = Number(bet.finalPnL ?? calculatePnL(bet.type, bet.entryOdds, bet.exitOdds, bet.stake));
    const updated = { ...bet, ...changes };
    const settlementChanged = updated.type !== bet.type || updated.entryOdds !== bet.entryOdds
      || updated.exitOdds !== bet.exitOdds || updated.stake !== bet.stake;
    updated.finalPnL = settlementChanged
      ? calculatePnL(updated.type, updated.entryOdds, updated.exitOdds, updated.stake)
      : oldPnL;
    const previousContribution = bet.tag === 'dry-run' ? 0 : oldPnL;
    const updatedContribution = updated.tag === 'dry-run' ? 0 : updated.finalPnL;
    setBankroll((current) => Number((current + updatedContribution - previousContribution).toFixed(2)));
    setClosedBets((items) => items.map((item) => item.id === bet.id ? updated : item));
  };
  const deleteActivePosition = (bet) => setActiveBets((items) => items.filter((item) => item.id !== bet.id));
  const deleteClosedPosition = (bet) => {
    const pnl = Number(bet.finalPnL ?? calculatePnL(bet.type, bet.entryOdds, bet.exitOdds, bet.stake));
    if (bet.tag !== 'dry-run') setBankroll((current) => Number((current - pnl).toFixed(2)));
    setClosedBets((items) => items.filter((item) => item.id !== bet.id));
  };

  const cashoutAtMarketQuote = (type, exitOdds) => {
    activeBets.filter((bet) => bet.type === type && (bet.marketId ?? 'default') === selectedMarketId && (bet.matchId ?? 'legacy-match') === selectedMatchId)
      .forEach((bet) => closePosition(bet, exitOdds));
  };

  const saveCatalogMarket = (id, name) => {
    const existing = marketCatalog.find((item) => item.id === id);
    if (existing?.name === name) return;
    const definition = { id: id ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`, name };
    pendingMarketChanges.current.set(definition.id, definition);
    saveImmediately.current = true;
    setMarketCatalog((items) => existing
      ? items.map((item) => item.id === id ? definition : item)
      : [...items, definition]);
    if (!existing) return;

    const rename = (items) => items.map((item) => item.id === id && item.name === existing.name ? { ...item, name } : item);
    const next = rename(marketsRef.current);
    marketsRef.current = next;
    setMarkets(next);
    setMatches((items) => items.map((match) => ({ ...match, markets: rename(match.markets ?? []) })));
  };

  const deletionPlan = (type, key) => {
    const removedMatches = matches.filter((match) => type === 'match' ? match.id === key
      : type === 'team' && (match.homeTeam === key || match.awayTeam === key));
    const removedIds = new Set(removedMatches.map((match) => match.id));
    const affectsPosition = (bet) => removedIds.has(bet.matchId ?? 'legacy-match')
      || (type === 'market' && (bet.marketId ?? 'default') === key);
    const remainingMatches = matches.filter((match) => !removedIds.has(match.id)).map((match) => ({
      ...match,
      markets: (match.id === selectedMatchId ? markets : match.markets ?? [])
        .filter((item) => type !== 'market' || item.id !== key),
    }));
    const selectableMatches = remainingMatches.filter((match) => match.markets.length);
    const nextMatch = selectableMatches.find((match) => match.id === selectedMatchId) ?? selectableMatches[0];
    const removedClosed = closedBets.filter(affectsPosition);
    const settledTotal = removedClosed.filter((bet) => bet.tag !== 'dry-run').reduce((sum, bet) =>
      sum + (bet.finalPnL ?? calculatePnL(bet.type, bet.entryOdds, bet.exitOdds, bet.stake)), 0);
    return {
      removedMatches: removedMatches.length,
      removedActive: activeBets.filter(affectsPosition).length,
      removedClosed: removedClosed.length,
      bankrollAdjustment: Number((-settledTotal).toFixed(2)),
      remainingMatches, nextMatch, affectsPosition,
    };
  };

  const deleteBackOfficeItem = (type, key) => {
    const { nextMatch, remainingMatches, affectsPosition, bankrollAdjustment } = deletionPlan(type, key);
    if (!nextMatch) return;
    const nextMarket = nextMatch.markets.find((item) => item.id === selectedMarketId) ?? nextMatch.markets[0];
    if (type !== 'match') pendingCatalogDeletions.current.set(JSON.stringify([type, key]), { type, key });
    if (type === 'market') {
      pendingMarketChanges.current.delete(key);
      setMarketCatalog((items) => items.filter((item) => item.id !== key));
    }
    if (type === 'team') {
      setTeamCatalog((items) => items.filter((item) => item.name !== key));
    }
    setMatches(remainingMatches);
    marketsRef.current = nextMatch.markets;
    setMarkets(nextMatch.markets);
    setSelectedMatchId(nextMatch.id);
    setSelectedMarketId(nextMarket.id);
    setActiveBets((items) => items.filter((bet) => !affectsPosition(bet)));
    setClosedBets((items) => items.filter((bet) => !affectsPosition(bet)));
    setBankroll((current) => Number((current + bankrollAdjustment).toFixed(2)));
    saveImmediately.current = true;
  };

  const addParticipant = async (name) => {
    const key = participantNameKey(name);
    if (participants.some((item) => participantNameKey(item) === key)) return 'Ce participant existe déjà.';

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const participant = await response.json();
      if (!response.ok) return participant.error || 'Création du participant impossible.';
      setTeamCatalog((items) => [...items, participant]);
      return '';
    } catch {
      return 'Création du participant impossible. Réessaie.';
    }
  };

  const saveCurrentMatch = (changes) => setMatches((items) => items.map((item) => item.id === selectedMatchId ? { ...item, ...changes } : item));
  const createMatch = (details = {}) => {
    const id = details.sourceEventId ? `fixture-${details.sourceEventId}` : `match-${Date.now()}`;
    const newMarkets = markets.map((item) => ({ ...item, backOdds: 1.25, layOdds: 1.26 }));
    const next = {
      id,
      homeTeam: details.homeTeam ?? 'Équipe domicile',
      awayTeam: details.awayTeam ?? 'Équipe extérieure',
      matchDate: details.matchDate ?? '',
      matchTime: details.matchTime ?? '',
      markets: newMarkets,
    };
    setMatches((items) => [next, ...items]);
    setSelectedMatchId(id);
    setMarkets(newMarkets);
    marketsRef.current = newMarkets;
    setSelectedMarketId(newMarkets[0]?.id ?? 'default');
  };

  const selectMatch = (id, preferredMarketId = selectedMarketId) => {
    const nextMatch = matches.find((item) => item.id === id);
    if (!nextMatch) return;
    const nextMarkets = Array.isArray(nextMatch.markets) && nextMatch.markets.length ? nextMatch.markets : markets.map((item) => ({ ...item, backOdds: 1.25, layOdds: 1.26 }));
    const nextMarket = nextMarkets.find((item) => item.id === preferredMarketId)
      ?? nextMarkets.find((item) => item.id === selectedMarketId)
      ?? nextMarkets[0];
    setMatches((items) => items.map((item) => item.id === id ? { ...item, markets: nextMarkets } : item));
    setSelectedMatchId(id);
    setMarkets(nextMarkets);
    marketsRef.current = nextMarkets;
    setSelectedMarketId(nextMarket.id);
  };

  const chooseDailyMatch = (match) => selectMatch(match.id);

  const resetMatch = () => {
    setBackOdds(1.25);
    setLayOdds(1.26);
    resetTimer();
  };

  const reopenPosition = (bet) => {
    const { closedAt, exitOdds, finalPnL, ...position } = bet;
    const pnl = finalPnL ?? calculatePnL(bet.type, bet.entryOdds, exitOdds, bet.stake);
    saveImmediately.current = true;
    if (bet.tag !== 'dry-run') setBankroll((current) => Number((current - pnl).toFixed(2)));
    setClosedBets((items) => items.filter((item) => item.id !== position.id));
    ensurePositionMarket(position);
    setActiveBets((items) => [position, ...items]);
    setHistoryOpen(false);
  };

  const clearHistory = () => {
    saveImmediately.current = true;
    setClosedBets([]);
  };

  if (!loaded) return <div className="min-h-screen grid place-items-center text-sm text-slate-400">Chargement du simulateur et de la base de données…</div>;

  return <div className="pb-12">
    <Header bankroll={availableBankroll} isRunning={isRunning} secondsLeft={secondsLeft} onOpenBackOffice={() => setBackOfficeTab('matches')} />
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6"><p role="status" aria-live="polite" className="mb-3 text-right text-[11px] text-slate-500">{saveStatus}</p><div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6 space-y-6">
        <MatchCard participants={participants} onAddParticipant={addParticipant} onManageParticipants={() => setBackOfficeTab('teams')} marketCatalog={marketCatalog} backOdds={backOdds} layOdds={layOdds} setBackOdds={setBackOdds} setLayOdds={setLayOdds} market={market} setMarket={setMarket} markets={markets} selectedMarketId={selectedMarketId} onSelectMarket={setSelectedMarketId} onAddMarket={addMarkets} secondsLeft={secondsLeft} isRunning={isRunning} elapsedMinutes={elapsedMinutes} lastIncrease={lastIncrease} teams={teams} matches={matches} currentMatch={currentMatch} selectedMatchId={selectedMatchId} onSelectMatch={selectMatch} onCreateMatch={createMatch} onChooseDailyMatch={chooseDailyMatch} onSaveMatch={saveCurrentMatch} onToggle={() => setIsRunning((running) => !running)} onFastForward={fastForward} onReset={resetMatch} activeBackCount={activeBets.filter((bet) => bet.type === 'BACK' && (bet.marketId ?? 'default') === selectedMarketId && (bet.matchId ?? 'legacy-match') === selectedMatchId).length} onCashoutAt={cashoutAtMarketQuote} />
        <BetForm betType={betType} setBetType={setBetType} entryOdds={entryOdds} cashoutOdds={betType === 'BACK' ? layOdds : backOdds} stake={stake} setStake={setStake} error={betError} notice={betNotice} matchName={`${teams[0]} vs ${teams[1]}`} marketName={market} onPlace={placeBet} />
      </div>
      <div className="space-y-6 lg:sticky lg:top-6 lg:col-span-6 lg:flex lg:max-h-[calc(100dvh_-_3rem)] lg:flex-col lg:self-start">
        <ActiveBets bets={activeBets} matches={matches} marketCatalog={marketCatalog} onSelectPosition={(bet) => selectMatch(bet.matchId ?? 'legacy-match', bet.marketId)} getExitOdds={closeOddsFor} onClose={closePosition} onCloseAll={() => [...activeBets].forEach(closePosition)} pnlFor={pnlFor} onEdit={editActivePosition} onDelete={deleteActivePosition} />
        <button type="button" onClick={() => setHistoryOpen(true)} className="w-full shrink-0 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 text-left text-sm font-semibold text-slate-200 shadow-xl transition hover:border-emerald-500/40 hover:bg-slate-800/80">
          <span className="flex items-center gap-2"><History className="h-5 w-5 text-emerald-400" />Consulter l’historique</span>
          <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">{closedBets.length}</span>
        </button>
      </div>
    </div></main>
    {historyOpen && <div className="fixed inset-0 z-50 bg-slate-950">
      <div role="dialog" aria-modal="true" aria-labelledby="history-modal-title" className="h-full w-full overflow-y-auto bg-slate-950 p-4 sm:p-8">
        <div className="sticky top-0 z-10 mb-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 pb-3 backdrop-blur"><h2 id="history-modal-title" className="text-lg font-semibold text-slate-100">Historique des positions</h2><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Fermer l’historique" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></div>
        <BetHistory bets={closedBets} matches={matches} marketCatalog={marketCatalog} onClear={clearHistory} onEdit={editClosedPosition} onDelete={deleteClosedPosition} onReopen={reopenPosition} />
      </div>
    </div>}
    {backOfficeTab && (
      <BackOffice
        matches={matches}
        marketCatalog={marketCatalog}
        onSaveMarket={saveCatalogMarket}
        initialTab={backOfficeTab}
        participants={participants}
        onAddParticipant={addParticipant}
        onCreateMatch={createMatch}
        getDeletionPlan={deletionPlan}
        onDeleteItem={deleteBackOfficeItem}
        saveStatus={saveStatus}
        onUpdateMatches={(updated) => setMatches(updated)}
        bankroll={bankroll}
        onUpdateBankroll={(val) => setBankroll(val)}
        onClose={() => setBackOfficeTab(null)}
      />
    )}
  </div>;
}
