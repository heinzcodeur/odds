import { useEffect, useMemo, useState } from 'react';
import MatchList from './components/MatchList.jsx';

const COUNTRY_NAMES = { England: 'Angleterre', France: 'France', Germany: 'Allemagne', Italy: 'Italie', Netherlands: 'Pays-Bas', Spain: 'Espagne', Portugal: 'Portugal' };

function todayInParis() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${date.year}-${date.month}-${date.day}`;
}

export default function App() {
  const date = todayInParis();
  const [matches, setMatches] = useState([]);
  const [country, setCountry] = useState('Toutes les catégories');
  const [search, setSearch] = useState('');
  const [state, setState] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState('');

  async function loadMatches() {
    setState('loading');
    try {
      const response = await fetch(`/api/matches/today?t=${Date.now()}`);
      if (!response.ok) throw new Error('Matchs du jour indisponibles');
      const payload = await response.json();
      if (payload.date !== date || !Array.isArray(payload.events)) throw new Error('Calendrier du jour invalide');
      setMatches(Array.isArray(payload.events) ? payload.events : []);
      setUpdatedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
      setState('ready');
    } catch {
      setMatches([]);
      setState('missing');
    }
  }

  useEffect(() => { loadMatches(); }, [date]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    return matches.filter((match) => {
      if (country !== 'Toutes les catégories' && match.country !== country) return false;
      if (!query) return true;
      const competition = match.tournament?.uniqueTournament?.name ?? match.tournament?.name ?? '';
      return `${match.homeTeam?.name ?? ''} ${match.awayTeam?.name ?? ''} ${competition}`.toLocaleLowerCase('fr').includes(query);
    });
  }, [matches, country, search]);
  const categories = useMemo(() => [...new Set(matches.map((match) => match.country).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [matches]);

  return <main className="page-shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">J2</span><span>jour<span className="brand-accent">2</span>foot</span></a><span className="live-label"><i /> Calendrier du jour</span></header>
    <section className="hero"><p className="eyebrow">FOOTBALL · FIXTURES</p><h1>Les matchs du jour</h1><p className="hero-subtitle">Les rencontres des sept championnats suivis, réunies au même endroit.</p><div className="hero-meta"><span>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'Europe/Paris' }).format(new Date())}</span>{state === 'ready' && <span className="update-note">Actualisé à {updatedAt}</span>}</div></section>
    <section className="content-card" aria-label="Liste des matchs">
      <div className="toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Équipe ou championnat" /></label><select aria-label="Filtrer par catégorie" value={country} onChange={(event) => setCountry(event.target.value)}><option>Toutes les catégories</option>{categories.map((item) => <option key={item} value={item}>{COUNTRY_NAMES[item] ?? item}</option>)}</select><button className="refresh-button" onClick={loadMatches} disabled={state === 'loading'}>{state === 'loading' ? 'Chargement…' : '↻ Actualiser'}</button></div>
      {state === 'missing' ? <div className="empty-state"><div className="empty-icon">⚽</div><h2>Impossible de charger les matchs du jour</h2><p>Vérifie que la clé <code>RAPIDAPI_KEY</code> est définie dans le fichier <code>.env</code>, puis actualise la page.</p></div>
        : state === 'loading' ? <div className="empty-state"><div className="spinner" /><p>Chargement du calendrier…</p></div>
          : filtered.length ? <><div className="results-heading"><strong>{filtered.length} match{filtered.length > 1 ? 's' : ''}</strong><span>Heures de Paris</span></div><MatchList matches={filtered} countryNames={COUNTRY_NAMES} /></>
            : <div className="empty-state"><div className="empty-icon">⌕</div><h2>Aucun match trouvé</h2><p>Change la catégorie sélectionnée ou le terme recherché.</p></div>}
    </section><footer>Les données du calendrier sont fournies par FootAPI.</footer>
  </main>;
}
