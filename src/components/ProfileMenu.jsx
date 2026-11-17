import React, { useState } from 'react';

export default function ProfileMenu({ profile, profiles, onSwitch, onCreate }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [bankroll, setBankroll] = useState('1000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="mx-auto max-w-7xl px-4 py-3 text-sm text-slate-200">
    <div className="flex flex-wrap items-center gap-3">
      <label>Profil <select disabled={busy} value={profile.id} onChange={async (event) => {
        setBusy(true);
        setError('');
        try {
          if (!(await onSwitch(event.target.value))) setError('La sauvegarde doit réussir avant de changer de profil.');
        } catch (failure) { setError(failure.message); }
        finally { setBusy(false); }
      }} className="ml-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
        {profiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <button type="button" disabled={busy} onClick={() => setCreating((value) => !value)} className="text-indigo-300 hover:underline">Nouveau profil</button>
    </div>
    {creating && <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      setError('');
      try {
        await onCreate(name, Number(bankroll));
        setCreating(false);
        setName('');
      } catch (failure) { setError(failure.message); }
      finally { setBusy(false); }
    }}>
      <label>Nom<input required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block rounded-lg border border-slate-700 bg-slate-900 px-3 py-2" /></label>
      <label>Bankroll initiale (€)<input required type="number" min="0" step="0.01" value={bankroll} onChange={(event) => setBankroll(event.target.value)} className="mt-1 block w-40 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2" /></label>
      <button disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-2">Créer le profil</button>
    </form>}
    {error && <p role="alert" className="mt-2 text-rose-300">{error}</p>}
  </div>;
}
