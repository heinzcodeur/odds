import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const HOST = 'footapi7.p.rapidapi.com';
const BASE_URL = `https://${HOST}`;
let lastRequestAt = 0;
const refreshes = new Map();

async function loadEnvFile() {
  try {
    const content = await readFile(join(ROOT, '.env'), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function requireApiKey() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error('Définis RAPIDAPI_KEY dans les variables d’environnement.');
  return key;
}

function requestHeaders() {
  return { 'X-RapidAPI-Key': requireApiKey(), 'X-RapidAPI-Host': HOST };
}

async function apiGet(path, budget) {
  if (budget.used >= budget.limit) throw new Error(`Limite de ${budget.limit} appels FootAPI atteinte. Chargement interrompu pour protéger le quota.`);
  if (budget.remaining === 0) throw new Error('Quota FootAPI épuisé.');
  budget.used++;
  const waitMs = 1500 - (Date.now() - lastRequestAt);
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
  const response = await fetch(`${BASE_URL}${path}`, { headers: requestHeaders(), signal: AbortSignal.timeout(15000) });
  const remaining = response.headers.get('x-ratelimit-requests-remaining');
  if (remaining !== null && Number.isFinite(Number(remaining))) budget.remaining = Number(remaining);
  if (response.status === 204) return { data: {}, headers: response.headers };
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`FootAPI ${response.status} sur ${path}: ${detail}`);
  }
  return { data: await response.json(), headers: response.headers };
}

export function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function eventLocalDate(event) {
  if (!event.startTimestamp) return null;
  return localDateKey(new Date(event.startTimestamp * 1000));
}

function formatHour(timestamp) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit',
  }).format(new Date(timestamp * 1000));
}

export async function fetchTodaySchedule() {
  await loadEnvFile();
  if (process.env.FOOTAPI_ENABLED !== 'true') {
    throw new Error('Récupération FootAPI désactivée pour protéger le quota. Les matchs déjà importés restent disponibles.');
  }
  const configuredLimit = Number(process.env.FOOTAPI_MAX_CALLS ?? 10);
  if (!Number.isInteger(configuredLimit) || configuredLimit < 1 || configuredLimit > 100) throw new Error('FOOTAPI_MAX_CALLS doit être compris entre 1 et 100.');
  const budget = { used: 0, limit: configuredLimit, remaining: null };
  const iso = localDateKey();
  const [year, month, day] = iso.split('-').map(Number);
  const tournaments = new Map();
  const offsetParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris', timeZoneName: 'longOffset',
  }).formatToParts(new Date(`${iso}T12:00:00Z`));
  const offset = offsetParts.find(({ type }) => type === 'timeZoneName').value.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offsetSeconds = offset ? (offset[1] === '+' ? 1 : -1) * (Number(offset[2]) * 3600 + Number(offset[3]) * 60) : 0;
  let remainingCalls = null;
  for (let page = 1; ; page++) {
    const { data, headers } = await apiGet(`/api/scheduled-tournaments/${day}/${month}/${year}/page/${page}`, budget);
    remainingCalls = headers.get('x-ratelimit-requests-remaining');
    const scheduled = data.scheduled ?? [];
    if (!Array.isArray(scheduled)) throw new Error('Réponse FootAPI invalide pour les compétitions.');
    for (const row of scheduled) {
      const tournament = row.tournament;
      const id = tournament?.uniqueTournament?.id;
      if (!id || (row.timezoneEventCount && !(Number(row.timezoneEventCount[String(offsetSeconds)]) > 0))) continue;
      tournaments.set(id, tournament);
    }
    if (!data.hasNextPage || !scheduled.length) break;
  }
  const byId = new Map();
  // Paris spans two UTC dates. Fetch both so early kickoffs stay included.
  const previousDay = new Date(`${iso}T12:00:00Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  const dates = [previousDay.toISOString().slice(0, 10), iso];
  for (const [id, tournament] of tournaments) {
    for (const date of dates) {
      const { data, headers } = await apiGet(`/api/tournament/${id}/scheduled-events/${date}`, budget);
      remainingCalls = headers.get('x-ratelimit-requests-remaining');
      if (data.events !== undefined && !Array.isArray(data.events)) throw new Error('Réponse FootAPI invalide pour les matchs.');
      for (const event of data.events ?? []) {
        if (!event.id || eventLocalDate(event) !== iso) continue;
        byId.set(event.id, { ...event, country: event.tournament?.category?.name ?? tournament.category?.name ?? 'International' });
      }
    }
  }
  const events = [...byId.values()];
  events.sort((a, b) => a.startTimestamp - b.startTimestamp);

  return { date: iso, events, remainingCalls };
}

async function fetchApiFootballSchedule(date) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error('Définis API_FOOTBALL_KEY dans jour2foot/.env.');

  const url = new URL('https://v3.football.api-sports.io/fixtures');
  url.search = new URLSearchParams({ date, timezone: 'Europe/Paris' });
  const response = await fetch(url, {
    headers: { 'x-apisports-key': key },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`API-Football a répondu HTTP ${response.status}.`);

  const data = await response.json();
  if (Object.keys(data.errors ?? {}).length || !Array.isArray(data.response) || ![0, 1].includes(data.paging?.total)) {
    throw new Error('API-Football n’a pas fourni le calendrier complet en une réponse.');
  }

  const byId = new Map();
  for (const match of data.response) {
    const { fixture, league, teams } = match;
    if (!fixture?.id || !Number.isFinite(fixture.timestamp)) {
      throw new Error('API-Football a renvoyé un match invalide.');
    }
    const event = {
      ...match,
      id: fixture.id,
      startTimestamp: fixture.timestamp,
      country: league?.country ?? 'International',
      tournament: league,
      homeTeam: teams?.home,
      awayTeam: teams?.away,
    };
    if (eventLocalDate(event) === date) byId.set(event.id, event);
  }
  const events = [...byId.values()].sort((a, b) => a.startTimestamp - b.startTimestamp);
  return { date, events, remainingCalls: response.headers.get('x-ratelimit-requests-remaining') };
}

function espnScoreboardDates(date) {
  const previousDay = new Date(`${date}T00:00:00Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  return [previousDay.toISOString().slice(0, 10), date];
}

