import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { createPool } from 'mysql2/promise';
import { calculatePnL, participantNameKey } from './src/utils/betting.js';

config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const pool = createPool({
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE ?? 'odds',
  ...(process.env.MYSQL_HOST
    ? { host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306) }
    : { socketPath: process.env.MYSQL_SOCKET ?? '/tmp/mysql.sock' }),
  ...(process.env.MYSQL_TLS === 'true' && {
    ssl: {
      rejectUnauthorized: true,
      verifyIdentity: true,
      ...(process.env.MYSQL_CA_PEM && { ca: process.env.MYSQL_CA_PEM }),
    },
  }),
  charset: 'UTF8MB4_UNICODE_CI',
  timezone: 'Z',
  dateStrings: true,
  connectionLimit: 4,
});

async function transaction(write, callback) {
  const connection = await pool.getConnection();
  try {
    if (write) {
      await connection.beginTransaction();
      const [settings] = await connection.query('SELECT id FROM settings WHERE id=1 FOR UPDATE');
      if (!settings.length) throw new Error('Importez les données OddsBoost dans MySQL.');
    } else {
      await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    }
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getState(connection) {
  const [[settings]] = await connection.query('SELECT * FROM settings WHERE id=1');
  if (!settings) throw new Error('Importez les données OddsBoost dans MySQL.');

  const [matches] = await connection.query(`SELECT m.id, m.home_team_id AS homeTeamId,
    m.away_team_id AS awayTeamId, h.name AS homeTeam, a.name AS awayTeam,
    COALESCE(m.match_date, '') AS matchDate, COALESCE(TIME_FORMAT(m.match_time, '%H:%i'), '') AS matchTime
    FROM matches m JOIN teams h ON h.id=m.home_team_id JOIN teams a ON a.id=m.away_team_id
    ORDER BY m.match_date DESC, m.created_at DESC, m.id`);
  const matchesById = new Map(matches.map((match) => {
    match.markets = [];
    return [match.id, match];
  }));
  const [quotes] = await connection.query(`SELECT mm.match_id, mm.market_id AS id, COALESCE(mm.name_override, m.name) AS name,
    mm.back_odds AS backOdds, mm.lay_odds AS layOdds FROM match_markets mm
    JOIN markets m ON m.id=mm.market_id
    WHERE mm.display_order IS NOT NULL ORDER BY mm.match_id, mm.display_order`);
  for (const { match_id, ...market } of quotes) matchesById.get(match_id).markets.push(market);

  const [marketCatalog] = await connection.query('SELECT id, name FROM markets ORDER BY name, id');
  const [teamCatalog] = await connection.query('SELECT id, name FROM teams ORDER BY name, id');
  const selectedMatch = matchesById.get(settings.selected_match_id);
  const { markets } = selectedMatch;
  const selectedMarket = markets.find((market) => market.id === settings.selected_market_id) ?? markets[0];
  if (!selectedMarket) throw new Error('Aucun marché disponible pour le match sélectionné.');

  const [positions] = await connection.query(`SELECT p.*, m.match_date, TIME_FORMAT(m.match_time, '%H:%i') AS match_time,
    h.name AS home_team, a.name AS away_team FROM positions p JOIN matches m ON m.id=p.match_id
    JOIN teams h ON h.id=m.home_team_id JOIN teams a ON a.id=m.away_team_id ORDER BY p.\`sequence\` DESC`);
  const activeBets = [];
  const closedBets = [];
  for (const bet of positions) {
    const position = {
      id: bet.id, type: bet.bet_type, entryOdds: bet.entry_odds, stake: bet.stake, timestamp: bet.opened_at_label,
      marketId: bet.market_id, marketName: bet.market_name_snapshot, categoryId: bet.category_id,
      matchId: bet.match_id, matchName: bet.match_name_snapshot || `${bet.home_team} vs ${bet.away_team}`,
      matchDate: bet.match_date_snapshot || bet.match_date || '',
      matchTime: bet.match_time_snapshot || bet.match_time || '',
    };
    if (bet.closed_at_label === null) activeBets.push(position);
    else closedBets.push({ ...position, closedAt: bet.closed_at_label, exitOdds: bet.exit_odds, finalPnL: bet.final_pnl });
  }
  return {
    bankroll: settings.bankroll, odds: selectedMarket.backOdds, backOdds: selectedMarket.backOdds,
    layOdds: selectedMarket.layOdds, market: selectedMarket.name, markets, marketCatalog, selectedMarketId: selectedMarket.id,
    elapsedMinutes: settings.elapsed_minutes, secondsLeft: settings.seconds_left, isRunning: Boolean(settings.is_running),
    betType: settings.bet_type, entryOdds: settings.entry_odds, stake: settings.stake,
    teams: [selectedMatch.homeTeam, selectedMatch.awayTeam], teamCatalog, matches, selectedMatchId: selectedMatch.id, activeBets, closedBets,
  };
}

function validNumber(value, fallback, min = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min ? number : fallback;
}

function normalizeMarkets(source) {
  const markets = new Map();
  for (const [index, item] of (Array.isArray(source) ? source.slice(0, 30) : []).entries()) {
    const id = String(item.id ?? `market-${index + 1}`).slice(0, 80);
    const name = String(item.name ?? '').trim().slice(0, 80);
    if (!name || markets.has(id)) continue;
    markets.set(id, {
      id, name, backOdds: validNumber(item.backOdds, 1.25, 1.01), layOdds: validNumber(item.layOdds, 1.26, 1.01),
    });
  }
  return [...markets.values()];
}

async function upsert(connection, table, columns, records, mutable) {
  if (!records.length) return;
  const fields = columns.split(' ');
  const tuple = `(${fields.map(() => '?').join(',')})`;
  const update = mutable.split(' ').map((field) => `${field}=VALUES(${field})`).join(',');
  // Stay below the MySQL prepared statement parameter limit.
  for (let start = 0; start < records.length; start += 500) {
    const batch = records.slice(start, start + 500);
    await connection.execute(`INSERT INTO ${table} (${fields.join(',')}) VALUES
      ${batch.map(() => tuple).join(',')} ON DUPLICATE KEY UPDATE ${update}`, batch.flat());
  }
}

async function deleteMissing(connection, table, ids) {
  if (!ids.length) {
    await connection.query(`DELETE FROM ${table}`);
    return;
  }
  // A JSON table keeps this bounded to one prepared parameter even for large histories.
  await connection.execute(`DELETE FROM ${table} WHERE id NOT IN (
    SELECT CONVERT(kept.id USING utf8mb4) COLLATE utf8mb4_0900_bin FROM JSON_TABLE(?, '$[*]' COLUMNS(id VARCHAR(191) PATH '$')) AS kept
  )`, [JSON.stringify(ids)]);
}


async function saveState(connection, state) {
  if (!state || typeof state !== 'object') throw new Error('État invalide');
  const sourceMatches = Array.isArray(state.matches) && state.matches.length ? state.matches : [{
    id: 'legacy-match', homeTeam: state.teams?.[0] ?? 'Real Madrid', awayTeam: state.teams?.[1] ?? 'Manchester City',
  }];
  const matches = new Map(sourceMatches.slice(0, 500).map((item) => {
    const id = String(item.id ?? `match-${randomUUID()}`).slice(0, 80);
    return [id, {
      id, homeTeamId: String(item.homeTeamId ?? '').slice(0, 191), awayTeamId: String(item.awayTeamId ?? '').slice(0, 191),
      homeTeam: String(item.homeTeam ?? '').trim().slice(0, 60),
      awayTeam: String(item.awayTeam ?? '').trim().slice(0, 60),
      matchDate: String(item.matchDate ?? '').slice(0, 10),
      matchTime: String(item.matchTime ?? '').slice(0, 10),
      markets: normalizeMarkets(item.markets),
    }];
  }));
  const selectedMatch = matches.get(String(state.selectedMatchId)) ?? matches.values().next().value;
  selectedMatch.markets = normalizeMarkets(state.markets);
  if (!selectedMatch.markets.length) selectedMatch.markets.push({
    id: 'default', name: String(state.market ?? 'Over 1.5 goals').slice(0, 80),
    backOdds: validNumber(state.backOdds ?? state.odds, 1.25, 1.01),
    layOdds: validNumber(state.layOdds, 1.26, 1.01),
  });
  const selectedMarket = selectedMatch.markets.find((item) => item.id === String(state.selectedMarketId)) ?? selectedMatch.markets[0];

  const [teams] = await connection.query('SELECT id, name FROM teams ORDER BY created_at, id');
  const teamIds = new Set(teams.map((team) => team.id));
  const teamsByName = new Map(teams.map((team) => [participantNameKey(team.name), team.id]));
  const ensureTeam = async (name, preferredId) => {
    if (!name) throw new Error('Saisissez les deux noms d’équipe.');
    const key = participantNameKey(name);
    if (teamsByName.has(key)) return teamsByName.get(key);
    const id = preferredId && !teamIds.has(preferredId) ? preferredId : `team-${randomUUID()}`;
    await connection.execute('INSERT INTO teams (id,name,created_at) VALUES (?,?,UTC_TIMESTAMP())', [id, name]);
    teamIds.add(id);
    teamsByName.set(key, id);
    return id;
  };

  for (const name of state.teamCatalogAdditions ?? []) {
    if (typeof name !== 'string' || !name.trim() || name.length > 60) {
      throw new Error('Nom de participant invalide.');
    }
    await ensureTeam(name.trim());
  }

  const matchRecords = [];
  const marketRecords = new Map();
  const marketKey = (matchId, marketId) => JSON.stringify([matchId, marketId]);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  for (const match of matches.values()) {
    const homeTeamId = await ensureTeam(match.homeTeam, match.homeTeamId);
    const awayTeamId = await ensureTeam(match.awayTeam, match.awayTeamId);
    matchRecords.push([match.id, homeTeamId, awayTeamId, match.matchDate || null, match.matchTime || null, now]);
    for (const [order, market] of match.markets.entries()) {
      marketRecords.set(marketKey(match.id, market.id), [match.id, market.id, market.name, order, market.backOdds, market.layOdds]);
    }
  }
  await upsert(connection, 'matches', 'id home_team_id away_team_id match_date match_time created_at', matchRecords,
    'home_team_id away_team_id match_date match_time');

  const categoryRecords = new Map();
  const positionRecords = new Map();
  const [settledRows] = await connection.query(`SELECT id, bet_type, entry_odds, stake, exit_odds, final_pnl
    FROM positions WHERE closed_at_label IS NOT NULL`);
  const settledPositions = new Map(settledRows.map((position) => [position.id, position]));
  function collectPosition(bet, closedAt) {
    const match = matches.get(String(bet.matchId)) ?? selectedMatch;
    const type = bet.type === 'BACK' ? 'BACK' : 'LAY';
    const entryOdds = validNumber(bet.entryOdds, 1.25, 1.01);
    const stake = validNumber(bet.stake, 1, 0.01);
    const exitOdds = closedAt === null || bet.exitOdds === null ? null : validNumber(bet.exitOdds, 1.25, 1.01);
    const id = String(bet.id);
    const settled = settledPositions.get(id);
    // Keep historical results aligned with the amounts already credited.
    const sameSettlement = settled?.bet_type === type && settled.entry_odds === entryOdds
      && settled.stake === stake && settled.exit_odds === exitOdds;
    const finalPnL = closedAt === null ? null : sameSettlement && settled.final_pnl !== null
      ? settled.final_pnl : calculatePnL(type, entryOdds, exitOdds, stake);
    const marketId = String(bet.marketId ?? selectedMarket.id).slice(0, 191);
    const name = String(bet.marketName ?? selectedMarket.name).slice(0, 80);
    const categoryId = String(bet.categoryId ?? marketId).slice(0, 80);
    const family = categoryId.startsWith('over-') || name.toLowerCase().startsWith('over ') ? 'GOALS'
      : categoryId.startsWith('btts-') || name.toLowerCase().includes('both teams') ? 'BTTS' : 'CUSTOM';
    categoryRecords.set(categoryId, [categoryId, name, family]);
    const key = marketKey(match.id, marketId);
    if (!marketRecords.has(key)) marketRecords.set(key, [match.id, marketId, name, null, null, null]);
    positionRecords.set(id, [
      id, type, entryOdds, stake, String(bet.timestamp ?? ''), match.id, marketId, categoryId, name,
      String(bet.matchName ?? `${match.homeTeam} vs ${match.awayTeam}`).slice(0, 130),
      String(bet.matchDate ?? match.matchDate).slice(0, 30), String(bet.matchTime ?? match.matchTime).slice(0, 10),
      closedAt, exitOdds, finalPnL,
    ]);
  }
  for (const bet of state.activeBets ?? []) collectPosition(bet, null);
  for (const bet of state.closedBets ?? []) collectPosition(bet, String(bet.closedAt ?? ''));

  const [catalog] = await connection.query('SELECT id, name FROM markets');
  const names = new Map(catalog.map(({ id, name }) => [id, name]));
  const catalogChanges = new Map();
  for (const { id, name } of state.marketCatalogChanges ?? []) {
    if (typeof id !== 'string' || !id || id.length > 191 || typeof name !== 'string' || !name.trim() || name.length > 80) {
      throw new Error('Marché du catalogue invalide.');
    }
    catalogChanges.set(id, name.trim());
  }
  const previousNames = new Map(names);
  for (const [id, name] of catalogChanges) names.set(id, name);
  await upsert(connection, 'markets', 'id name', [...catalogChanges], 'name');

  const newMarkets = [];
  const marketLinks = [...marketRecords.values()].map(([matchId, marketId, name, order, backOdds, layOdds]) => {
    if (!names.has(marketId)) {
      names.set(marketId, name);
      newMarkets.push([marketId, name]);
    }
    const usesCatalogName = name === names.get(marketId)
      || (catalogChanges.has(marketId) && name === previousNames.get(marketId));
    return [matchId, marketId, usesCatalogName ? null : name, order, backOdds, layOdds];
  });
  await upsert(connection, 'markets', 'id name', newMarkets, 'id');

  // Clear ranks before upserting to allow reordering without a unique-key collision.
  await connection.query('UPDATE match_markets SET display_order=NULL, back_odds=NULL, lay_odds=NULL WHERE display_order IS NOT NULL');
  await upsert(connection, 'match_markets', 'match_id market_id name_override display_order back_odds lay_odds', marketLinks,
    'name_override display_order back_odds lay_odds');
  await upsert(connection, 'position_categories', 'id name family', [...categoryRecords.values()], 'name family');
  const positionFields = 'bet_type entry_odds stake opened_at_label match_id market_id category_id market_name_snapshot match_name_snapshot match_date_snapshot match_time_snapshot closed_at_label exit_odds final_pnl';
  await upsert(connection, 'positions', `id ${positionFields}`, [...positionRecords.values()], positionFields);
  await deleteMissing(connection, 'positions', [...positionRecords.keys()]);
  await connection.execute(`UPDATE settings SET bankroll=?, elapsed_minutes=?, seconds_left=?, is_running=?,
    bet_type=?, entry_odds=?, stake=?, selected_match_id=?, selected_market_id=? WHERE id=1`, [
    validNumber(state.bankroll, 1000, -Infinity), validNumber(state.elapsedMinutes, 0),
    Math.min(600, Math.floor(validNumber(state.secondsLeft, 600))), state.isRunning ? 1 : 0,
    state.betType === 'BACK' ? 'BACK' : 'LAY', validNumber(state.entryOdds, 1.25, 1.01), validNumber(state.stake, 100, 0.01),
    selectedMatch.id, selectedMarket.id,
  ]);
  await connection.query(`DELETE mm FROM match_markets mm LEFT JOIN positions p
    ON p.match_id=mm.match_id AND p.market_id=mm.market_id
    WHERE mm.display_order IS NULL AND p.id IS NULL`);
  await deleteMissing(connection, 'matches', [...matches.keys()]);

  for (const { type, key } of state.catalogDeletions ?? []) {
    if (typeof key !== 'string' || !key || key.length > 191) throw new Error('Suppression invalide.');
    if (type === 'market') {
      await connection.execute('DELETE FROM markets WHERE id=?', [key]);
      await connection.execute(`DELETE c FROM position_categories c LEFT JOIN positions p ON p.category_id=c.id
        WHERE c.id=? AND p.id IS NULL`, [key]);
    } else if (type === 'team') {
      await connection.execute('DELETE FROM teams WHERE name=?', [key]);
    } else {
      throw new Error('Type de suppression invalide.');
    }
  }
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Requête trop volumineuse');
  }
  return JSON.parse(body || '{}');
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

export function createApiMiddleware() {
  return async (request, response, next) => {
    const pathname = (request.url ?? '/').split('?', 1)[0];
    if (!pathname.startsWith('/api/')) return next?.();
    try {
      if (request.method === 'GET' && pathname === '/api/state') {
        return sendJson(response, 200, await transaction(false, getState));
      }
      if (request.method === 'POST' && pathname === '/api/teams') {
        const { name: input } = await readBody(request);
        const name = typeof input === 'string' ? input.trim() : '';
        if (!name || name.length > 60) return sendJson(response, 400, { error: 'Nom de participant invalide.' });
        const participant = await transaction(true, async (connection) => {
          const [teams] = await connection.query('SELECT name FROM teams');
          const key = participantNameKey(name);
          if (teams.some((team) => participantNameKey(team.name) === key)) return null;
          const id = `team-${randomUUID()}`;
          await connection.execute('INSERT INTO teams (id,name,created_at) VALUES (?,?,UTC_TIMESTAMP())', [id, name]);
          return { id, name };
        });
        return participant ? sendJson(response, 201, participant)
          : sendJson(response, 409, { error: 'Ce participant existe déjà.' });
      }
      if (request.method === 'PUT' && pathname === '/api/state') {
        const state = await readBody(request);
        await transaction(true, (connection) => saveState(connection, state));
        return sendJson(response, 200, { saved: true });
      }
      if (request.method === 'DELETE' && pathname === '/api/positions/closed') {
        await transaction(true, (connection) => connection.query('DELETE FROM positions WHERE closed_at_label IS NOT NULL'));
        return sendJson(response, 200, { cleared: true });
      }
      return sendJson(response, 404, { error: 'Route API inconnue' });
    } catch (error) {
      if (error.code) {
        console.error('MySQL:', error.code, error.message);
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
          return sendJson(response, 503, { error: 'Accès MySQL refusé. Vérifiez MYSQL_USER et MYSQL_PASSWORD dans .env.' });
        }
        if (error.code === 'ER_BAD_DB_ERROR' || error.code === 'ER_NO_SUCH_TABLE') {
          return sendJson(response, 503, { error: 'Base OddsBoost introuvable ou incomplète. Vérifiez MYSQL_DATABASE et l’import.' });
        }
        return sendJson(response, 503, { error: 'Opération MySQL impossible. Consultez le journal du serveur.' });
      }
      return sendJson(response, 400, { error: error.message || 'Erreur de base de données' });
    }
  };
}

export function closeDatabase() { return pool.end(); }
