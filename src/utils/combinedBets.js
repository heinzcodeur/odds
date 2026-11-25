export const COMBINED_SYSTEMS = Object.freeze({
  accumulator: { name: 'Combiné simple', min: 2, max: 8 },
  trixie: { name: 'Trixie', min: 3, max: 3 },
  patent: { name: 'Patent', min: 3, max: 3, singles: true },
  yankee: { name: 'Yankee', min: 4, max: 4 },
  'lucky-15': { name: 'Lucky 15', min: 4, max: 4, singles: true },
  canadian: { name: 'Canadian', min: 5, max: 5 },
  'lucky-31': { name: 'Lucky 31', min: 5, max: 5, singles: true },
  heinz: { name: 'Heinz', min: 6, max: 6 },
  'lucky-63': { name: 'Lucky 63', min: 6, max: 6, singles: true },
  'super-heinz': { name: 'Super Heinz', min: 7, max: 7 },
  goliath: { name: 'Goliath', min: 8, max: 8 },
});

export function combinedLines(system, count) {
  const definition = COMBINED_SYSTEMS[system];
  if (!definition || count < definition.min || count > definition.max) return [];
  if (system === 'accumulator') return [Array.from({ length: count }, (_, index) => index)];
  const lines = [];
  for (let mask = 1; mask < 2 ** count; mask++) {
    const indices = [];
    for (let index = 0; index < count; index++) if (mask & (1 << index)) indices.push(index);
    if (indices.length >= (definition.singles ? 1 : 2)) lines.push(indices);
  }
  return lines;
}

export function combinedSummary(ticket) {
  const lines = combinedLines(ticket.system, ticket.selections.length);
  const unitCents = Math.round(Number(ticket.unitStake) * 100);
  const totalCents = lines.length * unitCents;
  const settled = ticket.selections.length > 0 && ticket.selections.every(({ result }) => result !== 'pending');
  const subBets = lines.map((line) => {
    const selections = line.map((index) => ticket.selections[index]);
    const odds = selections.reduce((product, selection) => product * Number(selection.odds), 1);
    if (!settled) return { selections, odds, result: 'pending', returnCents: null };
    if (selections.some(({ result }) => result === 'lost')) {
      return { selections, odds, result: 'lost', returnCents: 0 };
    }
    const settledOdds = selections.reduce((product, selection) =>
      product * (selection.result === 'void' ? 1 : Number(selection.odds)), 1);
    const result = selections.every((selection) => selection.result === 'void') ? 'void' : 'won';
    return { selections, odds, result, returnCents: Math.round(unitCents * settledOdds) };
  });
  const maximumCents = subBets.reduce((total, bet) => total + Math.round(unitCents * bet.odds), 0);
  const returnCents = settled ? subBets.reduce((total, bet) => total + bet.returnCents, 0) : null;
  return { lines, subBets, totalStake: totalCents / 100, maxReturn: maximumCents / 100,
    maxProfit: (maximumCents - totalCents) / 100, settled,
    returns: returnCents === null ? null : returnCents / 100,
    profit: returnCents === null ? null : (returnCents - totalCents) / 100 };
}

export function validateCombinedTickets(value) {
  if (!Array.isArray(value)) throw new Error('Tickets combinés invalides.');
  const ids = new Set();
  for (const ticket of value) {
    if (typeof ticket.id !== 'string' || !ticket.id || ids.has(ticket.id)) throw new Error('Identifiant de ticket invalide.');
    ids.add(ticket.id);
    if (!Array.isArray(ticket.selections) || !combinedLines(ticket.system, ticket.selections.length).length
      || !Number.isFinite(ticket.unitStake) || ticket.unitStake < 0.01
      || !['prod', 'dry-run'].includes(ticket.tag)) throw new Error('Paramètres du combiné invalides.');
    const matches = new Set();
    for (const selection of ticket.selections) {
      if (!selection.matchId || matches.has(selection.matchId) || !selection.marketId || !selection.marketName
        || !Number.isFinite(selection.odds) || selection.odds < 1.01
        || !['pending', 'won', 'lost', 'void'].includes(selection.result)) throw new Error('Sélection de combiné invalide.');
      if (selection.team != null && (!['home', 'away'].includes(selection.team.side)
        || typeof selection.team.name !== 'string' || !selection.team.name.trim())) {
        throw new Error('Équipe de sélection invalide.');
      }
      matches.add(selection.matchId);
    }
    const summary = combinedSummary(ticket);
    if (!Number.isFinite(summary.maxReturn) || !Number.isSafeInteger(Math.round(summary.maxReturn * 100))) throw new Error('Montant du combiné trop élevé.');
    if (Boolean(ticket.closedAt) !== summary.settled) throw new Error('Résultats et clôture du combiné incohérents.');
  }
  return value;
}
