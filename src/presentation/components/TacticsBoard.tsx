import React, { useState } from 'react';
import { useGameStore } from '../../state/game-store';
import { Player, F11Formation } from '../../domain/types';
import { getAttributeModifier } from '../../domain/d20';
import { Shield, Sparkles, Award } from 'lucide-react';

export const TacticsBoard: React.FC = () => {
  const { database, userTeamId, updateUserTactics, swapPlayers, setActiveTab, startMatch } = useGameStore();
  const currentTeam = userTeamId ? database.teams[String(userTeamId)] : null;

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    currentTeam?.lineup[0] || null
  );

  if (!currentTeam) {
    return (
      <div className="p-8 text-center text-slate-500">
        No hay equipo seleccionado. Por favor, selecciona un club en la barra superior.
      </div>
    );
  }

  const starters = currentTeam.roster.filter((p) => currentTeam.lineup.includes(p.id));
  const bench = currentTeam.roster.filter((p) => !currentTeam.lineup.includes(p.id));
  const activePlayer: Player | undefined = currentTeam.roster.find((p) => p.id === selectedPlayerId) || starters[0];

  const formations: F11Formation[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2'];

  const getPositionCoords = (index: number, formation: F11Formation) => {
    // Coordenadas relativas en porcentaje (x, y) sobre campo vertical u horizontal
    // Formación 4-3-3 estándar para 11 jugadores
    if (formation === '4-3-3') {
      const coords = [
        { x: 50, y: 88, pos: 'GK' },
        { x: 15, y: 70, pos: 'LB' },
        { x: 38, y: 72, pos: 'CB' },
        { x: 62, y: 72, pos: 'CB' },
        { x: 85, y: 70, pos: 'RB' },
        { x: 50, y: 52, pos: 'CDM' },
        { x: 30, y: 42, pos: 'CM' },
        { x: 70, y: 42, pos: 'CAM' },
        { x: 18, y: 20, pos: 'LW' },
        { x: 50, y: 16, pos: 'ST' },
        { x: 82, y: 20, pos: 'RW' },
      ];
      return coords[index] || { x: 50, y: 50, pos: 'CM' };
    }

    // 4-4-2 fallback
    const coords442 = [
      { x: 50, y: 88, pos: 'GK' },
      { x: 15, y: 70, pos: 'LB' },
      { x: 38, y: 72, pos: 'CB' },
      { x: 62, y: 72, pos: 'CB' },
      { x: 85, y: 70, pos: 'RB' },
      { x: 15, y: 45, pos: 'LM' },
      { x: 38, y: 48, pos: 'CM' },
      { x: 62, y: 48, pos: 'CDM' },
      { x: 85, y: 45, pos: 'RM' },
      { x: 35, y: 18, pos: 'ST' },
      { x: 65, y: 18, pos: 'ST' },
    ];
    return coords442[index] || { x: 50, y: 50, pos: 'CM' };
  };

  const handlePlayerClick = (pId: string) => {
    if (selectedPlayerId && selectedPlayerId !== pId) {
      // Si ya hay un jugador seleccionado y se pulsa otro, se hace un swap de titular/suplente
      swapPlayers(selectedPlayerId, pId);
      setSelectedPlayerId(null);
    } else {
      setSelectedPlayerId(pId);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Cabecera del club y botones rápidos */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-wrap items-center justify-between gap-4 border-l-8 border-valle-blue">
        <div className="flex items-center gap-4">
          {currentTeam.badgeUrl ? (
            <img src={currentTeam.badgeUrl} alt={currentTeam.name} className="w-14 h-14 object-contain" />
          ) : (
            <Shield className="w-14 h-14 text-valle-blue" />
          )}
          <div>
            <h2 className="text-xl font-black text-slate-900">{currentTeam.name}</h2>
            <p className="text-xs text-slate-500 font-medium">
              Fútbol 11 • Formación {currentTeam.tactics.formation} • Mentalidad {currentTeam.tactics.mentality}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Buscar un rival de grupo
              const group = database.groups.find((g) => g.number === currentTeam.groupNumber);
              const rival = group?.teams.find((t) => t.id !== currentTeam.id) || database.groups[0].teams[1];
              startMatch(currentTeam.id, rival.id);
              setActiveTab('MATCH');
            }}
            className="bg-valle-yellow hover:bg-yellow-400 text-slate-900 font-black px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 border-2 border-valle-yellow-border text-sm"
          >
            <span>⚽</span> Jugar Partido Amistoso (Chapas)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Pizarra Táctica (Campo de Césped con Chapas) */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-md p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-green-600 rounded-full"></span>
              Alineación Titular F11 (Arrastra o pulsa dos jugadores para cambiarlos)
            </h3>

            {/* Selector de formación */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Táctica:</span>
              <select
                value={currentTeam.tactics.formation}
                onChange={(e) => updateUserTactics(e.target.value as F11Formation, null, null)}
                className="bg-slate-100 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800"
              >
                {formations.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Campo de Fútbol Césped */}
          <div className="relative w-full aspect-[4/5] bg-gradient-to-b from-pitch-dark to-pitch-light rounded-xl overflow-hidden shadow-inner border-4 border-slate-300">
            {/* Líneas del campo */}
            <div className="absolute inset-3 border-2 border-white/60 pointer-events-none rounded-sm"></div>
            {/* Círculo central */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border-2 border-white/60 rounded-full pointer-events-none"></div>
            {/* Línea de medio campo */}
            <div className="absolute top-1/2 left-3 right-3 h-0.5 bg-white/60 pointer-events-none"></div>
            {/* Áreas */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-44 h-20 border-2 border-t-0 border-white/60 pointer-events-none"></div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-44 h-20 border-2 border-b-0 border-white/60 pointer-events-none"></div>

            {/* Fichas de los 11 titulares */}
            {starters.map((player, idx) => {
              const coords = getPositionCoords(idx, currentTeam.tactics.formation);
              const isSelected = selectedPlayerId === player.id;

              return (
                <div
                  key={player.id}
                  onClick={() => handlePlayerClick(player.id)}
                  style={{ top: `${coords.y}%`, left: `${coords.x}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110 z-10 flex flex-col items-center group`}
                >
                  <div
                    className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center font-black text-xs transition-all border-2 ${
                      isSelected
                        ? 'bg-valle-yellow text-slate-900 border-white ring-4 ring-yellow-400 scale-110'
                        : 'bg-valle-blue text-white border-valle-yellow hover:border-white'
                    }`}
                  >
                    {player.number}
                  </div>
                  <div className="bg-slate-900/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow mt-1 whitespace-nowrap max-w-[80px] truncate">
                    {player.name.split(' ')[0]} ({player.position})
                  </div>
                </div>
              );
            })}
          </div>

          {/* Banquillo de Suplentes */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">
              Banquillo de Suplentes ({bench.length})
            </h4>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {bench.map((player) => {
                const isSelected = selectedPlayerId === player.id;
                return (
                  <button
                    key={player.id}
                    onClick={() => handlePlayerClick(player.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left min-w-[140px] transition-all flex-shrink-0 ${
                      isSelected
                        ? 'bg-yellow-50 border-valle-yellow ring-2 ring-valle-yellow'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {player.number}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{player.name}</div>
                      <div className="text-[10px] text-slate-500 font-semibold">{player.position}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Ficha de Rol D20 del Jugador Activo */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-md p-5 border border-slate-200 flex flex-col justify-between">
          {activePlayer ? (
            <div>
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-slate-900">{activePlayer.name}</span>
                    <span className="bg-valle-blue text-white text-xs px-2 py-0.5 rounded font-bold">
                      #{activePlayer.number} {activePlayer.position}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {starters.some((p) => p.id === activePlayer.id) ? '⭐ Titular' : 'Suplente'} • Moral +{activePlayer.morale} • Stamina {activePlayer.stamina}%
                  </p>
                </div>
                <div className="bg-yellow-100 text-yellow-800 p-2 rounded-lg font-black text-sm flex items-center gap-1">
                  <span>🎲</span> D20
                </div>
              </div>

              {/* Atributos Clásicos D20 */}
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Atributos & Modificadores D20
              </h4>
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                {[
                  { key: 'FUE', label: 'Fuerza', val: activePlayer.attributes.strength, desc: 'Disparos y cabeza' },
                  { key: 'DES', label: 'Destreza', val: activePlayer.attributes.dexterity, desc: 'Regate y velocidad' },
                  { key: 'CON', label: 'Constitución', val: activePlayer.attributes.constitution, desc: 'Resistencia a fatiga' },
                  { key: 'INT', label: 'Inteligencia', val: activePlayer.attributes.intelligence, desc: 'Visión y pase al hueco' },
                  { key: 'SAB', label: 'Sabiduría', val: activePlayer.attributes.wisdom, desc: 'Lectura y corte' },
                  { key: 'CAR', label: 'Carisma', val: activePlayer.attributes.charisma, desc: 'Liderazgo moral' },
                ].map((stat) => {
                  const mod = getAttributeModifier(stat.val);
                  const modFormatted = mod >= 0 ? `+${mod}` : `${mod}`;
                  return (
                    <div key={stat.key} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">{stat.key}</div>
                      <div className="text-lg font-black text-slate-900">{stat.val}</div>
                      <div className="text-xs font-extrabold text-valle-blue bg-blue-100 rounded py-0.5 mt-0.5">
                        {modFormatted}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-1 leading-tight">{stat.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Rasgos de Personalidad D20 */}
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-valle-yellow" />
                Rasgos Especiales de Rol
              </h4>
              <div className="space-y-2 mb-5">
                {activePlayer.traits.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Jugador estándar sin rasgos extravagantes.</p>
                ) : (
                  activePlayer.traits.map((trait) => (
                    <div key={trait} className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-600" />
                        {trait.replace(/_/g, ' ')}
                      </div>
                      <div className="text-slate-600 text-[11px] mt-0.5">
                        {trait === 'POACHER' && 'Cazagoles: Éxito crítico en tiros dentro del área con tirada 18-20.'}
                        {trait === 'AERIAL_TOWER' && 'Torre Aérea: Ventaja (tira 2d20 y elige el mayor) en remates de cabeza.'}
                        {trait === 'EXPLOSIVE_WINGER' && 'Extremo Explosivo: Ventaja en el desborde y centros por banda.'}
                        {trait === 'SET_PIECE_SPECIALIST' && 'Especialista a Balón Parado: +3 en faltas directas y saques de esquina.'}
                        {trait === 'DEFENSIVE_GENERAL' && 'Mariscal Defensivo: Concede +1 pasivo a la zaga defensiva.'}
                        {trait === 'COLD_BLOODED' && 'Sangre Fría: Inmune a desventajas por nervios en los últimos 15 minutos.'}
                        {trait === 'ANCHOR_TACKLER' && 'Pivote Destructor: +2 a las entradas físicas de contención.'}
                        {trait === 'DRIBBLE_WIZARD' && 'Mago del Regate: Ventaja constante en el 1vs1.'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Selecciona una ficha para inspeccionar sus atributos.</p>
          )}

          {/* Instrucciones de táctica */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
            <span className="font-bold">💡 Consejo Táctico:</span> Pulsa en cualquier chapa del campo y luego en un
            jugador del banquillo para intercambiarlos en tu once titular.
          </div>
        </div>
      </div>
    </div>
  );
};
