// A zero exit quote records a total win. Market quotes are at least 1.01.
export const TOTAL_WIN_EXIT_ODDS = 0;

export function formatExitOdds(exitOdds) {
  if (exitOdds === null) return 'Perte totale';
  if (exitOdds === TOTAL_WIN_EXIT_ODDS) return 'Gain total';
  return exitOdds.toFixed(2);
}

export function calculatePnL(type, entryOdds, currentOdds, amount) {
  // A closed position with no exit quote was settled at a total loss.
  if (currentOdds === null) {
    const { liability, matchedStake } = getPositionAmounts(type, entryOdds, amount);
    return -Number((type === 'LAY' ? liability : matchedStake).toFixed(2));
  }
  if (currentOdds === TOTAL_WIN_EXIT_ODDS) {
    return Number(maxPositionProfit(type, entryOdds, amount).toFixed(2));
  }
  if (type === 'LAY') {
    const target = Number(entryOdds) + 1;
    // Decimal quotes can land a fraction below the threshold in binary arithmetic.
    if (currentOdds >= target - Number.EPSILON * target) return Number(amount);
  }
  const oddsChange = type === 'LAY' ? currentOdds - entryOdds : entryOdds - currentOdds;
  return Math.min(amount * oddsChange, maxPositionProfit(type, entryOdds, amount));
}

export function maxPositionProfit(type, entryOdds, amount) {
  return type === 'LAY' ? amount : amount * Math.max(0, entryOdds - 1);
}

export function getPositionAmounts(type, entryOdds, amount) {
  if (type === 'LAY') {
    const matchedStake = amount;
    return { liability: matchedStake * Math.max(0, entryOdds - 1), matchedStake };
  }
  return { liability: 0, matchedStake: amount };
}

export function formatTimer(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function timestamp() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatMatchDate(date, time = '') {
  if (!date) return '';
  const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
    : date;
  return `${formattedDate}${time ? ` · ${time}` : ''}`;
}


const matchDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
});
const matchTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function defaultMatchSchedule(now = new Date()) {
  const parts = Object.fromEntries(matchDateFormatter.formatToParts(now).map(({ type, value }) => [type, value]));
  return {
    matchDate: `${parts.year}-${parts.month}-${parts.day}`,
    matchTime: matchTimeFormatter.format(new Date(now.getTime() - 3_600_000)),
  };
}

export function localDateKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0')).join('-');
}

export function closureDateTime(closedAt) {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(closedAt)) return null;
  const date = new Date(closedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function historyDateKey(bet) {
  const date = closureDateTime(bet.closedAt);
  if (date) return localDateKey(date);
  return /^\d{4}-\d{2}-\d{2}$/.test(bet.matchDate) ? bet.matchDate : '';
}

export function matchesHistoryPeriod(bet, from, to) {
  if (!from && !to) return true;
  const date = historyDateKey(bet);
  return Boolean(date && (!from || date >= from) && (!to || date <= to));
}


export function participantNameKey(name) {
  return name.trim().normalize('NFC').toLocaleLowerCase('fr');
}
