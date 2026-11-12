import React, { useState } from 'react';
import { X, Trash2, Pencil, Save, Plus, Database, Users, Calendar, Layers, Settings } from 'lucide-react';
import { defaultMatchSchedule, formatMatchDate } from '../utils/betting.js';
import ParticipantSelect from './ParticipantSelect.jsx';

export default function BackOffice({ matches, onUpdateMatches, marketCatalog, onSaveMarket, initialTab, participants, onAddParticipant, onCreateMatch, getDeletionPlan, onDeleteItem, saveStatus, bankroll, onUpdateBankroll, onClose }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [matchDraft, setMatchDraft] = useState(null);
  const [marketDraft, setMarketDraft] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const impact = pendingDelete && getDeletionPlan(pendingDelete.type, pendingDelete.key);

  const saveMarket = (event) => {
    event.preventDefault();
    const name = marketDraft.name.trim();
    if (!name || creatingParticipant) return;
    onSaveMarket(marketDraft.id, name);
    setMarketDraft(null);
  };

  const [newParticipant, setNewParticipant] = useState('');
  const [participantError, setParticipantError] = useState('');
  const [creatingParticipant, setCreatingParticipant] = useState(false);
  const createParticipant = async (event) => {
    event.preventDefault();
    const name = newParticipant.trim();
    if (!name) return;
    setCreatingParticipant(true);
    const error = await onAddParticipant(name);
    setCreatingParticipant(false);
    setParticipantError(error);
    if (!error) setNewParticipant('');
  };

  const [editingTeam, setEditingTeam] = useState(null);
  const [teamDraft, setTeamDraft] = useState('');

  const [bankrollDraft, setBankrollDraft] = useState(String(bankroll));

  const startEditMatch = (match) => {
    setEditingMatchId(match.id);
    setMatchDraft({ ...match });
  };

  const saveMatchEdit = () => {
    if (!participants.includes(matchDraft.homeTeam) || !participants.includes(matchDraft.awayTeam)
      || matchDraft.homeTeam === matchDraft.awayTeam) return;
    if (editingMatchId === 'new') onCreateMatch(matchDraft);
    else onUpdateMatches(matches.map(m => m.id === editingMatchId ? matchDraft : m));
    setEditingMatchId(null);
    setMatchDraft(null);
  };

  const handleRenameTeam = (oldName, newName) => {
    if (!newName.trim() || oldName === newName) {
      setEditingTeam(null);
      return;
    }
    const updatedMatches = matches.map(m => ({
      ...m,
      homeTeam: m.homeTeam === oldName ? newName : m.homeTeam,
      awayTeam: m.awayTeam === oldName ? newName : m.awayTeam
    }));
    onUpdateMatches(updatedMatches);
    setEditingTeam(null);
  };

  const saveBankroll = () => {
    const val = Number(bankrollDraft);
    if (Number.isFinite(val)) {
      onUpdateBankroll(val);
      alert('Capital mis à jour !');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/95 p-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 p-2 rounded-lg">
            <Database className="h-5 w-5 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Back Office - Administration</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <X className="h-6 w-6" />
        </button>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        <nav className="flex flex-wrap border-b border-slate-800 bg-slate-900 px-4">
          <button
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'matches' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="inline-block h-4 w-4 mr-2" />
            Gestion des Matchs
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'teams' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="inline-block h-4 w-4 mr-2" />
            Équipes et joueurs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('markets')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 ${activeTab === 'markets' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <Layers className="mr-2 inline-block h-4 w-4" />
            Marchés
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'settings' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="inline-block h-4 w-4 mr-2" />
            Configuration
          </button>
        </nav>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          <p role="status" className="mb-4 text-xs text-slate-400">{saveStatus}</p>
          {activeTab === 'matches' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-slate-200">Liste des Matchs ({matches.length})</h3>
                <button
                  onClick={() => {
                    const newId = 'new';
                    const newMatch = {
                      id: newId,
                      homeTeam: '',
                      awayTeam: '',
                      ...defaultMatchSchedule(),
                      markets: []
                    };
                    startEditMatch(newMatch);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau Match
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/50 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Équipes</th>
                      <th className="px-4 py-3">Date & Heure</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(editingMatchId === 'new' ? [matchDraft, ...matches] : matches).map(match => (
                      <tr key={match.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-4">
                          {editingMatchId === match.id ? (
                            <div className="flex items-start gap-2">
                              <ParticipantSelect onCreate={editingMatchId === 'new' ? onAddParticipant : undefined} label="Participant à domicile" participants={participants} value={matchDraft.homeTeam} otherParticipant={matchDraft.awayTeam} onChange={(name) => setMatchDraft({ ...matchDraft, homeTeam: name })} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs w-32 text-white" />
                              <span className="text-slate-600 text-[10px]">VS</span>
                              <ParticipantSelect onCreate={editingMatchId === 'new' ? onAddParticipant : undefined} label="Participant visiteur" participants={participants} value={matchDraft.awayTeam} otherParticipant={matchDraft.homeTeam} onChange={(name) => setMatchDraft({ ...matchDraft, awayTeam: name })} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs w-32 text-white" />
                            </div>
                          ) : (
                            <div className="font-semibold text-slate-100">
                              {match.homeTeam} <span className="text-slate-500 mx-1">vs</span> {match.awayTeam}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-400">
                          {editingMatchId === match.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                                value={matchDraft.matchDate}
                                onChange={e => setMatchDraft({ ...matchDraft, matchDate: e.target.value })}
                              />
                              <input
                                type="time"
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                                value={matchDraft.matchTime}
                                onChange={e => setMatchDraft({ ...matchDraft, matchTime: e.target.value })}
                              />
                            </div>
                          ) : (
                            <span>{formatMatchDate(match.matchDate)} {match.matchTime}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {editingMatchId === match.id ? (
                              <>
                                <button
                                  onClick={saveMatchEdit}
                                  disabled={!matchDraft.homeTeam || !matchDraft.awayTeam || matchDraft.homeTeam === matchDraft.awayTeam}
                                  className="p-1.5 bg-emerald-600 rounded text-white hover:bg-emerald-500 disabled:opacity-40"
                                  title="Enregistrer"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setEditingMatchId(null)}
                                  className="p-1.5 bg-slate-700 rounded text-slate-300 hover:bg-slate-600"
                                  title="Annuler"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditMatch(match)}
                                  className="p-1.5 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition"
                                  title="Modifier"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setPendingDelete({ type: 'match', key: match.id, label: `${match.homeTeam} – ${match.awayTeam}` })}
                                  className="p-1.5 bg-rose-600/20 text-rose-400 rounded hover:bg-rose-600/30 transition"
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold text-slate-200 mb-6">Équipes et joueurs ({participants.length})</h3>
              
              <form onSubmit={createParticipant} className="mb-5 flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1 basis-48 text-sm text-slate-300">
                  Nom de l’équipe ou du joueur
                  <input required maxLength={60} value={newParticipant} onChange={(event) => { setNewParticipant(event.target.value); setParticipantError(''); }} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
                </label>
                <button type="submit" disabled={creatingParticipant} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Créer le participant</button>
                {participantError && <p role="alert" className="w-full text-xs text-rose-300">{participantError}</p>}
              </form>
              <div className="grid gap-3">
                {participants.map(team => (
                  <div key={team} className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-colors">
                    {editingTeam === team ? (
                      <div className="flex-1 flex gap-2 mr-4">
                        <input
                          autoFocus
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100"
                          value={teamDraft}
                          onChange={e => setTeamDraft(e.target.value)}
                        />
                        <button
                          onClick={() => handleRenameTeam(team, teamDraft)}
                          className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-500"
                        >
                          Valider
                        </button>
                        <button
                          onClick={() => setEditingTeam(null)}
                          className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-700"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-slate-200">{team}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingTeam(team);
                              setTeamDraft(team);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-400 transition"
                            title="Renommer"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" aria-label={`Supprimer ${team}`} onClick={() => setPendingDelete({ type: 'team', key: team, label: team })} className="rounded p-2 text-rose-400 hover:bg-rose-500/10">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              
              <p className="mt-6 text-xs text-slate-500 italic">
                Supprimer une équipe supprime aussi ses matchs et les positions associées.
              </p>
            </div>
          )}

          {activeTab === 'markets' && (
            <section className="mx-auto max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-200">Catalogue des marchés ({marketCatalog.length})</h3>
                <button type="button" onClick={() => setMarketDraft({ name: '' })} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                  Ajouter un marché
                </button>
              </div>
              {marketDraft && (
                <form onSubmit={saveMarket} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-800 p-3">
                  <label className="min-w-0 flex-1 basis-48 text-sm text-slate-300">
                    {marketDraft.id ? 'Modifier le nom du marché' : 'Nom du nouveau marché'}
                    <input autoFocus required maxLength={80} value={marketDraft.name} onChange={(event) => setMarketDraft({ ...marketDraft, name: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
                  </label>
                  <button type="button" onClick={() => setMarketDraft(null)} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Annuler</button>
                  <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Enregistrer</button>
                </form>
              )}
              <ul className="space-y-2">
                {[...marketCatalog].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <span className="min-w-0 break-words text-sm text-slate-200">{item.name}</span>
                    <div className="flex shrink-0 gap-1"><button type="button" aria-label={`Modifier ${item.name}`} onClick={() => setMarketDraft(item)} className="rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
                      Modifier
                    </button>
                      <button type="button" aria-label={`Supprimer ${item.name}`} onClick={() => setPendingDelete({ type: 'market', key: item.id, label: item.name })} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-slate-200 mb-6">Configuration Globale</h3>
              
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Capital de départ (Bankroll)</label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 font-mono"
                      value={bankrollDraft}
                      onChange={e => setBankrollDraft(e.target.value)}
                    />
                    <button
                      onClick={saveBankroll}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-500 transition"
                    >
                      Mettre à jour
                    </button>
                  </div>
                  <p className="mt-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Valeur actuelle : {bankroll.toFixed(2)} €</p>
                </div>

                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-blue-300">
                  <p>Le back office permet de modifier directement les valeurs en base de données. Toute modification est immédiatement synchronisée.</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      {pendingDelete && (
        <dialog
          ref={(dialog) => { if (dialog && !dialog.open) dialog.showModal(); }}
          onClose={() => setPendingDelete(null)}
          aria-labelledby="back-office-delete-title"
          className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 backdrop:bg-black/60"
        >
          <h3 id="back-office-delete-title" className="text-base font-semibold">Supprimer « {pendingDelete.label} » ?</h3>
          <p className="mt-2 text-sm text-slate-300">
            {impact.removedMatches} match(s), {impact.removedActive} position(s) active(s) et {impact.removedClosed} position(s) fermée(s) seront supprimés.
          </p>
          {impact.removedClosed > 0 && <p className="mt-2 text-sm text-slate-300">
            Ajustement du solde : {impact.bankrollAdjustment > 0 ? '+' : ''}{impact.bankrollAdjustment.toFixed(2)} €.
          </p>}
          {!impact.nextMatch && <p className="mt-2 text-sm text-amber-300">Ajoute d’abord un autre match avec un marché pour garder le simulateur utilisable.</p>}
          <form method="dialog" className="mt-4 flex justify-end gap-2">
            <button type="submit" className="rounded-lg px-3 py-2 text-sm hover:bg-slate-800">Annuler</button>
            <button type="button" disabled={!impact.nextMatch} onClick={() => {
              onDeleteItem(pendingDelete.type, pendingDelete.key);
              setPendingDelete(null);
            }} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-40">
              Supprimer définitivement
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}
