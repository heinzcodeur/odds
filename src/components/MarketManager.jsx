import React, { useState } from 'react';

export const MARKET_PRESETS = [
  { id: 'over-0-5', name: 'Over 0.5 goals' },
  { id: 'over-1-5', name: 'Over 1.5 goals' },
  { id: 'over-2-5', name: 'Over 2.5 goals' },
  { id: 'over-3-5', name: 'Over 3.5 goals' },
  { id: 'btts-yes', name: 'Both Teams To Score — Yes' },
  { id: 'btts-no', name: 'Both Teams To Score — No' },
];

export default function MarketManager({ markets, marketCatalog = [], selectedMarketId, onSelect, onAdd }) {
  const [customName, setCustomName] = useState('');
  const availableMarkets = marketCatalog.filter(({ id }) => !markets.some((item) => item.id === id));
  const presets = MARKET_PRESETS.map((preset) => marketCatalog.find((item) => item.id === preset.id) ?? preset);
  const addPack = () => onAdd(presets);
  const addCustom = (event) => {
    event.preventDefault();
    const name = customName.trim();
    if (!name) return;
    onAdd({ id: `custom-${Date.now()}`, name });
    setCustomName('');
  };

  return <div className="mb-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
    <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Back-office marchés</span><span className="text-[10px] text-slate-500">{markets.length} marché{markets.length === 1 ? '' : 's'}</span></div>
    <label className="sr-only" htmlFor="market-select">Marché actif</label>
    <select id="market-select" value={selectedMarketId} onChange={(event) => onSelect(event.target.value)} className="mb-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
      {markets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    {availableMarkets.length > 0 && markets.length < 30 && (
      <select aria-label="Ajouter un marché du catalogue" value="" onChange={(event) => {
        const item = availableMarkets.find(({ id }) => id === event.target.value);
        if (item) onAdd(item);
      }} className="mb-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200">
        <option value="">Ajouter un marché du catalogue</option>
        {availableMarkets.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select>
    )}
    <div className="flex flex-wrap gap-1.5">
      {presets.map((preset) => <button key={preset.id} type="button" onClick={() => onAdd(preset)} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300">+ {preset.name}</button>)}
      <button type="button" onClick={addPack} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20">+ Ajouter le pack</button>
    </div>
    <form onSubmit={addCustom} className="mt-2 flex gap-2"><input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Marché personnalisé" maxLength={80} className="min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500" /><button type="submit" className="rounded-md bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-600">Ajouter</button></form>
    <p className="mt-2 text-[10px] text-slate-600">Les marchés et leurs cotes sont sauvegardés séparément.</p>
  </div>;
}
