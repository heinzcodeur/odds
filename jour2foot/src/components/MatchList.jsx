function tournamentName(match) {
  return match.tournament?.uniqueTournament?.name ?? match.tournament?.name ?? 'Championnat';
}

function localHour(timestamp) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp * 1000));
}

function MatchRow({ match, countryNames }) {
  return <article className="match-row">
    <div className="match-time">{match.startTimestamp ? localHour(match.startTimestamp) : '—'}</div>
    <div className="match-info"><div className="competition"><span>{countryNames[match.country] ?? match.country}</span><b>·</b>{tournamentName(match)}</div><div className="teams"><span>{match.homeTeam?.name ?? 'Équipe à confirmer'}</span><span className="versus">vs</span><span>{match.awayTeam?.name ?? 'Équipe à confirmer'}</span></div></div>
    <span className="match-badge">À venir</span>
  </article>;
}

export default function MatchList({ matches, countryNames }) {
  return <div className="match-list">{matches.map((match) => <MatchRow key={match.id} match={match} countryNames={countryNames} />)}</div>;
}