async function fetchEspnSchedule(date) {
  const scoreboards = await Promise.all(espnScoreboardDates(date).map(async (day) => {
    const pageDate = day.replaceAll('-', '');
    const response = await fetch(`https://www.espn.com/soccer/scoreboard/_/date/${pageDate}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Le calendrier ESPN a répondu HTTP ${response.status}.`);
    const html = await response.text();
    const embedded = html.match(/window\['__espnfitt__'\]\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
    const scoreboard = embedded && JSON.parse(embedded[1]).page?.content?.scoreboard;
    if (scoreboard?.gmsByLeagueDate !== pageDate || !Array.isArray(scoreboard.gmsByLeague)) {
      throw new Error(`Calendrier ESPN illisible pour le ${day}.`);
    }
    return scoreboard.gmsByLeague;
  }));

  const byId = new Map();
  for (const { league, evts } of scoreboards.flat()) {
    for (const match of evts) {
      const startTimestamp = Date.parse(match.date) / 1000;
      const home = match.competitors?.find((team) => team.isHome === true);
      const away = match.competitors?.find((team) => team.isHome === false);
      if (!match.id || !Number.isFinite(startTimestamp) || !home?.displayName || !away?.displayName) {
        throw new Error('Le calendrier ESPN contient un match incomplet.');
      }
      const event = {
        id: `espn-${match.id}`,
        startTimestamp,
        country: match.vnue?.address?.country || 'International',
        tournament: { id: league.id, name: league.name },
        homeTeam: { id: home.id, name: home.displayName, logo: home.logo },
        awayTeam: { id: away.id, name: away.displayName, logo: away.logo },
      };
      if (eventLocalDate(event) === date) byId.set(event.id, event);
    }
  }
  return { date, events: [...byId.values()].sort((a, b) => a.startTimestamp - b.startTimestamp) };
}

async function fetchNbaSchedule(date) {
  const tomorrow = new Date(`${date}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const nextDate = tomorrow.toISOString().slice(0, 10);
  const dates = [...espnScoreboardDates(date), nextDate];
  const schedules = await Promise.all(dates.map(async (day) => {
    const url = new URL('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');
    url.searchParams.set('dates', day.replaceAll('-', ''));
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Le calendrier NBA a répondu HTTP ${response.status}.`);
    const { events } = await response.json();
    if (!Array.isArray(events)) throw new Error('Calendrier NBA illisible.');
    return events;
  }));

  const byId = new Map();
  for (const match of schedules.flat()) {
    const startTimestamp = Date.parse(match.date) / 1000;
    if (!Number.isFinite(startTimestamp)) throw new Error('Horaire NBA invalide.');
    const matchDate = localDateKey(new Date(startTimestamp * 1000));
    if (matchDate !== date && matchDate !== nextDate) continue;

    const competitors = match.competitions?.[0]?.competitors;
    const home = competitors?.find(({ homeAway }) => homeAway === 'home')?.team;
    const away = competitors?.find(({ homeAway }) => homeAway === 'away')?.team;
    if (!match.id || !home?.displayName || !away?.displayName) {
      throw new Error('Le calendrier NBA contient un match incomplet.');
    }
    const id = `espn-nba-${match.id}`;
    byId.set(id, {
      id,
      startTimestamp,
      tournament: { name: 'NBA' },
      homeTeam: { id: home.id, name: home.displayName, logo: home.logo },
      awayTeam: { id: away.id, name: away.displayName, logo: away.logo },
    });
  }
  return { date, throughDate: nextDate, events: [...byId.values()].sort((a, b) => a.startTimestamp - b.startTimestamp) };
}

