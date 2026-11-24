import { validateCombinedTickets } from './src/utils/combinedBets.js';
import { randomUUID, createHash } from 'node:crypto';
import { calculatePnL } from './src/utils/betting.js';

function parseState(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function revision(state) {
  const { elapsedMinutes, secondsLeft, teamCatalog, ...shared } = state;
  return createHash('sha256').update(JSON.stringify(canonical(shared))).digest('hex');
}

export async function handleProfiles(request, response, pathname, pool, { getState, saveState }) {
  const profileId = String(request.headers['x-odds-profile'] ?? 'main');
  if (pathname !== '/api/profiles' && (profileId === 'main' || pathname === '/api/teams')) return false;
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
    return true;
  };
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SELECT id FROM settings WHERE id=1 FOR UPDATE');
    let body = {};
    if (request.method === 'POST' || request.method === 'PUT') {
      let raw = '';
      for await (const chunk of request) {
        raw += chunk;
        if (raw.length > 1_000_000) throw new Error('Requête trop volumineuse.');
      }
      body = JSON.parse(raw || '{}');
      if (!body || typeof body !== 'object') throw new Error('Requête invalide.');
    }
    if (pathname === '/api/profiles') {
      if (request.method === 'GET') {
        const [rows] = await connection.query('SELECT id,name FROM profiles ORDER BY created_at,id');
        await connection.commit();
        return send(200, rows);
      }
      if (request.method !== 'POST') return send(405, { error: 'Méthode interdite.' });
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 60 || typeof body.bankroll !== 'number'
        || !Number.isFinite(body.bankroll) || body.bankroll < 0) throw new Error('Nom et bankroll invalides.');
      const profile = { id: randomUUID(), name };
      const state = {
        bankroll: body.bankroll, activeBets: [], closedBets: [], combinedBets: [], sharedCatalogs: true,
      };
      await connection.execute('INSERT INTO profiles (id,name,state_json) VALUES (?,?,?)',
        [profile.id, profile.name, JSON.stringify(state)]);
      await connection.commit();
      return send(201, profile);
    }
    const [[profile]] = await connection.execute('SELECT state_json FROM profiles WHERE id=? FOR UPDATE', [profileId]);
    if (!profile || !profile.state_json) return send(404, { error: 'Profil introuvable.' });
    let personal = parseState(profile.state_json);
    let shared = await getState(connection);
    // Promote previously private matches and catalog entries once, preserving their IDs.
    if (!personal.sharedCatalogs) {
      const matches = new Map(shared.matches.map((item) => [item.id, item]));
      for (const match of personal.matches ?? []) if (!matches.has(match.id)) matches.set(match.id, match);
      const additions = (personal.teamCatalog ?? []).map(({ name }) => name);
      const changes = (personal.marketCatalog ?? []).filter((item) => !shared.marketCatalog.some(({ id }) => id === item.id));
      if (matches.size !== shared.matches.length || additions.length || changes.length) {
        await saveState(connection, { ...shared, matches: [...matches.values()], teamCatalogAdditions: additions, marketCatalogChanges: changes });
        shared = await getState(connection);
      }
      personal = { bankroll: personal.bankroll, activeBets: personal.activeBets, closedBets: personal.closedBets, combinedBets: personal.combinedBets ?? [], sharedCatalogs: true };
      await connection.execute('UPDATE profiles SET state_json=? WHERE id=?', [JSON.stringify(personal), profileId]);
    }
    const current = { ...shared, bankroll: personal.bankroll, activeBets: personal.activeBets, closedBets: personal.closedBets, combinedBets: personal.combinedBets ?? [] };
    if (pathname === '/api/state' && request.method === 'GET') {
      await connection.commit();
      return send(200, { ...current, revision: revision(current) });
    }
    let next;
    let result;
    if (pathname === '/api/state' && request.method === 'PUT') {
      if (body.revision !== revision(current)) return send(409, { error: 'Les données du profil ont changé. Rechargez la page.' });
      if (!Number.isFinite(body.bankroll) || !Array.isArray(body.matches)
        || !Array.isArray(body.activeBets) || !Array.isArray(body.closedBets)) throw new Error('État invalide.');
      const matchIds = new Set(body.matches.map((match) => match.id));
      for (const position of [...body.activeBets, ...body.closedBets]) {
        if (!matchIds.has(position.matchId) || !['BACK', 'LAY'].includes(position.type)
          || !Number.isFinite(position.entryOdds) || position.entryOdds < 1.01
          || !Number.isFinite(position.stake) || position.stake <= 0) throw new Error('Position invalide.');
      }
      next = { bankroll: body.bankroll, activeBets: body.activeBets, closedBets: body.closedBets, combinedBets: validateCombinedTickets(body.combinedBets ?? personal.combinedBets ?? []), sharedCatalogs: true };
      for (const position of next.closedBets) {
        const previous = current.closedBets.find(({ id }) => id === position.id);
        const sameSettlement = previous && ['type', 'entryOdds', 'stake', 'exitOdds'].every((key) => previous[key] === position[key]);
        position.finalPnL = sameSettlement ? previous.finalPnL
          : calculatePnL(position.type, position.entryOdds, position.exitOdds, position.stake);
      }
      // Publish only common data through the existing relational persistence path.
      await saveState(connection, { ...body, bankroll: shared.bankroll, activeBets: shared.activeBets, closedBets: shared.closedBets, combinedBets: shared.combinedBets }, profileId);
      shared = await getState(connection);
      result = { saved: true, revision: revision({ ...shared, bankroll: next.bankroll, activeBets: next.activeBets, closedBets: next.closedBets, combinedBets: next.combinedBets }) };
    } else if (pathname === '/api/positions/closed' && request.method === 'DELETE') {
      next = { ...personal, closedBets: [] };
      result = { cleared: true };
    } else return send(404, { error: 'Route API inconnue.' });
    await connection.execute('UPDATE profiles SET state_json=? WHERE id=?', [JSON.stringify(next), profileId]);
    await connection.commit();
    return send(200, result);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    // Also release locks for rejected or unsupported requests.
    await connection.rollback();
    connection.release();
  }
}
