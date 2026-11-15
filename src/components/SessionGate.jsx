import React, { useEffect, useState } from 'react';

async function sessionRequest(method, credentials) {
  const response = await fetch('/api/session', {
    method,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Odds-Session': '1',
    },
    body: credentials === undefined ? undefined : JSON.stringify(credentials),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export default function SessionGate({ children }) {
  const [session, setSession] = useState(null);
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    sessionRequest('GET').then((result) => {
      if (active) setSession(result);
    }).catch((failure) => {
      if (active) {
        setError(failure.message);
        setSession({ authenticated: false });
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session?.expiresAt) return;
    const timer = setTimeout(() => setSession({ authenticated: false }),
      Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);

  async function updateSession(method, credentials) {
    setBusy(true);
    setError('');
    try {
      setSession(await sessionRequest(method, credentials));
      setPassword('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <p className="p-6 text-slate-300">Vérification de la connexion…</p>;

  if (session.authenticated) {
    return <>
      {error && <p role="alert" className="px-4 py-2 text-sm text-rose-300">{error}</p>}
      {children({ onLogout: () => updateSession('DELETE'), logoutPending: busy })}
    </>;
  }

  return <main className="grid min-h-dvh place-items-center p-4">
    <form onSubmit={(event) => {
      event.preventDefault();
      updateSession('POST', { password, rememberDevice });
    }} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <h1 className="text-xl font-semibold text-slate-100">Connexion à OddsBoost</h1>
      <label className="block text-sm text-slate-200">
        Mot de passe
        <input type="password" autoComplete="current-password" required value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input type="checkbox" checked={rememberDevice}
          onChange={(event) => setRememberDevice(event.target.checked)} />
        Se souvenir de cet appareil pendant 14 jours
      </label>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
        {busy ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  </main>;
}