async function writeJson(path, json) {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, json);
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function loadOrSaveSchedule(iso, sport) {
  await loadEnvFile();
  const isBasketball = sport === 'basketball';
  const provider = isBasketball ? 'espn-nba' : process.env.JOUR2FOOT_PROVIDER ?? 'espn';
  const outputDirectory = process.env.VERCEL === '1' ? join(tmpdir(), 'jour2foot') : join(ROOT, 'data');
  const datedOutputPath = join(outputDirectory, `${isBasketball ? 'nba' : 'footapi'}-matches-${iso}.json`);
  const outputPath = join(outputDirectory, isBasketball ? 'nba-matches.json' : 'matches.json');
  for (const path of [outputPath, datedOutputPath]) {
    try {
      const cached = JSON.parse(await readFile(path, 'utf8'));
      if (cached?.date === iso && cached.provider === provider && Array.isArray(cached.events)
        && (!isBasketball || cached.throughDate > iso)) return cached;
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
  }

  let payload;
  if (isBasketball) payload = await fetchNbaSchedule(iso);
  else if (provider === 'espn') payload = await fetchEspnSchedule(iso);
  else if (provider === 'api-football') payload = await fetchApiFootballSchedule(iso);
  else if (provider === 'footapi7') payload = await fetchTodaySchedule();
  else throw new Error(`Fournisseur Jour2Foot inconnu : ${provider}.`);
  const { date, events } = payload;
  if (date !== iso) throw new Error('Le jour a changé pendant le chargement du calendrier.');
  await mkdir(outputDirectory, { recursive: true });
  const json = `${JSON.stringify({ date, provider, throughDate: payload.throughDate, events }, null, 2)}\n`;
  await writeJson(outputPath, json);
  await writeJson(datedOutputPath, json);
  return payload;
}

export async function fetchAndSaveToday(sport = 'football') {
  const date = localDateKey();
  const key = `${sport}:${date}`;
  if (!refreshes.has(key)) {
    refreshes.set(key, loadOrSaveSchedule(date, sport).finally(() => refreshes.delete(key)));
  }
  return refreshes.get(key);
}

async function main() {
  const { date, events, remainingCalls } = await fetchAndSaveToday();

  console.log(`${events.length} matchs récupérés pour le ${date}.`);
  console.log(`JSON complet : ${join(ROOT, 'data', 'matches.json')}`);
  for (const event of events) {
    const tournament = event.tournament?.uniqueTournament?.name ?? event.tournament?.name ?? 'Tournoi';
    console.log(`${event.country} | ${tournament} | ${event.homeTeam?.name} - ${event.awayTeam?.name} | ${formatHour(event.startTimestamp)}`);
  }
  if (remainingCalls !== undefined && remainingCalls !== null) {
    console.log(`Appels restants : ${remainingCalls}.`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('Erreur calendrier :', error.message);
    process.exitCode = 1;
  });
}
