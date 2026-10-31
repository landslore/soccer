import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../state/game-store';
import { Play, Pause, FastForward, RotateCcw, Dices, Award } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ChapaEntity {
  id: string;
  name: string;
  number: number;
  position: string;
  isHome: boolean;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  radius: number;
  hasBall: boolean;
  isHighlight: boolean;
}

interface BallEntity {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  rotation: number;
  trail: { x: number; y: number }[];
}

export const ChapasBoard: React.FC = () => {
  const { currentMatch, stepMatch, simulateRestOfMatch, toggleAutoPlay, startMatch } = useGameStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const chapasRef = useRef<Record<string, ChapaEntity>>({});
  const ballRef = useRef<BallEntity>({
    x: 280,
    y: 400,
    targetX: 280,
    targetY: 400,
    vx: 0,
    vy: 0,
    rotation: 0,
    trail: [],
  });

  const [activeActionText, setActiveActionText] = useState<string>('');

  // 1. Inicializar las posiciones base de las 22 chapas según formación 4-3-3
  useEffect(() => {
    if (!currentMatch) return;
    const width = 560;
    const height = 800;

    const homePositions = [
      { x: 0.5, y: 0.90, pos: 'GK' },
      { x: 0.15, y: 0.76, pos: 'LB' },
      { x: 0.38, y: 0.78, pos: 'CB' },
      { x: 0.62, y: 0.78, pos: 'CB' },
      { x: 0.85, y: 0.76, pos: 'RB' },
      { x: 0.5, y: 0.64, pos: 'CDM' },
      { x: 0.3, y: 0.54, pos: 'CM' },
      { x: 0.7, y: 0.54, pos: 'CAM' },
      { x: 0.18, y: 0.38, pos: 'LW' },
      { x: 0.5, y: 0.34, pos: 'ST' },
      { x: 0.82, y: 0.38, pos: 'RW' },
    ];

    const awayPositions = [
      { x: 0.5, y: 0.10, pos: 'GK' },
      { x: 0.85, y: 0.24, pos: 'LB' },
      { x: 0.62, y: 0.22, pos: 'CB' },
      { x: 0.38, y: 0.22, pos: 'CB' },
      { x: 0.15, y: 0.24, pos: 'RB' },
      { x: 0.5, y: 0.36, pos: 'CDM' },
      { x: 0.7, y: 0.46, pos: 'CM' },
      { x: 0.3, y: 0.46, pos: 'CAM' },
      { x: 0.82, y: 0.62, pos: 'LW' },
      { x: 0.5, y: 0.66, pos: 'ST' },
      { x: 0.18, y: 0.62, pos: 'RW' },
    ];

    const map: Record<string, ChapaEntity> = {};

    // Titulares Locales
    currentMatch.homeTeam.lineup.forEach((pId, idx) => {
      const p = currentMatch.homeTeam.roster.find((item) => item.id === pId);
      const pos = homePositions[idx] || { x: 0.5, y: 0.5, pos: 'CM' };
      const px = pos.x * width;
      const py = pos.y * height;
      map[pId] = {
        id: pId,
        name: p?.name.split(' ')[0] || `L${idx + 1}`,
        number: p?.number || idx + 1,
        position: p?.position || pos.pos,
        isHome: true,
        x: px,
        y: py,
        baseX: px,
        baseY: py,
        targetX: px,
        targetY: py,
        vx: 0,
        vy: 0,
        radius: 15,
        hasBall: false,
        isHighlight: false,
      };
    });

    // Titulares Visitantes
    currentMatch.awayTeam.lineup.forEach((pId, idx) => {
      const p = currentMatch.awayTeam.roster.find((item) => item.id === pId);
      const pos = awayPositions[idx] || { x: 0.5, y: 0.5, pos: 'CM' };
      const px = pos.x * width;
      const py = pos.y * height;
      map[pId] = {
        id: pId,
        name: p?.name.split(' ')[0] || `V${idx + 1}`,
        number: p?.number || idx + 1,
        position: p?.position || pos.pos,
        isHome: false,
        x: px,
        y: py,
        baseX: px,
        baseY: py,
        targetX: px,
        targetY: py,
        vx: 0,
        vy: 0,
        radius: 15,
        hasBall: false,
        isHighlight: false,
      };
    });

    chapasRef.current = map;
  }, [currentMatch?.homeTeam.id, currentMatch?.awayTeam.id]);

  // 2. Animar físicamente la jugada cuando llega un nuevo evento
  useEffect(() => {
    const ev = currentMatch?.lastEvent;
    if (!ev) return;

    setActiveActionText(ev.commentary);

    const chapas = chapasRef.current;
    const ball = ballRef.current;
    const width = 560;
    const height = 800;

    // Resetear highlights
    Object.values(chapas).forEach((c) => {
      c.hasBall = false;
      c.isHighlight = false;
      // Regresar gradualmente hacia su posición táctica base
      c.targetX = c.baseX;
      c.targetY = c.baseY;
    });

    const primaryChapa = ev.primaryPlayer ? chapas[ev.primaryPlayer.id] : null;
    const secondaryChapa = ev.secondaryPlayer ? chapas[ev.secondaryPlayer.id] : null;
    const targetChapa = ev.targetPlayer ? chapas[ev.targetPlayer.id] : null;

    if (primaryChapa) {
      primaryChapa.isHighlight = true;
    }
    if (secondaryChapa) {
      secondaryChapa.isHighlight = true;
    }

    switch (ev.type) {
      case 'PASS_COMPLETED': {
        // Balón viaja desde el pasador al receptor
        if (primaryChapa && targetChapa) {
          primaryChapa.hasBall = true;
          // El pasador da un paso adelante para pasar
          primaryChapa.targetX = primaryChapa.baseX + (targetChapa.baseX - primaryChapa.baseX) * 0.15;
          primaryChapa.targetY = primaryChapa.baseY + (targetChapa.baseY - primaryChapa.baseY) * 0.15;

          // El defensor intenta meter el pie pero llega tarde
          if (secondaryChapa) {
            secondaryChapa.targetX = primaryChapa.baseX + (targetChapa.baseX - primaryChapa.baseX) * 0.5;
            secondaryChapa.targetY = primaryChapa.baseY + (targetChapa.baseY - primaryChapa.baseY) * 0.5;
          }

          // El receptor sale al encuentro del balón
          targetChapa.targetX = targetChapa.baseX - (targetChapa.baseX - primaryChapa.baseX) * 0.15;
          targetChapa.targetY = targetChapa.baseY - (targetChapa.baseY - primaryChapa.baseY) * 0.15;

          // El balón viaja hacia el receptor
          ball.targetX = targetChapa.targetX;
          ball.targetY = targetChapa.targetY;

          setTimeout(() => {
            targetChapa.hasBall = true;
            if (primaryChapa) primaryChapa.hasBall = false;
          }, 400);
        }
        break;
      }

      case 'PASS_INTERCEPTED': {
        // El defensor corta la línea de pase y se queda con el balón
        if (primaryChapa && secondaryChapa) {
          primaryChapa.hasBall = true;
          // Punto de intercepción en el trayecto
          const interceptX = (primaryChapa.baseX + secondaryChapa.baseX) / 2;
          const interceptY = (primaryChapa.baseY + secondaryChapa.baseY) / 2;

          // La chapa defensora se abalanza hacia la trayectoria
          secondaryChapa.targetX = interceptX;
          secondaryChapa.targetY = interceptY;

          // El balón viaja hacia el corte del defensor
          ball.targetX = interceptX;
          ball.targetY = interceptY;

          setTimeout(() => {
            secondaryChapa.hasBall = true;
            if (primaryChapa) primaryChapa.hasBall = false;
          }, 350);
        }
        break;
      }

      case 'DRIBBLE_SUCCESS': {
        // El regateador avanza superando al defensor
        if (primaryChapa && secondaryChapa) {
          primaryChapa.hasBall = true;
          // El regateador hace una finta lateral y avanza hacia portería rival
          const forwardDir = primaryChapa.isHome ? -65 : 65;
          primaryChapa.targetX = primaryChapa.baseX + 25;
          primaryChapa.targetY = primaryChapa.baseY + forwardDir;

          // El defensor queda atrás desbordado
          secondaryChapa.targetX = secondaryChapa.baseX - 15;
          secondaryChapa.targetY = secondaryChapa.baseY - forwardDir * 0.2;

          ball.targetX = primaryChapa.targetX;
          ball.targetY = primaryChapa.targetY;
        }
        break;
      }

      case 'DRIBBLE_TACKLED': {
        // Choque físico / tackle: el defensor le quita el balón
        if (primaryChapa && secondaryChapa) {
          primaryChapa.hasBall = true;
          // Ambos convergen en el choque
          const tackleX = (primaryChapa.baseX + secondaryChapa.baseX) / 2;
          const tackleY = (primaryChapa.baseY + secondaryChapa.baseY) / 2;

          primaryChapa.targetX = tackleX - 10;
          primaryChapa.targetY = tackleY;
          secondaryChapa.targetX = tackleX + 10;
          secondaryChapa.targetY = tackleY;

          ball.targetX = tackleX;
          ball.targetY = tackleY;

          setTimeout(() => {
            secondaryChapa.hasBall = true;
            if (primaryChapa) primaryChapa.hasBall = false;
          }, 300);
        }
        break;
      }

      case 'GOAL': {
        // Disparo potente a portería y entrada a la red
        if (primaryChapa) {
          primaryChapa.hasBall = true;
          const targetGoalY = primaryChapa.isHome ? 22 : height - 22; // Dentro de la portería rival
          const targetGoalX = width / 2 + (Math.random() * 40 - 20); // Ajustado a la escuadra/poste

          primaryChapa.targetY += primaryChapa.isHome ? -35 : 35;

          // El portero se tira pero no llega
          if (secondaryChapa) {
            secondaryChapa.targetX = width / 2 + (Math.random() > 0.5 ? 25 : -25);
            secondaryChapa.targetY = secondaryChapa.baseY;
          }

          ball.targetX = targetGoalX;
          ball.targetY = targetGoalY;

          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: primaryChapa.isHome ? 0.3 : 0.7 },
          });
        }
        break;
      }

      case 'SHOT_SAVED': {
        // Disparo y parada del portero
        if (primaryChapa && secondaryChapa) {
          primaryChapa.hasBall = true;
          const diveGoalX = width / 2 + (Math.random() * 30 - 15);
          const diveGoalY = secondaryChapa.baseY;

          // El portero vuela hacia el balón y lo bloquea
          secondaryChapa.targetX = diveGoalX;
          secondaryChapa.targetY = diveGoalY;

          ball.targetX = diveGoalX;
          ball.targetY = diveGoalY;

          setTimeout(() => {
            secondaryChapa.hasBall = true;
            if (primaryChapa) primaryChapa.hasBall = false;
          }, 350);
        }
        break;
      }

      default:
        break;
    }
  }, [currentMatch?.lastEvent]);

  // 3. Loop de Física y Renderizado con requestAnimationFrame (60 FPS)
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const pad = 24;

      // Actualizar física suave de las chapas (Interpolación / Lerp)
      const chapas = chapasRef.current;
      const ball = ballRef.current;

      Object.values(chapas).forEach((c) => {
        // Interpolación hacia su posición objetivo con fricción suave
        c.x += (c.targetX - c.x) * 0.12;
        c.y += (c.targetY - c.y) * 0.12;
      });

      // Actualizar física del balón
      ball.x += (ball.targetX - ball.x) * 0.16;
      ball.y += (ball.targetY - ball.y) * 0.16;
      ball.rotation += 0.15;

      // Registrar estela del balón
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 7) ball.trail.shift();

      // --- DIBUJADO DE LA ESCENA ---

      // 1. Césped con franjas
      const numStripes = 10;
      const stripeHeight = height / numStripes;
      for (let i = 0; i < numStripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#2d8a4e' : '#247441';
        ctx.fillRect(0, i * stripeHeight, width, stripeHeight);
      }

      // 2. Líneas Reglamentarias F11
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 2.5;

      // Perímetro
      ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

      // Medio campo
      ctx.beginPath();
      ctx.moveTo(pad, height / 2);
      ctx.lineTo(width - pad * 2, height / 2);
      ctx.stroke();

      // Círculo central
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 45, 0, Math.PI * 2);
      ctx.stroke();

      // Punto central
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Áreas de penalti
      const boxW = 150;
      const boxH = 70;
      ctx.strokeRect((width - boxW) / 2, pad, boxW, boxH);
      ctx.strokeRect((width - boxW) / 2, height - pad - boxH, boxW, boxH);

      // Porterías con red en cuadrícula
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(width / 2 - 38, pad - 12, 76, 12);
      ctx.strokeRect(width / 2 - 38, height - pad, 76, 12);

      // Dibujar red de portería
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      for (let rx = width / 2 - 34; rx < width / 2 + 38; rx += 8) {
        ctx.beginPath();
        ctx.moveTo(rx, pad - 12);
        ctx.lineTo(rx, pad);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rx, height - pad);
        ctx.lineTo(rx, height - pad + 12);
        ctx.stroke();
      }

      // 3. Dibujar trayectoria activa del balón (vector de pase/tiro)
      if (Math.hypot(ball.targetX - ball.x, ball.targetY - ball.y) > 8) {
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ball.targetX, ball.targetY);
        ctx.strokeStyle = 'rgba(253, 216, 53, 0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 4. Dibujar estela del balón
      ball.trail.forEach((t, idx) => {
        const alpha = (idx / ball.trail.length) * 0.35;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      });

      // 5. Dibujar las 22 Chapas
      Object.values(chapas).forEach((c) => {
        // Sombra física de la chapa
        ctx.beginPath();
        ctx.arc(c.x + 2.5, c.y + 3.5, c.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();

        // Si es el jugador activo en la jugada, dibujar aureola de foco
        if (c.isHighlight) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.radius + 7, 0, Math.PI * 2);
          ctx.strokeStyle = '#fdd835';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // Si tiene el balón, círculo de control punteado
        if (c.hasBall) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.radius + 10, 0, Math.PI * 2);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Cuerpo metálico de la chapa
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
        ctx.fillStyle = c.isHome ? '#004d99' : '#dc2626'; // Azul vs Rojo
        ctx.fill();

        // Borde dorado o blanco de la chapa
        ctx.strokeStyle = c.isHome ? '#fdd835' : '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Dorsal en el centro
        ctx.fillStyle = '#ffffff';
        ctx.font = 'black 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(c.number), c.x, c.y);

        // Nombre y posición debajo
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(`${c.name} (${c.position})`, c.x, c.y + c.radius + 8);
      });

      // 6. Dibujar el Balón de Fútbol
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.rotation);

      // Sombra del balón
      ctx.beginPath();
      ctx.arc(1.5, 2, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      // Esfera blanca del balón
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Dibujo de pentágonos en el balón
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 4. Auto-Play Timer
  useEffect(() => {
    let interval: any = null;
    if (currentMatch?.isPlaying && !currentMatch.state.isFinished) {
      interval = setInterval(() => {
        stepMatch();
      }, 700); // 700ms entre turnos para que dé tiempo a disfrutar de la cinemática
    }
    return () => clearInterval(interval);
  }, [currentMatch?.isPlaying, currentMatch?.state.isFinished, stepMatch]);

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
      {/* Marcador Superior Estilo Televisivo */}
      <div className="bg-slate-900 text-white rounded-xl shadow-xl overflow-hidden mb-6 border border-slate-700">
        <div className="p-4 flex flex-wrap items-center justify-between gap-4">
          {/* Local */}
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            {homeTeam.badgeUrl && (
              <img src={homeTeam.badgeUrl} alt={homeTeam.name} className="w-11 h-11 object-contain" />
            )}
            <div className="min-w-0">
              <div className="font-black text-sm md:text-base truncate">{homeTeam.name}</div>
              <div className="text-[11px] text-blue-300 font-bold uppercase">Local • Chapas Azules</div>
            </div>
          </div>

          {/* Marcador & Minuto */}
          <div className="flex flex-col items-center justify-center px-6 py-2 bg-slate-800 rounded-lg border border-slate-700 shadow-inner">
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

          {/* Visitante */}
          <div className="flex items-center justify-end gap-3 flex-1 min-w-[200px] text-right">
            <div className="min-w-0">
              <div className="font-black text-sm md:text-base truncate">{awayTeam.name}</div>
              <div className="text-[11px] text-red-300 font-bold uppercase">Visitante • Chapas Rojas</div>
            </div>
            {awayTeam.badgeUrl && (
              <img src={awayTeam.badgeUrl} alt={awayTeam.name} className="w-11 h-11 object-contain" />
            )}
          </div>
        </div>

        {/* Panel de Controles */}
        <div className="bg-slate-800/90 px-4 py-2.5 border-t border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={stepMatch}
              disabled={state.isFinished || isPlaying}
              className="bg-valle-blue hover:bg-blue-700 disabled:opacity-40 text-white font-bold px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow"
            >
              <Dices className="w-4 h-4 text-valle-yellow" />
              Tirada D20 (+1 Min Jugada)
            </button>

            <button
              onClick={toggleAutoPlay}
              disabled={state.isFinished}
              className={`font-bold px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Pausar Simulación' : 'Simulación Continua'}
            </button>

            <button
              onClick={simulateRestOfMatch}
              disabled={state.isFinished}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 font-semibold px-3 py-2 rounded text-xs flex items-center gap-1.5"
            >
              <FastForward className="w-4 h-4" />
              Simular hasta el Final
            </button>
          </div>

          <button
            onClick={() => startMatch(homeTeam.id, awayTeam.id)}
            className="text-slate-400 hover:text-white flex items-center gap-1 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reiniciar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Tablero Canvas 2D con Física Activa */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-md p-4 border border-slate-200 flex flex-col items-center">
          {/* Banner de Jugada Activa sobre el césped */}
          <div className="w-full bg-slate-900 text-valle-yellow font-bold text-xs px-3 py-2 rounded-lg mb-3 flex items-center justify-between border border-slate-700">
            <span className="flex items-center gap-2 truncate">
              <span>⚡</span>
              <span className="truncate">{activeActionText || 'Listo para el saque inicial. ¡Lanza el dado!'}</span>
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono flex-shrink-0">
              Zona: {state.ballZone}
            </span>
          </div>

          <div className="relative w-full max-w-[560px] aspect-[9/13] shadow-2xl rounded-xl overflow-hidden border-4 border-slate-400">
            <canvas
              ref={canvasRef}
              width={560}
              height={800}
              className="w-full h-full block cursor-pointer"
            />
          </div>

          <p className="text-[11px] text-slate-400 mt-3 text-center">
            ⚽ Física 2D de Chapas: Cada chapa se desplaza al corte, intercepta o recibe el balón según el resultado de los dados D20.
          </p>
        </div>

        {/* Columna Derecha: HUD de Tiradas D20 y Crónica */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Widget de Tirada D20 */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl shadow-md p-4 border border-slate-700">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-300 mb-3 flex items-center gap-2">
              <Dices className="w-4 h-4 text-valle-yellow" />
              Tirada D20 del Minuto {state.currentMinute}'
            </h3>

            {lastEvent?.contestedCheck ? (
              <div className="space-y-3">
                <div className="bg-slate-800/90 rounded-lg p-3 border border-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">Tirada Enfrentada de Rol:</div>
                  <div className="flex items-center justify-between mt-2">
                    {/* Atacante */}
                    <div className="text-center">
                      <div className="text-xs text-blue-300 font-bold truncate max-w-[100px]">
                        {lastEvent.primaryPlayer?.name || 'Atacante'}
                      </div>
                      <div className="text-3xl font-black text-valle-yellow">
                        {lastEvent.contestedCheck.attacker.total}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        d20 ({lastEvent.contestedCheck.attacker.naturalRoll}) + {lastEvent.contestedCheck.attacker.modifier}
                      </div>
                    </div>

                    <div className="text-slate-500 font-black text-sm">VS</div>

                    {/* Defensor */}
                    <div className="text-center">
                      <div className="text-xs text-red-300 font-bold truncate max-w-[100px]">
                        {lastEvent.secondaryPlayer?.name || 'Defensor'}
                      </div>
                      <div className="text-3xl font-black text-white">
                        {lastEvent.contestedCheck.defender.total}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        d20 ({lastEvent.contestedCheck.defender.naturalRoll}) + {lastEvent.contestedCheck.defender.modifier}
                      </div>
                    </div>
                  </div>

                  {/* Resultado */}
                  <div className="mt-3 pt-2.5 border-t border-slate-700 text-center">
                    <span
                      className={`text-xs font-black px-3 py-1 rounded uppercase tracking-wider ${
                        lastEvent.contestedCheck.attackerWon
                          ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-500'
                          : 'bg-red-900/80 text-red-300 border border-red-500'
                      }`}
                    >
                      {lastEvent.contestedCheck.attackerWon ? '¡Éxito Atacante!' : '¡Robo / Corte Defensivo!'}
                    </span>
                  </div>
                </div>

                {lastEvent.diceCheck?.isCritical && (
                  <div className="bg-yellow-500/20 border border-yellow-400 text-yellow-300 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2 animate-bounce">
                    <Award className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <span>¡NAT 20 CRÍTICO! Jugada de antología.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 text-xs text-center py-4 italic">
                Pulsa en "Tirada D20" para ejecutar y animar la siguiente jugada.
              </div>
            )}
          </div>

          {/* Crónica en Vivo */}
          <div className="bg-white rounded-xl shadow-md p-4 border border-slate-200 flex-1 flex flex-col max-h-[460px]">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
              <span>Crónica de Jugadas ({state.events.length})</span>
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                En directo
              </span>
            </h3>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {[...state.events].reverse().map((ev, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg text-xs border transition-all ${
                    ev.type === 'GOAL'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold ring-1 ring-emerald-400'
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
