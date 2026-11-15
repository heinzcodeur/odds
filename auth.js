import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const cookieName = 'odds_session';
const sessionLifetime = 8 * 60 * 60;
const rememberedLifetime = 14 * 24 * 60 * 60;

function equal(left, right) {
  const digest = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(left), digest(right));
}

export async function authorize(request, response, pathname) {
  const { ODDS_PASSWORD, ODDS_SESSION_SECRET } = process.env;
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
    return false;
  };
  if (!ODDS_PASSWORD || !ODDS_SESSION_SECRET || ODDS_SESSION_SECRET.length < 32) {
    return send(503, { error: 'Connexion indisponible. Configurez les variables de connexion sur le serveur.' });
  }

  const sign = (expiry, nonce) => createHmac('sha256', ODDS_SESSION_SECRET)
    .update(JSON.stringify(nonce === undefined ? [expiry, ODDS_PASSWORD] : [expiry, ODDS_PASSWORD, nonce])).digest('base64url');
  const token = (request.headers.cookie ?? '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  const [expiry, signature, nonce, extra] = token?.split('.') ?? [];
  const authenticated = Boolean(extra === undefined && signature && /^\d+$/.test(expiry) &&
    Number(expiry) > Date.now() && equal(signature, sign(expiry, nonce)));
  const secure = process.env.VERCEL || request.socket?.encrypted ? '; Secure' : '';
  const setCookie = (value, maxAge) => response.setHeader('Set-Cookie',
    `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);

  if (pathname !== '/api/session') {
    if (!authenticated) return send(401, { error: 'Connexion requise.' });
    if (request.headers['sec-fetch-site'] === 'cross-site' && request.method !== 'GET') {
      return send(403, { error: 'Origine interdite.' });
    }
    return true;
  }

  if (request.method === 'GET') return send(200, { authenticated, expiresAt: authenticated ? Number(expiry) : null });
  if (request.headers['x-odds-session'] !== '1') return send(403, { error: 'Requête interdite.' });
  if (request.method === 'DELETE') {
    setCookie('', 0);
    return send(200, { authenticated: false });
  }
  if (request.method !== 'POST') return send(405, { error: 'Méthode interdite.' });

  let body = '';
  let password;
  let rememberDevice;
  try {
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 4096) return send(413, { error: 'Requête trop volumineuse.' });
    }
    ({ password, rememberDevice } = JSON.parse(body));
  } catch {
    return send(400, { error: 'Requête invalide.' });
  }
  if (typeof password !== 'string' || !equal(password, ODDS_PASSWORD)) {
    return send(401, { error: 'Mot de passe incorrect.' });
  }
  const lifetime = rememberDevice === true ? rememberedLifetime : sessionLifetime;
  const sessionNonce = randomBytes(32).toString('base64url');
  const expiresAt = String(Date.now() + lifetime * 1000);
  setCookie(`${expiresAt}.${sign(expiresAt, sessionNonce)}.${sessionNonce}`, lifetime);
  return send(200, { authenticated: true, expiresAt: Number(expiresAt) });
}
