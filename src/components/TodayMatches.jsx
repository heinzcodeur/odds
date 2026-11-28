import React, { useEffect, useRef, useState } from 'react';

const parisClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
});

export default function TodayMatches({ matches, selectedMatchId, onSelectMatch, loaded, onImport }) {
  const [now, setNow] = useState(Date.now);
  const latestImport = useRef(onImport);
  useEffect(() => { latestImport.current = onImport; }, [onImport]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const parisTime = parisClock.format(now);
  const today = parisTime.slice(0, 10);
  const importDay = loaded && parisTime.slice(11, 13) >= '10' ? today : null;
  useEffect(() => {
    if (!importDay) return;
    const controller = new AbortController();
    let retry;
    async function loadFootballMatches() {
      try {
        const response = await fetch('/api/fixtures/today?sport=football', {
          cache: 'no-store', signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || data.date !== importDay || !Array.isArray(data.fixtures)) {
          throw new Error('Calendrier de football indisponible.');
        }
        if (controller.signal.aborted) return;
        latestImport.current(data.fixtures);
      } catch {
        if (!controller.signal.aborted) retry = window.setTimeout(loadFootballMatches, 60_000);
      }
    }
    loadFootballMatches();
    return () => {
      controller.abort();
      window.clearTimeout(retry);
    };
  }, [importDay]);
  const cutoff = parisClock.format(now - 135 * 60_000).replace(' ', 'T');
  const upcoming = matches
    .filter(({ matchDate, matchTime }) => matchDate === today
      && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(matchTime)
      && `${matchDate}T${matchTime.length === 5 ? matchTime + ':00' : matchTime}` > cutoff)
    .sort((a, b) => a.matchTime.localeCompare(b.matchTime));

  return (
    <section id="today-matches" tabIndex={-1} aria-labelledby="today-matches-title" className="order-1 shrink-0 scroll-mt-32 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl lg:p-5">
      <h3 id="today-matches-title" className="mb-3 text-base font-semibold text-slate-200">Matchs du jour</h3>
      {upcoming.length ? (
        <ul className="max-h-[23.25rem] space-y-1.5 overflow-y-auto lg:max-h-44 lg:space-y-2">
          {upcoming.map((match) => (
            <li key={match.id}>
              <button type="button" aria-pressed={match.id === selectedMatchId} onClick={() => onSelectMatch(match.id)}
                className="flex h-12 w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1 text-left text-sm leading-tight text-slate-200 hover:border-indigo-400 aria-pressed:border-indigo-500 lg:h-auto lg:py-2 lg:leading-normal">
                <span className="shrink-0 font-mono text-indigo-300">{match.matchTime.slice(0, 5)}</span>
                <span className="line-clamp-2 min-w-0 break-words lg:line-clamp-none">{match.homeTeam} – {match.awayTeam}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-slate-400">Aucun match à afficher.</p>}
    </section>
  );
}
