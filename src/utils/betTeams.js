export function teamsForBet(bet, matches = []) {
  const match = matches.find((item) => item.id === bet.matchId);
  if (match) return [match.homeTeam, match.awayTeam].filter(Boolean);
  return (bet.matchName ?? '').split(' vs ').filter(Boolean);
}

export function teamsForBets(bets, matches = []) {
  return [...new Set([
    ...matches.flatMap((match) => [match.homeTeam, match.awayTeam]),
    ...bets.flatMap((bet) => teamsForBet(bet, matches)),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
