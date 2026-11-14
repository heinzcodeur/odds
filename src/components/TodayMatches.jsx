import React, { useEffect, useState } from 'react';

const parisClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
});

export default function TodayMatches({ matches, selectedMatchId, onSelectMatch }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const today = parisClock.format(now).slice(0, 10);
  const cutoff = parisClock.format(now - 2 * 60 * 60 * 1000).replace(' ', 'T');
  const upcoming = matches
    .filter(({ matchDate, matchTime }) => matchDate === today
      && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(matchTime)
      && `${matchDate}T${matchTime.length === 5 ? matchTime + ':00' : matchTime}` > cutoff)
    .sort((a, b) => a.matchTime.localeCompare(b.matchTime));

  return (
    <section id="today-matches" tabIndex={-1} aria-labelledby="today-matches-title" className="scroll-mt-32 shrink-0 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
      <h3 id="today-matches-title" className="mb-3 text-base font-semibold text-slate-200">Matchs du jour</h3>
      {upcoming.length ? (
        <ul className="max-h-44 space-y-2 overflow-y-auto">
          {upcoming.map((match) => (
            <li key={match.id}>
              <button type="button" aria-pressed={match.id === selectedMatchId} onClick={() => onSelectMatch(match.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-left text-sm text-slate-200 hover:border-indigo-400 aria-pressed:border-indigo-500">
                <span className="shrink-0 font-mono text-indigo-300">{match.matchTime.slice(0, 5)}</span>
                <span>{match.homeTeam} – {match.awayTeam}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-slate-400">Aucun match à afficher.</p>}
    </section>
  );
}
