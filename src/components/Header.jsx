import React from 'react';
import { TrendingUp, Wallet, Database } from 'lucide-react';
import { formatTimer } from '../utils/betting.js';

export default function Header({ bankroll, isRunning, secondsLeft, onOpenBackOffice }) {
  return <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-xl shadow-lg shadow-blue-500/20"><TrendingUp className="w-6 h-6 text-white" /></div>
        <div><h1 className="text-lg font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">OddsBoost Pro Engine</h1><p className="text-xs text-slate-400">Simulateur avec Cashout & Capital</p></div>
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={onOpenBackOffice}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition group"
          title="Ouvrir le Back Office"
        >
          <Database className="w-4 h-4 group-hover:scale-110 transition" />
          <span className="text-xs font-semibold hidden md:inline">Admin</span>
        </button>
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-4 py-1.5 flex items-center gap-2"><div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400"><Wallet className="w-4 h-4" /></div><div><div className="text-[10px] uppercase font-semibold text-slate-400 leading-tight">Solde Disponible</div><div className="text-sm font-bold font-mono text-emerald-400">{bankroll.toFixed(2)} €</div></div></div>
        <div className="hidden sm:flex items-center space-x-3 bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-1.5"><span className="relative flex h-2.5 w-2.5">{isRunning && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}<span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} /></span><span className="text-xs font-medium text-slate-300">Boost:</span><span className="font-mono text-sm font-semibold text-emerald-400">{formatTimer(secondsLeft)}</span></div>
      </div>
    </div>
  </header>;
}
