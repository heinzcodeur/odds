const footballMarkets = [
  { id: 'under-0-5', name: 'Under 0.5 goals' },
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

export function presetMarketSport(id) {
  if (id === 'default' || footballMarkets.some((market) => market.id === id)) return 'football';
  if (basketballMarkets.some((market) => market.id === id)) return 'basketball';
  if (id === 'tennis-match-winner') return 'tennis';
  if (id === 'other-match-winner') return 'other';
  return null;
}

export function marketCategory(market, matches) {
  const category = presetMarketSport(market.id) ?? market.sport;
  if (category) return category;
  const sports = new Set(matches.filter((match) => match.sport
    && match.markets?.some(({ id }) => id === market.id)).map(({ sport }) => sport));
  return sports.size === 1 ? [...sports][0] : '';
}

export function marketFitsSport(id, sport) {
  const category = presetMarketSport(id);
  return !sport || !category || category === sport;
}

export function defaultMarketForSport(sport) {
  const preset = marketPresetsForSport(sport)[0] ?? {
    id: `${sport}-match-winner`,
    name: 'Vainqueur du match',
  };
  const market = !sport || sport === 'football' ? { id: 'default', name: 'Over 1.5 goals' } : preset;
  return { ...market, backOdds: 1.25, layOdds: 1.26 };
}

export function footballMarketOptions(catalog, matches) {
  const options = new Map(footballMarkets.map((market) => [market.id, market]));
  for (const match of matches) {
    if (match.sport !== 'football') continue;
    for (const market of match.markets ?? []) {
      if (marketFitsSport(market.id, 'football')) options.set(market.id, { id: market.id, name: market.name });
    }
  }
  for (const market of catalog) {
    if (market.sport && market.sport !== 'football') options.delete(market.id);
    else if (options.has(market.id) || marketCategory(market, matches) === 'football') options.set(market.id, market);
  }
  return [...options.values()];
}
