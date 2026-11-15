const footballMarkets = [
  { id: 'over-0-5', name: 'Over 0.5 goals' },
  { id: 'over-1-5', name: 'Over 1.5 goals' },
  { id: 'over-2-5', name: 'Over 2.5 goals' },
  { id: 'over-3-5', name: 'Over 3.5 goals' },
  { id: 'btts-yes', name: 'Both Teams To Score — Yes' },
  { id: 'btts-no', name: 'Both Teams To Score — No' },
];

const basketballMarkets = [
  { id: 'basketball-match-winner', name: 'Vainqueur du match (basket)' },
  { id: 'basketball-total-over', name: 'Total points — Plus' },
  { id: 'basketball-total-under', name: 'Total points — Moins' },
];

export function marketPresetsForSport(sport) {
  if (!sport || sport === 'football') return footballMarkets;
  if (sport === 'basketball') return basketballMarkets;
  return [];
}

export function marketFitsSport(id, sport) {
  if (!sport) return true;
  if (id === 'default' || footballMarkets.some((market) => market.id === id)) return sport === 'football';
  if (basketballMarkets.some((market) => market.id === id)) return sport === 'basketball';
  if (id === 'tennis-match-winner' || id === 'other-match-winner') return id === `${sport}-match-winner`;
  return true;
}

export function defaultMarketForSport(sport) {
  const preset = marketPresetsForSport(sport)[0] ?? {
    id: `${sport}-match-winner`,
    name: 'Vainqueur du match',
  };
  const market = !sport || sport === 'football' ? { id: 'default', name: 'Over 1.5 goals' } : preset;
  return { ...market, backOdds: 1.25, layOdds: 1.26 };
}
