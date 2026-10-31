import React, { useState } from 'react';
import { useGameStore, ActiveTab } from '../../state/game-store';
import { Trophy, Users, Shield, Play, ChevronDown, Check } from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    database,
    userTeamId,
    activeTab,
    selectedGroupId,
    setActiveTab,
    setUserTeam,
    setSelectedGroup,
  } = useGameStore();

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const currentTeam = userTeamId ? database.teams[String(userTeamId)] : null;
  const currentGroup = database.groups.find((g) => g.number === selectedGroupId) || database.groups[0];

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'TACTICS', label: 'Mi Equipo & Táctica', icon: <Users className="w-4 h-4" /> },
    { id: 'MATCH', label: 'Modo Chapas F11', icon: <Play className="w-4 h-4" /> },
    { id: 'STANDINGS', label: 'Clasificación', icon: <Trophy className="w-4 h-4" /> },
    { id: 'FIXTURES', label: 'Jornadas & Partidos', icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <>
      <header className="bg-valle-blue text-white shadow-md border-b-4 border-valle-yellow">
        {/* Fila superior: Marca y Selector de Equipo */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-full p-1.5 shadow-sm">
              <span className="text-2xl">⚽</span>
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wide flex items-center gap-2">
                D20 SOCCER MANAGER <span className="text-xs bg-valle-yellow text-slate-900 px-2 py-0.5 rounded font-bold uppercase">Fútbol 11</span>
              </h1>
              <p className="text-xs text-blue-200">
                Sistema de Rol D20 • ECM Madrid & Primera Futgal
              </p>
            </div>
          </div>

          {/* Selector de Equipo Actual */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTeamModalOpen(true)}
              className="flex items-center gap-2 bg-valle-blue-dark hover:bg-blue-900 px-3 py-1.5 rounded-lg border border-blue-400/40 text-sm font-semibold transition-all shadow-inner"
            >
              {currentTeam?.badgeUrl ? (
                <img src={currentTeam.badgeUrl} alt={currentTeam.name} className="w-6 h-6 object-contain" />
              ) : (
                <Shield className="w-5 h-5 text-valle-yellow" />
              )}
              <div className="text-left">
                <div className="text-xs text-blue-200">Tu Club:</div>
                <div className="font-bold text-white max-w-[180px] truncate">{currentTeam?.name || 'Selecciona Equipo'}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-blue-300" />
            </button>
          </div>
        </div>

        {/* Fila inferior: Pestañas de Navegación estilo "Somos Valle" */}
        <div className="bg-valle-blue-dark px-4 py-1.5 border-t border-blue-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto gap-2 py-1 scrollbar-none">
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded font-bold text-xs md:text-sm transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-valle-blue text-valle-yellow border-2 border-valle-yellow shadow-md'
                        : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-600'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Selector de Grupo */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-blue-300 hidden md:inline font-semibold">Grupo:</span>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroup(Number(e.target.value))}
                className="bg-slate-800 text-valle-yellow border border-blue-500 rounded px-2 py-1 text-xs font-bold focus:outline-none"
              >
                {database.groups.map((g) => (
                  <option key={g.number} value={g.number}>
                    {g.name} ({g.teams.length} equipos)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Modal para cambiar de Equipo entre los 76 clubes */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-valle-blue text-white px-5 py-4 flex items-center justify-between border-b-2 border-valle-yellow">
              <div>
                <h3 className="font-bold text-lg">Elige tu Club para la Temporada</h3>
                <p className="text-xs text-blue-200">76 clubes disponibles de ECM Madrid y Primera Futgal</p>
              </div>
              <button
                onClick={() => setIsTeamModalOpen(false)}
                className="text-blue-200 hover:text-white text-xl font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Selector de grupo dentro del modal */}
            <div className="p-3 bg-slate-100 border-b flex gap-2 overflow-x-auto">
              {database.groups.map((g) => (
                <button
                  key={g.number}
                  onClick={() => setSelectedGroup(g.number)}
                  className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedGroupId === g.number
                      ? 'bg-valle-blue text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border'
                  }`}
                >
                  {g.number === 9 ? 'Galicia (Futgal)' : `Grupo ${g.number}`}
                </button>
              ))}
            </div>

            {/* Listado de equipos del grupo seleccionado */}
            <div className="p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              {currentGroup.teams.map((t) => {
                const isSelected = userTeamId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setUserTeam(t.id);
                      setIsTeamModalOpen(false);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-valle-blue bg-blue-50 ring-2 ring-valle-blue'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    {t.badgeUrl ? (
                      <img src={t.badgeUrl} alt={t.name} className="w-10 h-10 object-contain flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-valle-blue flex items-center justify-center font-bold text-sm">
                        {t.name.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 text-sm truncate">{t.name}</div>
                      <div className="text-xs text-slate-500">
                        {t.sourceOrigin === 'SANTACRUZ_FUTGAL' ? 'Primera Futgal' : 'ECM Madrid'} • {t.roster.length} jugadores F11
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-valle-blue flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

