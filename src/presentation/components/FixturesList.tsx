import React, { useState } from 'react';
import { useGameStore } from '../../state/game-store';
import { Calendar, Play, MapPin, Clock } from 'lucide-react';
import { TeamBadge } from './TeamBadge';

export const FixturesList: React.FC = () => {
  const { database, selectedGroupId, startMatch, setActiveTab } = useGameStore();
  const currentGroup = database.groups.find((g) => g.number === selectedGroupId) || database.groups[0];

  // Identificar número de jornadas disponibles
  const rounds = Array.from(new Set(currentGroup.fixtures.map((f) => f.round))).sort((a, b) => a - b);
  const [selectedRound, setSelectedRound] = useState<number>(rounds[0] || 1);

  const fixturesInRound = currentGroup.fixtures.filter((f) => f.round === selectedRound);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="bg-white rounded-xl shadow-md p-5 border border-slate-200 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-valle-blue text-valle-yellow rounded-lg">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Jornadas & Calendario F11</h2>
              <p className="text-xs text-slate-500">
                {currentGroup.name} • Enfrentamientos y Resultados
              </p>
            </div>
          </div>

          {/* Selector de Jornada */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
            {rounds.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRound(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
                  selectedRound === r
                    ? 'bg-valle-blue text-valle-yellow shadow-md ring-2 ring-valle-yellow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Jornada {r}
              </button>
            ))}
          </div>
        </div>

        {/* Listado de Tarjetas de Partido */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fixturesInRound.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-slate-400 italic">
              No hay partidos programados en esta jornada.
            </div>
          ) : (
            fixturesInRound.map((fixture) => {
              const homeTeam = database.teams[String(fixture.homeTeamId)] || {
                name: `Equipo ${fixture.homeTeamId}`,
                badgeUrl: '',
              };
              const awayTeam = database.teams[String(fixture.awayTeamId)] || {
                name: `Equipo ${fixture.awayTeamId}`,
                badgeUrl: '',
              };

              return (
                <div
                  key={fixture.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow transition-shadow flex flex-col justify-between"
                >
                  {/* Detalles de fecha, hora y campo */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mb-3 border-b pb-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {fixture.dateText} {fixture.timeText && `• ${fixture.timeText}`}
                    </span>
                    <span className="flex items-center gap-1 text-slate-600 truncate max-w-[200px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      {fixture.field}
                    </span>
                  </div>

                  {/* Enfrentamiento de Equipos */}
                  <div className="flex items-center justify-between gap-3 my-2">
                    {/* Local */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <TeamBadge name={homeTeam.name} badgeUrl={homeTeam.badgeUrl} size="md" />
                      <span className="font-bold text-slate-900 text-sm truncate">{homeTeam.name}</span>
                    </div>

                    {/* Marcador o VS */}
                    <div className="px-3 py-1 bg-white rounded border border-slate-200 text-center font-black min-w-[60px]">
                      {fixture.played && fixture.homeGoals !== null && fixture.awayGoals !== null ? (
                        <span className="text-valle-blue text-sm">
                          {fixture.homeGoals} - {fixture.awayGoals}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">VS</span>
                      )}
                    </div>

                    {/* Visitante */}
                    <div className="flex items-center justify-end gap-2.5 flex-1 min-w-0 text-right">
                      <span className="font-bold text-slate-900 text-sm truncate">{awayTeam.name}</span>
                      <TeamBadge name={awayTeam.name} badgeUrl={awayTeam.badgeUrl} size="md" />
                    </div>
                  </div>

                  {/* Botón para Jugar */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200 flex justify-end">
                    <button
                      onClick={() => {
                        startMatch(fixture.homeTeamId, fixture.awayTeamId, fixture.id);
                        setActiveTab('MATCH');
                      }}
                      className="bg-valle-blue hover:bg-blue-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 text-valle-yellow" />
                      Jugar este Partido (Chapas)
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

