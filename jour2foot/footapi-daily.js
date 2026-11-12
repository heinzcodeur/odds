import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const HOST = 'footapi7.p.rapidapi.com';
const BASE_URL = `https://${HOST}`;
let lastRequestAt = 0;

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

async function apiGet(path) {
  const waitMs = 1500 - (Date.now() - lastRequestAt);
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
  const response = await fetch(`${BASE_URL}${path}`, { headers: requestHeaders() });
  if (response.status === 204) return { data: {}, headers: response.headers };
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`FootAPI ${response.status} sur ${path}: ${detail}`);
  }
  return { data: await response.json(), headers: response.headers };
}

function localDateKey(date = new Date()) {
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

export async function fetchAndSaveToday() {
  await loadEnvFile();
  const iso = localDateKey();
  // `/inverse` asks FootAPI for the complete global schedule, including
  // smaller competitions that may be omitted from the default daily response.
  const { data, headers } = await apiGet(`/api/sport/football/scheduled-events/${iso}/inverse`);
  const events = (data.events ?? [])
    .filter((event) => eventLocalDate(event) === iso)
    .map((event) => ({
      ...event,
      country: event.tournament?.category?.name ?? 'International',
    }));
  events.sort((a, b) => a.startTimestamp - b.startTimestamp);

  const outputDirectory = join(ROOT, 'data');
  const datedOutputPath = join(outputDirectory, `footapi-matches-${date.iso}.json`);
  const outputPath = join(outputDirectory, 'matches.json');
  await mkdir(outputDirectory, { recursive: true });
  const json = `${JSON.stringify({ date: date.iso, events }, null, 2)}\n`;
  await Promise.all([writeFile(datedOutputPath, json), writeFile(outputPath, json)]);

  return { date: iso, events, remainingCalls: headers.get('x-ratelimit-requests-remaining') };
}

async function main() {
  const { date, events, remainingCalls } = await fetchAndSaveToday();

  console.log(`${events.length} matchs récupérés pour le ${date}.`);
  console.log(`JSON complet : ${join(ROOT, 'data', 'matches.json')}`);
  for (const event of events) {
    const tournament = event.tournament?.uniqueTournament?.name ?? event.tournament?.name ?? 'Tournoi';
    console.log(`${event.country} | ${tournament} | ${event.homeTeam?.name} - ${event.awayTeam?.name} | ${formatHour(event.startTimestamp)}`);
  }
  console.log(`Appel calendrier mondial effectué. Appels restants : ${remainingCalls ?? 'inconnu'}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('Erreur FootAPI :', error.message);
    process.exitCode = 1;
  });
}
