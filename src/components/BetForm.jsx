import React from 'react';
import { ArrowDownRight, ArrowUpRight, Check, PlusCircle, Ticket, X } from 'lucide-react';
import { calculatePnL, getPositionAmounts, maxPositionProfit } from '../utils/betting.js';

export default function BetForm({ betType, setBetType, entryOdds, cashoutOdds, stake, setStake, error, notice, matchName, marketName, onPlace }) {
  const [tag, setTag] = React.useState('prod');
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [success, setSuccess] = React.useState(null);
  const numericOdds = Number(entryOdds);
  const numericStake = Number(stake);
  const pnl = calculatePnL(betType, numericOdds, cashoutOdds, numericStake);
  const amounts = getPositionAmounts(betType, numericOdds, numericStake);
  const outcomeLabel = betType === 'LAY' ? 'Liability à engager' : 'Gain net maximal';
  const outcomeAmount = betType === 'LAY' ? amounts.liability : maxPositionProfit(betType, numericOdds, numericStake);
  const confirmPosition = () => {
    const result = onPlace(tag);
    setReviewOpen(false);
    if (result?.ok) setSuccess({ type: betType, matchName, marketName, odds: numericOdds });
  };

  return <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
    <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2"><Ticket className="w-5 h-5 text-blue-400" />Ouvrir une Position</h2>
    <div className="grid grid-cols-2 gap-3 mb-5">
      <button onClick={() => setBetType('BACK')} className={`py-3 px-4 rounded-xl border text-sm font-semibold flex flex-col items-center justify-center transition-all ${betType === 'BACK' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border-blue-500' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 border-slate-700'}`}><div className="flex items-center gap-2"><ArrowUpRight className="w-4 h-4" /><span>POUR (Back)</span></div><span className="text-[10px] font-normal opacity-80 mt-0.5">Gagne si la cote baisse</span></button>
      <button onClick={() => setBetType('LAY')} className={`py-3 px-4 rounded-xl border text-sm font-semibold flex flex-col items-center justify-center transition-all ${betType === 'LAY' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border-rose-500' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 border-slate-700'}`}><div className="flex items-center gap-2"><ArrowDownRight className="w-4 h-4" /><span>CONTRE (Lay)</span></div><span className="text-[10px] font-normal opacity-80 mt-0.5">Gagne si la cote monte</span></button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="entry-odds">
          {`Cote d’entrée ${betType === 'BACK' ? 'Back' : 'Lay'}`}
        </label>
        <input id="entry-odds" type="text" readOnly value={numericOdds.toFixed(2)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-sm text-slate-100" />
      </div>
      <div><label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="stake">Stake / mise (€)</label><div className="relative"><input id="stake" type="number" min="0.01" step="1" value={stake} onChange={(event) => setStake(Number(event.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 font-mono text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">€</span></div></div>
    </div>
    <label className="mb-4 block text-xs font-medium text-slate-400">
      Tag de la position
      <select value={tag} onChange={(event) => setTag(event.target.value)} className="mt-1 block rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200">
        <option value="prod">prod</option>
        <option value="dry-run">dry-run</option>
      </select>
    </label>
    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-5 space-y-2">
      <div className="flex justify-between gap-3 text-xs text-slate-400"><span>Mise de marché :</span><span className="text-right font-mono text-slate-200 font-semibold">{amounts.matchedStake.toFixed(2)} €</span></div>
      <div className="flex justify-between gap-3 text-xs text-slate-400"><span>{outcomeLabel} :</span><span className={`text-right font-mono font-semibold ${betType === 'LAY' ? 'text-rose-300' : 'text-emerald-300'}`}>{outcomeAmount.toFixed(2)} €</span></div>
      <div className="flex justify-between gap-3 text-xs text-slate-400"><span>Formule de cashout :</span><span className="text-right font-mono text-amber-400 font-semibold">{betType === 'LAY' ? 'stake Lay × (cote de sortie − cote d’entrée)' : 'mise Back × (cote d’entrée − cote de sortie)'}</span></div>
      <div className="pt-2 border-t border-slate-800 flex justify-between items-center"><span className="text-xs font-medium text-slate-300">Résultat de cashout estimé, avec plafond :</span><span className={`text-base font-bold font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} €</span></div>
    </div>
    {error && <p role="alert" className="mb-3 text-center text-xs font-medium text-rose-400">{error}</p>}
    {notice && <p role="status" className="mb-3 text-center text-xs font-medium text-emerald-400">{notice}</p>}
    <button onClick={() => setReviewOpen(true)} className={`w-full py-3 px-4 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${betType === 'BACK' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25' : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25'}`}><PlusCircle className="w-4 h-4" />{`Valider la Position ${betType === 'BACK' ? 'POUR' : 'CONTRE'} à ${numericOdds.toFixed(2)}`}</button>
    {reviewOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="confirm-position-title" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between"><div><h3 id="confirm-position-title" className="text-lg font-bold text-slate-100">Confirmer la position</h3><p className="mt-1 text-xs text-slate-400">Vérifie les détails avant l’enregistrement.</p></div><button type="button" aria-label="Annuler" onClick={() => setReviewOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button></div><div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-400">Match</span><strong className="text-right text-slate-100">{matchName}</strong></div><div className="flex justify-between gap-3"><span className="text-slate-400">Marché</span><strong className="text-right text-slate-100">{marketName}</strong></div><div className="flex justify-between gap-3"><span className="text-slate-400">Position</span><strong className={betType === 'BACK' ? 'text-blue-300' : 'text-rose-300'}>{betType === 'BACK' ? 'POUR (Back)' : 'CONTRE (Lay)'}</strong></div><div className="flex justify-between gap-3"><span className="text-slate-400">Tag</span><strong className="text-slate-100">{tag}</strong></div><div className="flex justify-between gap-3"><span className="text-slate-400">Cote · mise</span><strong className="font-mono text-slate-100">{numericOdds.toFixed(2)} · {amounts.matchedStake.toFixed(2)} €</strong></div></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setReviewOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Modifier</button><button type="button" onClick={confirmPosition} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Confirmer</button></div></div></div>}
    {success && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSuccess(null); }}><div role="dialog" aria-modal="true" aria-labelledby="position-saved-title" className="position-success w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 text-center shadow-2xl"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"><Check className="h-7 w-7" /></div><h3 id="position-saved-title" className="text-lg font-bold text-slate-100">Position validée !</h3><p className="mt-2 text-sm text-slate-300">{`Position ${success.type === 'BACK' ? 'POUR' : 'CONTRE'} enregistrée`} sur <strong>{success.matchName}</strong>.</p><p className="mt-1 text-xs text-slate-400">{success.marketName} · cote {success.odds.toFixed(2)}</p><button type="button" onClick={() => setSuccess(null)} className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Continuer</button></div></div>}
  </section>;
}
