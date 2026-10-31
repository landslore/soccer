import React from 'react';
import { useGameStore } from './state/game-store';
import { Navbar } from './presentation/components/Navbar';
import { TacticsBoard } from './presentation/components/TacticsBoard';
import { ChapasBoard } from './presentation/components/ChapasBoard';
import { StandingsTable } from './presentation/components/StandingsTable';
import { FixturesList } from './presentation/components/FixturesList';

export const App: React.FC = () => {
  const { activeTab } = useGameStore();

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      <Navbar />

      <main className="flex-1 pb-12">
        {activeTab === 'TACTICS' && <TacticsBoard />}
        {activeTab === 'MATCH' && <ChapasBoard />}
        {activeTab === 'STANDINGS' && <StandingsTable />}
        {activeTab === 'FIXTURES' && <FixturesList />}
      </main>

      <footer className="bg-slate-900 text-slate-400 py-6 text-center text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="font-bold text-white">D20 Soccer Manager</span> • Motor de Simulación Táctica de Fútbol 11
          </div>
          <div className="text-slate-500">
            Reglas D20 & RNG Determinista • Datos ECM Madrid & Primera Futgal
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
