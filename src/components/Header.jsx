import React from 'react';
import { TrendingUp, Wallet, Database, Menu, History, CalendarDays } from 'lucide-react';
import { formatTimer } from '../utils/betting.js';

export default function Header({ bankroll, isRunning, secondsLeft, onOpenBackOffice, onOpenHistory, onShowTodayMatches }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:flex sm:min-h-16 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:mr-auto sm:gap-3">
          <div className="shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 shadow-lg shadow-blue-500/20">
            <TrendingUp aria-hidden="true" className="h-5 w-5 text-white sm:h-6 sm:w-6" />
          </div>
          <h1 className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-base font-bold text-transparent sm:text-lg">
            OddsBoost
          </h1>
        </div>

        <details className="relative justify-self-end sm:hidden" onKeyDown={(event) => {
          if (event.key !== 'Escape' || !event.currentTarget.open) return;
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary').focus();
        }}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 text-slate-200 [&::-webkit-details-marker]:hidden">
            <Menu aria-hidden="true" className="h-5 w-5" />
            <span className="text-xs font-semibold">Menu</span>
          </summary>
          <nav aria-label="Navigation OddsBoost" className="absolute right-0 top-full z-10 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl">
            {[
              { label: 'Administration', Icon: Database, action: onOpenBackOffice },
              { label: 'Consulter l’historique', Icon: History, action: onOpenHistory },
              { label: 'Matchs du jour', Icon: CalendarDays, action: onShowTodayMatches },
            ].map(({ label, Icon, action }) => (
              <button key={label} type="button" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-slate-200 hover:bg-slate-800"
                onClick={(event) => {
                  const menu = event.currentTarget.closest('details');
                  menu.open = false;
                  menu.querySelector('summary').focus({ preventScroll: true });
                  action();
                }}>
                <Icon aria-hidden="true" className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </details>

        <button
          type="button"
          onClick={onOpenBackOffice}
          title="Ouvrir le Back Office"
          className="group hidden min-h-11 sm:flex items-center justify-center gap-2 justify-self-end rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-slate-300 transition hover:border-emerald-500/30 hover:text-emerald-400 sm:min-h-0 sm:py-1.5"
        >
          <Database aria-hidden="true" className="h-4 w-4 shrink-0 transition group-hover:scale-110" />
          <span className="text-xs font-semibold">Admin</span>
        </button>

        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/90 px-2 py-1.5 sm:px-4">
          <div className="hidden shrink-0 rounded-md bg-emerald-500/20 p-1 text-emerald-400 sm:block">
            <Wallet aria-hidden="true" className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase leading-tight text-slate-400">Solde disponible</div>
            <div className="break-all font-mono text-sm font-bold text-emerald-400">{bankroll.toFixed(2)} €</div>
          </div>
        </div>

        <div className="flex h-full items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/80 px-2 py-1.5 sm:h-auto sm:gap-3 sm:px-4">
          <span aria-hidden="true" className="relative flex h-2.5 w-2.5 shrink-0">
            {isRunning && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-full w-full rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>
          <div className="leading-tight sm:flex sm:items-center sm:gap-2">
            <div className="text-[10px] font-medium text-slate-300 sm:text-xs">Boost</div>
            <div className="whitespace-nowrap font-mono text-sm font-semibold text-emerald-400">{formatTimer(secondsLeft)}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
