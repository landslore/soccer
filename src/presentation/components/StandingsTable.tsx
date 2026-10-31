import React from 'react';
import { useGameStore } from '../../state/game-store';
import { Trophy, Shield } from 'lucide-react';

export const StandingsTable: React.FC = () => {
  const { database, selectedGroupId, userTeamId, setSelectedGroup, setUserTeam, startMatch, setActiveTab } = useGameStore();

  const currentGroup = database.groups.find((g) => g.number === selectedGroupId) || database.groups[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="bg-white rounded-xl shadow-md p-5 border border-slate-200 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-valle-yellow rounded-lg text-slate-900">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">{currentGroup.name}</h2>
              <p className="text-xs text-slate-500">
                Clasificación de Fútbol 11 • {currentGroup.teams.length} Clubes
              </p>
            </div>
          </div>

          {/* Selector de Grupo */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Cambiar Grupo:</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroup(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-bold text-slate-800"
            >
              {database.groups.map((g) => (
                <option key={g.number} value={g.number}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla Clasificatoria */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-valle-blue text-white uppercase text-[11px] tracking-wider border-b-2 border-valle-yellow">
                <th className="py-2.5 px-3 text-center">Pos</th>
                <th className="py-2.5 px-3">Club</th>
                <th className="py-2.5 px-2 text-center font-black text-valle-yellow">PTS</th>
                <th className="py-2.5 px-2 text-center">PJ</th>
                <th className="py-2.5 px-2 text-center">PG</th>
                <th className="py-2.5 px-2 text-center">PE</th>
                <th className="py-2.5 px-2 text-center">PP</th>
                <th className="py-2.5 px-2 text-center">GF</th>
                <th className="py-2.5 px-2 text-center">GC</th>
                <th className="py-2.5 px-2 text-center">DIF</th>
                <th className="py-2.5 px-3 text-center">Forma</th>
                <th className="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {currentGroup.teams.map((team, idx) => {
                const isUserTeam = userTeamId === team.id;
                const pos = idx + 1;

                return (
                  <tr
                    key={team.id}
                    className={`transition-colors ${
                      isUserTeam
                        ? 'bg-blue-50 font-semibold border-l-4 border-valle-blue'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-bold">
                      <span
                        className={`inline-block w-6 h-6 leading-6 rounded-full text-xs font-black ${
                          pos === 1
                            ? 'bg-amber-400 text-slate-900 shadow-sm'
                            : pos <= 3
                            ? 'bg-slate-200 text-slate-800'
                            : 'text-slate-500'
                        }`}
                      >
                        {pos}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        {team.badgeUrl ? (
                          <img src={team.badgeUrl} alt={team.name} className="w-6 h-6 object-contain flex-shrink-0" />
                        ) : (
                          <Shield className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        )}
                        <span className="font-bold text-slate-900 truncate max-w-[220px]">
                          {team.name} {isUserTeam && <span className="text-[10px] text-valle-blue ml-1">(Tu Club)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center font-black text-slate-900 bg-amber-50/50">
                      {team.stats.points}
                    </td>
                    <td className="py-2.5 px-2 text-center">{team.stats.played}</td>
                    <td className="py-2.5 px-2 text-center text-emerald-700 font-semibold">{team.stats.won}</td>
                    <td className="py-2.5 px-2 text-center text-slate-500">{team.stats.drawn}</td>
                    <td className="py-2.5 px-2 text-center text-red-600 font-semibold">{team.stats.lost}</td>
                    <td className="py-2.5 px-2 text-center">{team.stats.goalsFor}</td>
                    <td className="py-2.5 px-2 text-center">{team.stats.goalsAgainst}</td>
                    <td className="py-2.5 px-2 text-center font-bold">
                      {team.stats.goalDiff > 0 ? `+${team.stats.goalDiff}` : team.stats.goalDiff}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {team.stats.form.split('').map((char, i) => (
                          <span
                            key={i}
                            className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center text-white ${
                              char === 'V'
                                ? 'bg-emerald-600'
                                : char === 'E'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {isUserTeam ? (
                        <span className="text-xs bg-blue-100 text-valle-blue px-2 py-1 rounded font-bold">
                          Tu Equipo
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setUserTeam(team.id)}
                            className="text-xs text-slate-500 hover:text-valle-blue underline"
                          >
                            Elegir
                          </button>
                          <button
                            onClick={() => {
                              if (userTeamId) {
                                startMatch(userTeamId, team.id);
                                setActiveTab('MATCH');
                              }
                            }}
                            className="bg-valle-blue hover:bg-blue-800 text-white text-xs px-2.5 py-1 rounded font-bold transition-all shadow-sm"
                          >
                            Jugar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

