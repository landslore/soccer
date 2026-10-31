import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../state/game-store';
import { Play, Pause, FastForward, RotateCcw, Dices, Award } from 'lucide-react';
import confetti from 'canvas-confetti';

export const ChapasBoard: React.FC = () => {
  const { currentMatch, stepMatch, simulateRestOfMatch, toggleAutoPlay, startMatch } = useGameStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Efecto para auto-play cada 400ms cuando está activo
  useEffect(() => {
    let interval: any = null;
    if (currentMatch?.isPlaying && !currentMatch.state.isFinished) {
      interval = setInterval(() => {
        stepMatch();
      }, 350);
    }
    return () => clearInterval(interval);
  }, [currentMatch?.isPlaying, currentMatch?.state.isFinished, stepMatch]);

  // Efecto para lanzar confeti al marcar gol
  useEffect(() => {
    if (currentMatch?.lastEvent?.type === 'GOAL') {
      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  }, [currentMatch?.lastEvent]);

  // Renderizado del Canvas 2D en Modo Chapas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentMatch) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Dibujar Césped con franjas alternas
    const numStripes = 10;
    const stripeHeight = height / numStripes;
    for (let i = 0; i < numStripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#2d8a4e' : '#247441';
      ctx.fillRect(0, i * stripeHeight, width, stripeHeight);
    }

    // 2. Dibujar Líneas Reglamentarias de Fútbol 11
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2.5;

    // Líneas perimetrales
    const pad = 24;
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

    // Línea de medio campo
    ctx.beginPath();
    ctx.moveTo(pad, height / 2);
    ctx.lineTo(width - pad * 2, height / 2);
    ctx.stroke();

    // Círculo central
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Área de penalti superior (Visitante)
    const boxW = 140;
    const boxH = 65;
    ctx.strokeRect((width - boxW) / 2, pad, boxW, boxH);
    ctx.beginPath();
    ctx.arc(width / 2, pad + 45, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Área de penalti inferior (Local)
    ctx.strokeRect((width - boxW) / 2, height - pad - boxH, boxW, boxH);
    ctx.beginPath();
    ctx.arc(width / 2, height - pad - 45, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Porterías
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(width / 2 - 35, pad - 8, 70, 8);
    ctx.strokeRect(width / 2 - 35, height - pad, 70, 8);

    // 3. Posicionar y Dibujar las 22 Chapas (11 Locales y 11 Visitantes)
    const homeTeam = currentMatch.homeTeam;
    const awayTeam = currentMatch.awayTeam;
    const ballZone = currentMatch.state.ballZone;

    // Factor de desplazamiento según zona de balón
    let zoneShift = 0;
    if (ballZone === 'ATTACKING_THIRD' || ballZone === 'OPPONENT_BOX') zoneShift = -25;
    if (ballZone === 'OWN_BOX' || ballZone === 'DEFENSIVE_HALF') zoneShift = 25;

    // Coordenadas fijas estándar 4-3-3 escaladas al canvas
    const homePositions = [
      { x: 0.5, y: 0.92 }, // GK
      { x: 0.15, y: 0.78 }, // LB
      { x: 0.38, y: 0.80 }, // CB
      { x: 0.62, y: 0.80 }, // CB
      { x: 0.85, y: 0.78 }, // RB
      { x: 0.5, y: 0.65 },  // CDM
      { x: 0.3, y: 0.56 },  // CM
      { x: 0.7, y: 0.56 },  // CAM
      { x: 0.18, y: 0.42 }, // LW
      { x: 0.5, y: 0.38 },  // ST
      { x: 0.82, y: 0.42 }, // RW
    ];

    const awayPositions = [
      { x: 0.5, y: 0.08 }, // GK
      { x: 0.85, y: 0.22 }, // LB
      { x: 0.62, y: 0.20 }, // CB
      { x: 0.38, y: 0.20 }, // CB
      { x: 0.15, y: 0.22 }, // RB
      { x: 0.5, y: 0.35 },  // CDM
      { x: 0.7, y: 0.44 },  // CM
      { x: 0.3, y: 0.44 },  // CAM
      { x: 0.82, y: 0.58 }, // LW
      { x: 0.5, y: 0.62 },  // ST
      { x: 0.18, y: 0.58 }, // RW
    ];

    // Función auxiliar para dibujar una chapa
    const drawChapa = (
      x: number,
      y: number,
      number: number,
      name: string,
      isHome: boolean,
      hasBall: boolean
    ) => {
      const radius = 14;

      // Sombra
      ctx.beginPath();
      ctx.arc(x + 2, y + 3, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fill();

      // Aro exterior (borde metálico de chapa)
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isHome ? '#004d99' : '#dc2626'; // Azul vs Rojo
      ctx.fill();
      ctx.strokeStyle = isHome ? '#fdd835' : '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Si tiene el balón, círculo de presión
      if (hasBall) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#fdd835';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Dorsal en el centro
      ctx.fillStyle = isHome ? '#ffffff' : '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number), x, y);

      // Nombre debajo
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText(name.slice(0, 7), x, y + radius + 8);
    };

    // Dibujar 11 Chapas Locales
    homePositions.forEach((pos, idx) => {
      const px = pos.x * width;
      const py = Math.min(height - pad - 12, Math.max(pad + 12, pos.y * height + zoneShift * 0.4));
      const p = homeTeam.roster[idx] || { number: idx + 1, name: 'Local' };
      const hasBall = currentMatch.state.possessionTeamId === homeTeam.id && idx === 9; // El delantero o poseedor
      drawChapa(px, py, p.number, p.name, true, hasBall);
    });

    // Dibujar 11 Chapas Visitantes
    awayPositions.forEach((pos, idx) => {
      const px = pos.x * width;
      const py = Math.min(height - pad - 12, Math.max(pad + 12, pos.y * height + zoneShift * 0.4));
      const p = awayTeam.roster[idx] || { number: idx + 1, name: 'Visit' };
      const hasBall = currentMatch.state.possessionTeamId === awayTeam.id && idx === 9;
      drawChapa(px, py, p.number, p.name, false, hasBall);
    });

    // 4. Dibujar Balón de Fútbol
    let ballX = width / 2;
    let ballY = height / 2;
    if (ballZone === 'OPPONENT_BOX') {
      ballY = currentMatch.state.possessionTeamId === homeTeam.id ? pad + 35 : height - pad - 35;
    } else if (ballZone === 'ATTACKING_THIRD') {
      ballY = currentMatch.state.possessionTeamId === homeTeam.id ? height * 0.3 : height * 0.7;
    } else if (ballZone === 'OWN_BOX') {
      ballY = currentMatch.state.possessionTeamId === homeTeam.id ? height - pad - 35 : pad + 35;
    }

    ctx.beginPath();
    ctx.arc(ballX + 1.5, ballY + 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ballX, ballY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [currentMatch]);

  if (!currentMatch) {
    return (
      <div className="max-w-4xl mx-auto my-12 p-8 bg-white rounded-xl shadow-md text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">No hay ningún partido en curso</h2>
        <p className="text-slate-500 text-sm mb-6">
          Ve a "Mi Equipo & Táctica" o a "Jornadas & Partidos" para iniciar un encuentro en modo chapas.
        </p>
      </div>
    );
  }

  const { homeTeam, awayTeam, state, lastEvent, isPlaying } = currentMatch;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Marcador Estilo Televisivo */}
      <div className="bg-slate-900 text-white rounded-xl shadow-xl overflow-hidden mb-6 border border-slate-700">
        <div className="p-4 flex flex-wrap items-center justify-between gap-4">
          {/* Equipo Local */}
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            {homeTeam.badgeUrl && (
              <img src={homeTeam.badgeUrl} alt={homeTeam.name} className="w-10 h-10 object-contain" />
            )}
            <div className="min-w-0">
              <div className="font-black text-sm md:text-base truncate">{homeTeam.name}</div>
              <div className="text-[11px] text-blue-300 font-bold uppercase">Local • Fútbol 11</div>
            </div>
          </div>

          {/* Marcador Central y Minuto */}
          <div className="flex flex-col items-center justify-center px-6 py-2 bg-slate-800 rounded-lg border border-slate-700">
            <div className="text-3xl md:text-4xl font-black tracking-widest text-valle-yellow flex items-center gap-3">
              <span>{state.score.home}</span>
              <span className="text-slate-500 text-2xl">-</span>
              <span>{state.score.away}</span>
            </div>
            <div className="text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {state.isFinished ? 'FINALIZADO' : `${state.currentMinute}' Minuto`}
            </div>
          </div>

          {/* Equipo Visitante */}
          <div className="flex items-center justify-end gap-3 flex-1 min-w-[200px] text-right">
            <div className="min-w-0">
              <div className="font-black text-sm md:text-base truncate">{awayTeam.name}</div>
              <div className="text-[11px] text-red-300 font-bold uppercase">Visitante • Fútbol 11</div>
            </div>
            {awayTeam.badgeUrl && (
              <img src={awayTeam.badgeUrl} alt={awayTeam.name} className="w-10 h-10 object-contain" />
            )}
          </div>
        </div>

        {/* Barra de Controles de Simulación */}
        <div className="bg-slate-800/80 px-4 py-2.5 border-t border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={stepMatch}
              disabled={state.isFinished || isPlaying}
              className="bg-valle-blue hover:bg-blue-700 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all shadow"
            >
              <Dices className="w-4 h-4 text-valle-yellow" />
              Tirada D20 (+1 Min)
            </button>

            <button
              onClick={toggleAutoPlay}
              disabled={state.isFinished}
              className={`font-bold px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all shadow ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Pausar' : 'Simular Auto'}
            </button>

            <button
              onClick={simulateRestOfMatch}
              disabled={state.isFinished}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 font-semibold px-3 py-1.5 rounded text-xs flex items-center gap-1.5"
            >
              <FastForward className="w-4 h-4" />
              Resultado Rápido
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => startMatch(homeTeam.id, awayTeam.id)}
              className="text-slate-400 hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar Partido
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Tablero de Fútbol 11 (Canvas de Chapas) */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-md p-4 border border-slate-200 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 text-xs font-bold text-slate-600">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-valle-blue border border-valle-yellow"></span>
              Chapas Azules: {homeTeam.name} (11)
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600 border border-white"></span>
              Chapas Rojas: {awayTeam.name} (11)
            </span>
          </div>

          <div className="relative w-full max-w-[560px] aspect-[9/13] shadow-lg rounded-xl overflow-hidden">
            <canvas
              ref={canvasRef}
              width={560}
              height={800}
              className="w-full h-full block cursor-crosshair"
            />
          </div>

          <p className="text-[11px] text-slate-400 mt-3 text-center">
            Modo Chapas F11 • Desplazamiento reactivo de fichas según zona de balón y tiradas d20
          </p>
        </div>

        {/* Columna Derecha: HUD de Tiradas D20 y Crónica en Vivo */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Widget de Tirada D20 Activa */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl shadow-md p-4 border border-slate-700">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-300 mb-3 flex items-center gap-2">
              <Dices className="w-4 h-4 text-valle-yellow" />
              Resolución D20 del Minuto {state.currentMinute}'
            </h3>

            {lastEvent?.contestedCheck ? (
              <div className="space-y-3">
                <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">Tirada Enfrentada:</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="text-center">
                      <div className="text-xs text-blue-300 font-bold">Atacante</div>
                      <div className="text-2xl font-black text-valle-yellow">
                        {lastEvent.contestedCheck.attacker.total}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        d20 ({lastEvent.contestedCheck.attacker.naturalRoll}) + {lastEvent.contestedCheck.attacker.modifier}
                      </div>
                    </div>

                    <div className="text-slate-500 font-bold text-sm">VS</div>

                    <div className="text-center">
                      <div className="text-xs text-red-300 font-bold">Defensor</div>
                      <div className="text-2xl font-black text-white">
                        {lastEvent.contestedCheck.defender.total}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        d20 ({lastEvent.contestedCheck.defender.naturalRoll}) + {lastEvent.contestedCheck.defender.modifier}
                      </div>
                    </div>
                  </div>

                  {/* Veredicto de la tirada */}
                  <div className="mt-3 pt-2 border-t border-slate-700 text-center">
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded uppercase ${
                        lastEvent.contestedCheck.attackerWon
                          ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500'
                          : 'bg-red-900/60 text-red-300 border border-red-500'
                      }`}
                    >
                      {lastEvent.contestedCheck.attackerWon ? '¡Éxito Atacante!' : '¡Robo / Parada Defensiva!'}
                    </span>
                  </div>
                </div>

                {lastEvent.diceCheck?.isCritical && (
                  <div className="bg-yellow-500/20 border border-yellow-400 text-yellow-300 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <span>¡NAT 20 CRÍTICO! Jugada de fantasía imparable.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 text-xs text-center py-4 italic">
                Pulsa en "Tirada D20" para ejecutar la siguiente jugada del partido.
              </div>
            )}
          </div>

          {/* Registro de Crónica / Jugadas del Partido */}
          <div className="bg-white rounded-xl shadow-md p-4 border border-slate-200 flex-1 flex flex-col max-h-[460px]">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
              <span>Crónica en Directo ({state.events.length})</span>
              <span className="text-[10px] text-slate-400">En tiempo real</span>
            </h3>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {[...state.events].reverse().map((ev, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg text-xs border ${
                    ev.type === 'GOAL'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                      : ev.type === 'HALF_TIME' || ev.type === 'FULL_TIME'
                      ? 'bg-slate-100 border-slate-300 text-slate-800 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-slate-900">{ev.minute}'</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{ev.type}</span>
                  </div>
                  <div className="text-[11px] leading-relaxed">{ev.commentary}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

