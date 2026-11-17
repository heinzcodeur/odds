import React, { useEffect, useState } from 'react';
import App from '../App.jsx';

export default function ProfileApp(props) {
  const [profiles, setProfiles] = useState(null);
  const [profileId, setProfileId] = useState(() => localStorage.getItem('odds-profile') ?? 'main');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    fetch('/api/profiles', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!data.length) throw new Error('Appliquez la migration 006-profiles à la base de données.');
      if (active) { setProfiles(data); setError(''); }
    }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [retry]);
  if (!profiles) return <div className="p-6 text-slate-200">
    {error ? <><p role="alert">{error}</p><button onClick={() => setRetry((value) => value + 1)} className="mt-3 text-indigo-300">Réessayer</button></> : 'Chargement des profils…'}
  </div>;
  const profile = profiles.find(({ id }) => id === profileId) ?? profiles[0];
  return <App key={profile.id} {...props} profile={profile} profiles={profiles}
    onSwitchProfile={(id) => { localStorage.setItem('odds-profile', id); setProfileId(id); }}
    onCreateProfile={async (name, bankroll) => {
      const response = await fetch('/api/profiles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, bankroll }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setProfiles((items) => [...items, result]);
    }} />;
}
