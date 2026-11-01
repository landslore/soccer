import React, { useEffect, useRef, useState } from 'react';
import { useGameStore, ChapaSnapshot } from '../../state/game-store';
import { Play, Pause, FastForward, RotateCcw, Dices, Award, Sparkles, Brain, History } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DecisionDebugger } from './DecisionDebugger';
import { MatchAuditNavigator } from './MatchAuditNavigator';

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
  runCycle: number;
  radius: number;
  hasBall: boolean;
  isHighlight: boolean;
  isMakingRun: boolean;
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
  const { 
    currentMatch, 
    stepMatch, 
    simulateRestOfMatch, 
    toggleAutoPlay, 
    startMatch,
    setBoardSnapshotForStep 
  } = useGameStore();
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
  const [showDebugger, setShowDebugger] = useState<boolean>(true);

  const inspectingIndex = currentMatch?.inspectingStepIndex;
  const isAuditing = inspectingIndex !== null && inspectingIndex !== undefined;
  const activeStep = isAuditing && currentMatch ? currentMatch.auditTrail[inspectingIndex] : null;

  const displayedEvent = isAuditing ? activeStep?.event : currentMatch?.lastEvent;
  const displayedMinute = isAuditing ? activeStep?.minute ?? 0 : currentMatch?.state.currentMinute ?? 0;
  const displayedScore = isAuditing ? activeStep?.score ?? { home: 0, away: 0 } : currentMatch?.state.score ?? { home: 0, away: 0 };
  const displayedZone = isAuditing ? activeStep?.ballZone ?? 'MIDFIELD' : currentMatch?.state.ballZone ?? 'MIDFIELD';

  // 1. Inicializar las 22 chapas según formación 4-3-3 reglamentaria
  useEffect(() => {
    if (!currentMatch) return;
    const width = 560;
    const height = 800;

    // Posiciones reglamentarias F11 4-3-3: Cada equipo estrictamente en su mitad de campo (Regla 8 IFAB)
    // Local (Home): Mitad inferior (y >= 0.50), defiende portería sur y ataca portería norte
    const homePositions = [
      { x: 0.50, y: 0.92, pos: 'GK' },
      { x: 0.16, y: 0.81, pos: 'LB' },
      { x: 0.38, y: 0.82, pos: 'CB' },
      { x: 0.62, y: 0.82, pos: 'CB' },
      { x: 0.84, y: 0.81, pos: 'RB' },
      { x: 0.50, y: 0.70, pos: 'CDM' },
      { x: 0.30, y: 0.61, pos: 'CM' },
      { x: 0.70, y: 0.61, pos: 'CAM' },
      { x: 0.20, y: 0.53, pos: 'LW' },
      { x: 0.50, y: 0.51, pos: 'ST' },
      { x: 0.80, y: 0.53, pos: 'RW' },
    ];

    // Visitante (Away): Mitad superior (y <= 0.50), defiende portería norte y ataca portería sur
    const awayPositions = [
      { x: 0.50, y: 0.08, pos: 'GK' },
      { x: 0.84, y: 0.19, pos: 'LB' },
      { x: 0.62, y: 0.18, pos: 'CB' },
      { x: 0.38, y: 0.18, pos: 'CB' },
      { x: 0.16, y: 0.19, pos: 'RB' },
      { x: 0.50, y: 0.30, pos: 'CDM' },
      { x: 0.70, y: 0.39, pos: 'CM' },
      { x: 0.30, y: 0.39, pos: 'CAM' },
      { x: 0.80, y: 0.47, pos: 'LW' },
      { x: 0.50, y: 0.49, pos: 'ST' },
      { x: 0.20, y: 0.47, pos: 'RW' },
    ];

    const map: Record<string, ChapaEntity> = {};

    // Locales
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
        runCycle: Math.random() * Math.PI,
        radius: 15,
        hasBall: false,
        isHighlight: false,
        isMakingRun: false,
      };
    });

    // Visitantes
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
        runCycle: Math.random() * Math.PI,
        radius: 15,
        hasBall: false,
        isHighlight: false,
        isMakingRun: false,
      };
    });

    chapasRef.current = map;
  }, [currentMatch?.homeTeam.id, currentMatch?.awayTeam.id]);

  // 2. Animar físicamente la jugada y coordinar el movimiento colectivo
  useEffect(() => {
    const ev = currentMatch?.lastEvent;
    if (!ev) return;

    setActiveActionText(ev.commentary);

    const chapas = chapasRef.current;
    const ball = ballRef.current;
    const width = 560;
    const height = 800;

    const isHomeAttacking = ev.attackingTeamId === currentMatch?.homeTeam.id;
    const lateralShift = Math.random() > 0.5 ? 18 : -18;

    const primaryChapa = ev.primaryPlayer ? chapas[ev.primaryPlayer.id] : null;
    const secondaryChapa = ev.secondaryPlayer ? chapas[ev.secondaryPlayer.id] : null;
    const targetChapa = ev.targetPlayer ? chapas[ev.targetPlayer.id] : null;

    if (primaryChapa) primaryChapa.isHighlight = true;
    if (secondaryChapa) secondaryChapa.isHighlight = true;

    // Actualizar objetivos tácticos manteniendo formación
    Object.values(chapas).forEach((c) => {
      c.hasBall = false;
      c.isHighlight = false;
      c.isMakingRun = false;

      // REGLA ESTRICTA DE PORTERO: Guardar su arco
      if (c.position === 'GK') {
        c.targetX = width / 2 + lateralShift * 0.25;
        c.targetY = c.baseY;
        return;
      }

      const isAttacker = c.isHome === isHomeAttacking;

      if (isAttacker) {
        let targetForwardY = c.baseY;

        if (ev.zone === 'OPPONENT_BOX') {
          // Asedio en el área rival: Delantero dentro de la zona de castigo, mediapuntas en la frontal
          if (c.isHome) {
            // Local ataca hacia la portería norte (y decrece hacia 0)
            if (c.position === 'ST') {
              targetForwardY = 135;
            } else if (c.position === 'LW' || c.position === 'RW') {
              targetForwardY = 155;
            } else if (c.position === 'CAM' || c.position === 'CM') {
              targetForwardY = 230;
            } else if (c.position === 'CDM') {
              targetForwardY = 350;
            } else {
              targetForwardY = 440;
            }
          } else {
            // Visitante ataca hacia la portería sur (y crece hacia height)
            if (c.position === 'ST') {
              targetForwardY = height - 135;
            } else if (c.position === 'LW' || c.position === 'RW') {
              targetForwardY = height - 155;
            } else if (c.position === 'CAM' || c.position === 'CM') {
              targetForwardY = height - 230;
            } else if (c.position === 'CDM') {
              targetForwardY = height - 350;
            } else {
              targetForwardY = height - 440;
            }
          }
        } else if (ev.zone === 'ATTACKING_THIRD') {
          // Tres cuartos de campo: bloque adelantado
          if (c.isHome) {
            if (c.position === 'ST') {
              targetForwardY = 180;
            } else if (c.position === 'LW' || c.position === 'RW') {
              targetForwardY = 200;
            } else if (c.position === 'CAM' || c.position === 'CM') {
              targetForwardY = 270;
            } else if (c.position === 'CDM') {
              targetForwardY = 380;
            } else {
              targetForwardY = 470;
            }
          } else {
            if (c.position === 'ST') {
              targetForwardY = height - 180;
            } else if (c.position === 'LW' || c.position === 'RW') {
              targetForwardY = height - 200;
            } else if (c.position === 'CAM' || c.position === 'CM') {
              targetForwardY = height - 270;
            } else if (c.position === 'CDM') {
              targetForwardY = height - 380;
            } else {
              targetForwardY = height - 470;
            }
          }
        } else if (ev.zone === 'MIDFIELD') {
          // Fase equilibrada en el círculo central
          if (c.isHome) {
            targetForwardY = Math.max(height * 0.44, c.baseY - 35);
          } else {
            targetForwardY = Math.min(height * 0.56, c.baseY + 35);
          }
        } else if (ev.zone === 'DEFENSIVE_HALF' || ev.zone === 'OWN_BOX') {
          // Construcción desde atrás: mantienen bases tácticas en su propio campo
          targetForwardY = c.baseY;
        }

        c.targetY = Math.max(80, Math.min(height - 80, targetForwardY));
        c.targetX = Math.max(40, Math.min(width - 40, c.baseX + lateralShift * 0.3));
      } else {
        // Bloque defensivo y basculación reglamentaria
        let targetDefendY = c.baseY;
        if (ev.zone === 'OPPONENT_BOX') {
          // El rival está dentro del área propia: repliegue intensivo
          if (c.isHome) {
            // Local defiende su portería sur (y = height)
            if (c.position === 'CB' || c.position === 'LB' || c.position === 'RB') {
              targetDefendY = height - 130;
            } else if (c.position === 'CDM' || c.position === 'CM') {
              targetDefendY = height - 210;
            } else if (c.position === 'CAM') {
              targetDefendY = height - 260;
            } else {
              targetDefendY = height - 360;
            }
          } else {
            // Visitante defiende su portería norte (y = 0)
            if (c.position === 'CB' || c.position === 'LB' || c.position === 'RB') {
              targetDefendY = 130;
            } else if (c.position === 'CDM' || c.position === 'CM') {
              targetDefendY = 210;
            } else if (c.position === 'CAM') {
              targetDefendY = 260;
            } else {
              targetDefendY = 360;
            }
          }
        } else if (ev.zone === 'ATTACKING_THIRD') {
          // El rival está en tres cuartos
          if (c.isHome) {
            if (c.position === 'CB' || c.position === 'LB' || c.position === 'RB') {
              targetDefendY = height - 165;
            } else if (c.position === 'CDM' || c.position === 'CM') {
              targetDefendY = height - 250;
            } else if (c.position === 'CAM') {
              targetDefendY = height - 310;
            } else {
              targetDefendY = height - 400;
            }
          } else {
            if (c.position === 'CB' || c.position === 'LB' || c.position === 'RB') {
              targetDefendY = 165;
            } else if (c.position === 'CDM' || c.position === 'CM') {
              targetDefendY = 250;
            } else if (c.position === 'CAM') {
              targetDefendY = 310;
            } else {
              targetDefendY = 400;
            }
          }
        } else if (ev.zone === 'MIDFIELD') {
          targetDefendY = c.baseY;
        } else if (ev.zone === 'DEFENSIVE_HALF' || ev.zone === 'OWN_BOX') {
          // Presión alta adelantada sobre la salida rival
          if (c.isHome) {
            if (c.position === 'ST' || c.position === 'LW' || c.position === 'RW') {
              targetDefendY = Math.max(height * 0.34, c.baseY - 110);
            } else if (c.position === 'CAM' || c.position === 'CM') {
              targetDefendY = Math.max(height * 0.46, c.baseY - 70);
            } else {
              targetDefendY = c.baseY - 30;
            }
          } else {
            if (c.position === 'ST' || c.position === 'LW' || c.position === 'RW') {
              targetDefendY = Math.min(height * 0.66, c.baseY + 110);
            } else if (c.position === 'CAM' || c.position === 'CM') {
              targetDefendY = Math.min(height * 0.54, c.baseY + 70);
            } else {
              targetDefendY = c.baseY + 30;
            }
          }
        }

        c.targetY = Math.max(80, Math.min(height - 80, targetDefendY));
        c.targetX = Math.max(45, Math.min(width - 45, c.baseX + lateralShift * 0.4));
      }
    });

    // Desmarque activo y colocación del receptor
    if (targetChapa && targetChapa.position !== 'GK') {
      targetChapa.isMakingRun = true;
      if (ev.zone === 'OPPONENT_BOX') {
        targetChapa.targetY = targetChapa.isHome ? 135 : height - 135;
        targetChapa.targetX = width / 2 + (Math.random() * 24 - 12);
      } else if (ev.zone === 'ATTACKING_THIRD') {
        targetChapa.targetY = targetChapa.isHome ? 175 : height - 175;
        targetChapa.targetX = width / 2 + (Math.random() * 30 - 15);
      } else {
        const forwardStep = targetChapa.isHome ? -35 : 35;
        targetChapa.targetY = Math.max(100, Math.min(height - 100, targetChapa.baseY + forwardStep));
        targetChapa.targetX = Math.max(40, Math.min(width - 40, targetChapa.x + lateralShift * 0.5));
      }
    }

    switch (ev.type) {
      case 'KICK_OFF':
      case 'HALF_TIME': {
        ball.targetX = width / 2;
        ball.targetY = height / 2;
        Object.values(chapas).forEach((c) => {
          c.targetX = c.baseX;
          c.targetY = c.baseY;
          c.hasBall = false;
        });
        const kickStriker = Object.values(chapas).find(
          (c) => c.isHome === isHomeAttacking && c.position === 'ST'
        );
        if (kickStriker) {
          kickStriker.targetX = width / 2;
          kickStriker.targetY = isHomeAttacking ? height / 2 + 12 : height / 2 - 12;
          kickStriker.hasBall = true;
        }
        break;
      }

      case 'PASS_COMPLETED': {
        if (primaryChapa && targetChapa) {
          primaryChapa.hasBall = true;
          primaryChapa.targetX = primaryChapa.x + (targetChapa.targetX - primaryChapa.x) * 0.12;
          primaryChapa.targetY = primaryChapa.y + (targetChapa.targetY - primaryChapa.y) * 0.12;

          // El defensor no se superpone: se coloca en la línea de marcaje con separación
          if (secondaryChapa && secondaryChapa.position !== 'GK') {
            const guardOffset = secondaryChapa.isHome ? 28 : -28;
            secondaryChapa.targetX = (primaryChapa.targetX + targetChapa.targetX) * 0.5 + 18;
            secondaryChapa.targetY = (primaryChapa.targetY + targetChapa.targetY) * 0.5 + guardOffset;
          }

          ball.targetX = targetChapa.targetX;
          ball.targetY = targetChapa.targetY;

          setTimeout(() => {
            targetChapa.hasBall = true;
            if (primaryChapa) primaryChapa.hasBall = false;
          }, 450);
        }
        break;
      }

      case 'PASS_INTERCEPTED': {
        if (primaryChapa && secondaryChapa) {
          primaryChapa.hasBall = true;
          if (secondaryChapa.position !== 'GK') {
            // El corte ocurre a distancia prudencial
            const cutX = (primaryChapa.x + (targetChapa ? targetChapa.x : secondaryChapa.x)) / 2;
            const cutY = (primaryChapa.y + (targetChapa ? targetChapa.y : secondaryChapa.y)) / 2;

            secondaryChapa.targetX = cutX;
            secondaryChapa.targetY = cutY;

            ball.targetX = cutX;
            ball.targetY = cutY;

            setTimeout(() => {
              secondaryChapa.hasBall = true;
              if (primaryChapa) primaryChapa.hasBall = false;
            }, 350);
          }
        }
        break;
      }

      case 'DRIBBLE_SUCCESS': {
        if (primaryChapa && secondaryChapa) {
          primaryChapa.hasBall = true;
          const forwardDir = primaryChapa.isHome ? -65 : 65;
          primaryChapa.targetX = primaryChapa.x + 28;
          primaryChapa.targetY = primaryChapa.y + forwardDir;

          // Defensor queda desbordado sin superponerse
          if (secondaryChapa.position !== 'GK') {
            secondaryChapa.targetX = primaryChapa.x - 28;
            secondaryChapa.targetY = primaryChapa.y - forwardDir * 0.25;
          }

          ball.targetX = primaryChapa.targetX;
          ball.targetY = primaryChapa.targetY;
        }
        break;
      }

      case 'CROSS_COMPLETED': {
        if (primaryChapa && targetChapa) {
          // El centrador (extremo o lateral) gana línea de fondo y se sitúa en la banda
          const isLeftFlank = primaryChapa.position === 'LW' || primaryChapa.position === 'LB' || primaryChapa.baseX < width / 2;
          primaryChapa.targetX = isLeftFlank ? 60 : width - 60;
          primaryChapa.targetY = primaryChapa.isHome ? 165 : height - 165;
          primaryChapa.hasBall = false;

          // El receptor (delantero) ataca el punto de penalti dentro del área pequeña
          targetChapa.targetX = width / 2 + (Math.random() * 24 - 12);
          targetChapa.targetY = targetChapa.isHome ? 135 : height - 135;
          targetChapa.isMakingRun = true;
          targetChapa.hasBall = true;

          // El centro vuela medido al corazón del área
          ball.targetX = targetChapa.targetX;
          ball.targetY = targetChapa.targetY;
        }
        break;
      }

      case 'THROUGH_BALL': {
        if (primaryChapa && targetChapa) {
          // El pasador (mediapunta o centrocampista) filtra desde la frontal del área
          primaryChapa.targetX = width / 2 + (Math.random() * 30 - 15);
          primaryChapa.targetY = primaryChapa.isHome ? 245 : height - 245;
          primaryChapa.hasBall = false;

          // El delantero gana la espalda a la zaga y se planta solo en el área
          targetChapa.targetX = width / 2 + (Math.random() * 20 - 10);
          targetChapa.targetY = targetChapa.isHome ? 140 : height - 140;
          targetChapa.isMakingRun = true;
          targetChapa.hasBall = true;

          // El balón filtra entre los centrales
          ball.targetX = targetChapa.targetX;
          ball.targetY = targetChapa.targetY;
        }
        break;
      }

      case 'DRIBBLE_TACKLED': {
        if (primaryChapa && secondaryChapa) {
          primaryChapa.hasBall = true;
          if (secondaryChapa.position !== 'GK') {
            // Choque físico con distancia mínima de contacto (34px)
            const midX = (primaryChapa.x + secondaryChapa.x) / 2;
            const midY = (primaryChapa.y + secondaryChapa.y) / 2;

            primaryChapa.targetX = midX - 17;
            primaryChapa.targetY = midY;
            secondaryChapa.targetX = midX + 17;
            secondaryChapa.targetY = midY;

            ball.targetX = midX;
            ball.targetY = midY;

            setTimeout(() => {
              secondaryChapa.hasBall = true;
              if (primaryChapa) primaryChapa.hasBall = false;
            }, 300);
          }
        }
        break;
      }

      case 'GOAL': {
        if (primaryChapa) {
          // El goleador culmina dentro del área
          primaryChapa.targetX = width / 2 + (Math.random() * 24 - 12);
          primaryChapa.targetY = primaryChapa.isHome ? 130 : height - 130;
          primaryChapa.hasBall = true;

          // Local ataca hacia la portería norte (y = 20), Visitante hacia la sur (y = height - 20)
          const targetGoalY = primaryChapa.isHome ? 20 : height - 20;
          const targetGoalX = width / 2 + (Math.random() * 36 - 18);

          if (secondaryChapa && secondaryChapa.position === 'GK') {
            secondaryChapa.targetX = width / 2 + (targetGoalX > width / 2 ? 22 : -22);
            secondaryChapa.targetY = secondaryChapa.baseY;
          }

          ball.targetX = targetGoalX;
          ball.targetY = targetGoalY;

          confetti({
            particleCount: 85,
            spread: 75,
            origin: { y: primaryChapa.isHome ? 0.25 : 0.75 },
          });

          // Tras la celebración del gol (1.2s), el equipo que encaja saca de centro reglamentariamente
          setTimeout(() => {
            ball.targetX = width / 2;
            ball.targetY = height / 2;
            Object.values(chapas).forEach((c) => {
              c.targetX = c.baseX;
              c.targetY = c.baseY;
              c.hasBall = false;
            });
            const concedingTeamIsHome = !primaryChapa.isHome;
            const kickoffStriker = Object.values(chapas).find(
              (c) => c.isHome === concedingTeamIsHome && c.position === 'ST'
            );
            if (kickoffStriker) {
              kickoffStriker.targetX = width / 2;
              kickoffStriker.targetY = concedingTeamIsHome ? height / 2 + 12 : height / 2 - 12;
              kickoffStriker.hasBall = true;
            }
          }, 1200);
        }
        break;
      }

      case 'SHOT_SAVED': {
        // En SHOT_SAVED: primaryChapa es el GK que hace la parada, secondaryChapa es el atacante que chutó
        const gk = (primaryChapa?.position === 'GK' ? primaryChapa : (secondaryChapa?.position === 'GK' ? secondaryChapa : null)) || primaryChapa;
        const shooter = gk === primaryChapa ? secondaryChapa : primaryChapa;

        if (shooter) {
          shooter.targetX = width / 2 + (Math.random() * 24 - 12);
          shooter.targetY = shooter.isHome ? 135 : height - 135;
          shooter.hasBall = false;
        }

        if (gk) {
          const diveGoalX = width / 2 + (Math.random() * 24 - 12);
          const diveGoalY = gk.baseY;

          gk.targetX = diveGoalX;
          gk.targetY = diveGoalY;
          gk.hasBall = true;

          ball.targetX = diveGoalX;
          ball.targetY = diveGoalY;
        }
        break;
      }

      default:
        break;
    }

    // Capturar snapshot visual del paso actual para auditoría time-travel
    if (!isAuditing && currentMatch) {
      const snapChapas: Record<string, ChapaSnapshot> = {};
      Object.values(chapas).forEach((c) => {
        snapChapas[c.id] = {
          id: c.id,
          name: c.name,
          number: c.number,
          position: c.position,
          isHome: c.isHome,
          x: c.targetX,
          y: c.targetY,
          hasBall: c.hasBall,
          isHighlight: c.isHighlight,
          isMakingRun: c.isMakingRun,
        };
      });
      const stepIdx = currentMatch.auditTrail.length - 1;
      setBoardSnapshotForStep(stepIdx, {
        ball: { x: ball.targetX, y: ball.targetY },
        chapas: snapChapas,
      });
    }
  }, [currentMatch?.lastEvent]);

  // Restaurar posiciones visuales exactas cuando el usuario audita un fotograma previo
  useEffect(() => {
    if (inspectingIndex === null || inspectingIndex === undefined || !currentMatch) return;
    const step = currentMatch.auditTrail[inspectingIndex];
    if (!step) return;

    setActiveActionText(step.event.commentary);

    if (step.boardSnapshot) {
      const snap = step.boardSnapshot;
      Object.entries(snap.chapas).forEach(([pId, s]) => {
        const c = chapasRef.current[pId];
        if (c) {
          c.targetX = s.x;
          c.targetY = s.y;
          c.hasBall = s.hasBall;
          c.isHighlight = s.isHighlight;
          c.isMakingRun = s.isMakingRun;
        }
      });
      ballRef.current.targetX = snap.ball.x;
      ballRef.current.targetY = snap.ball.y;
    }
  }, [inspectingIndex]);

  // 3. Loop de Física a 60 FPS: Locomoción Suave + Fuerza de Repulsión Anti-Solapamiento
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

      const chapas = chapasRef.current;
      const ball = ballRef.current;
      const allChapas = Object.values(chapas);

      // 1. Locomoción física realista (Aceleración, frenado y zancada, NO saltos lerp bruscos)
      allChapas.forEach((c) => {
        if (c.position === 'GK') {
          if (c.isHome) {
            c.targetY = Math.max(height * 0.86, Math.min(height * 0.94, c.targetY));
            c.targetX = Math.max(width * 0.40, Math.min(width * 0.60, c.targetX));
          } else {
            c.targetY = Math.max(height * 0.06, Math.min(height * 0.14, c.targetY));
            c.targetX = Math.max(width * 0.40, Math.min(width * 0.60, c.targetX));
          }
        }

        const dx = c.targetX - c.x;
        const dy = c.targetY - c.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 1.2) {
          // Velocidad punta calibrada: jugador corriendo suavemente a zancadas
          const maxSpeed = c.isMakingRun || c.isHighlight ? 3.6 : 2.2;
          const desiredSpeed = Math.min(maxSpeed, dist * 0.15);
          const nx = dx / dist;
          const ny = dy / dist;

          // Aceleración suave
          c.vx += (nx * desiredSpeed - c.vx) * 0.16;
          c.vy += (ny * desiredSpeed - c.vy) * 0.16;

          c.runCycle += Math.hypot(c.vx, c.vy) * 0.35;
        } else {
          c.vx *= 0.7;
          c.vy *= 0.7;
        }

        c.x += c.vx;
        c.y += c.vy;
      });

      // 2. FÍSICA DE REPULSIÓN Y ANTI-SOLAPAMIENTO (Ninguna chapa se monta encima de otra)
      const MIN_DISTANCE = 34; // 15px radio + 15px radio + 4px separación mínima
      for (let i = 0; i < allChapas.length; i++) {
        for (let j = i + 1; j < allChapas.length; j++) {
          const a = allChapas[i];
          const b = allChapas[j];
          const diffX = b.x - a.x;
          const diffY = b.y - a.y;
          const d = Math.hypot(diffX, diffY);

          if (d < MIN_DISTANCE && d > 0.001) {
            const overlap = MIN_DISTANCE - d;
            const nx = diffX / d;
            const ny = diffY / d;

            // Repulsión elástica mutua
            const push = overlap * 0.5;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }

      // 3. Balón
      ball.x += (ball.targetX - ball.x) * 0.14;
      ball.y += (ball.targetY - ball.y) * 0.14;
      ball.rotation += 0.18;

      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 7) ball.trail.shift();

      // --- DIBUJADO DE LA ESCENA ---

      // Césped
      const numStripes = 10;
      const stripeHeight = height / numStripes;
      for (let i = 0; i < numStripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#2d8a4e' : '#247441';
        ctx.fillRect(0, i * stripeHeight, width, stripeHeight);
      }

      // Líneas
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 2.5;

      ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

      ctx.beginPath();
      ctx.moveTo(pad, height / 2);
      ctx.lineTo(width - pad * 2, height / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 45, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      const boxW = 150;
      const boxH = 70;
      ctx.strokeRect((width - boxW) / 2, pad, boxW, boxH);
      ctx.strokeRect((width - boxW) / 2, height - pad - boxH, boxW, boxH);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(width / 2 - 38, pad - 12, 76, 12);
      ctx.strokeRect(width / 2 - 38, height - pad, 76, 12);

      // Redes
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

      // Vector de pase
      if (Math.hypot(ball.targetX - ball.x, ball.targetY - ball.y) > 8) {
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ball.targetX, ball.targetY);
        ctx.strokeStyle = 'rgba(253, 216, 53, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Estela
      ball.trail.forEach((t, idx) => {
        const alpha = (idx / ball.trail.length) * 0.35;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      });

      // Chapas con animación de zancada
      allChapas.forEach((c) => {
        let drawX = c.x;
        let drawY = c.y;

        // Micro-animación de carrera cuando el jugador se desplaza
        const moveSpeed = Math.hypot(c.vx, c.vy);
        if (moveSpeed > 0.4) {
          const perpX = -c.vy / moveSpeed;
          const perpY = c.vx / moveSpeed;
          const stride = Math.sin(c.runCycle) * 1.4;
          drawX += perpX * stride;
          drawY += perpY * stride;
        }

        // Sombra
        ctx.beginPath();
        ctx.arc(drawX + 2.5, drawY + 3.5, c.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();

        if (c.isMakingRun) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, c.radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.setLineDash([2, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (c.isHighlight) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, c.radius + 7, 0, Math.PI * 2);
          ctx.strokeStyle = '#fdd835';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        if (c.hasBall) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, c.radius + 10, 0, Math.PI * 2);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Chapa
        ctx.beginPath();
        ctx.arc(drawX, drawY, c.radius, 0, Math.PI * 2);
        ctx.fillStyle = c.isHome ? '#004d99' : '#dc2626';
        ctx.fill();

        // Borde
        ctx.strokeStyle = c.isHome ? '#fdd835' : '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Dorsal
        ctx.fillStyle = '#ffffff';
        ctx.font = 'black 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(c.number), drawX, drawY);

        // Badge de Nombre cápsula anti-solapamiento con distinción nítida de equipo
        const teamTag = c.isHome ? 'L' : 'V';
        const labelText = `[${teamTag}] ${c.name} (${c.position})`;
        ctx.font = 'bold 9px sans-serif';
        const textWidth = ctx.measureText(labelText).width;
        const badgeY = drawY + c.radius + 3;

        ctx.fillStyle = c.isHome ? 'rgba(0, 60, 150, 0.92)' : 'rgba(180, 25, 25, 0.92)';
        ctx.beginPath();
        ctx.roundRect(drawX - textWidth / 2 - 5, badgeY, textWidth + 10, 13, 3);
        ctx.fill();

        ctx.strokeStyle = c.isHome ? 'rgba(253, 216, 53, 0.75)' : 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, drawX, badgeY + 7);
      });

      // Balón
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.rotation);

      ctx.beginPath();
      ctx.arc(1.5, 2, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

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
      }, 750);
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

  const { homeTeam, awayTeam, state, isPlaying } = currentMatch;

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
              <span>{displayedScore.home}</span>
              <span className="text-slate-500 text-2xl">-</span>
              <span>{displayedScore.away}</span>
            </div>
            <div className={`text-xs font-bold mt-0.5 flex items-center gap-1.5 ${isAuditing ? 'text-amber-400' : 'text-emerald-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isAuditing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`}></span>
              {isAuditing 
                ? `AUDITORÍA • ${displayedMinute}' Minuto` 
                : (state.isFinished ? 'FINALIZADO' : `${state.currentMinute}' Minuto`)}
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

        {/* Panel de Controles & Interruptor Debug */}
        <div className="bg-slate-800/90 px-4 py-2.5 border-t border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={stepMatch}
              disabled={state.isFinished || isPlaying}
              className="bg-valle-blue hover:bg-blue-700 disabled:opacity-40 text-white font-bold px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow"
            >
              <Dices className="w-4 h-4 text-valle-yellow" />
              Tirada D20 (+1 Min)
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

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDebugger(!showDebugger)}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all border ${
                showDebugger
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                  : 'bg-slate-700 text-slate-300 border-slate-600 hover:text-white'
              }`}
            >
              <Brain className="w-4 h-4 text-indigo-200" />
              {showDebugger ? 'Ocultar Debug IA' : '🔍 Debug Decisiones IA'}
            </button>

            <button
              onClick={() => startMatch(homeTeam.id, awayTeam.id)}
              className="text-slate-400 hover:text-white flex items-center gap-1 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar
            </button>
          </div>
        </div>
      </div>

      {/* NAVEGADOR DE AUDITORÍA Y TIME-TRAVEL */}
      <MatchAuditNavigator />

      {/* PANEL DE DEBUG DE DECISIONES DE LA IA */}
      {showDebugger && (
        <DecisionDebugger decision={displayedEvent?.decision} minute={displayedMinute} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Tablero Canvas 2D con Física Anti-Solapamiento */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-md p-4 border border-slate-200 flex flex-col items-center">
          <div className="w-full bg-slate-900 text-valle-yellow font-bold text-xs px-3 py-2 rounded-lg mb-3 flex items-center justify-between border border-slate-700">
            <span className="flex items-center gap-2 truncate">
              {displayedEvent?.tacticalAdvantage === 'SPACE_EXPLOITED' ? (
                <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 animate-spin" />
              ) : (
                <span>⚡</span>
              )}
              <span className="truncate">{activeActionText || displayedEvent?.commentary || 'Listo para el saque inicial. ¡Rueda el balón!'}</span>
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono flex-shrink-0">
              Zona: {displayedZone}
            </span>
          </div>

          <div className="relative w-full max-w-[560px] aspect-[9/13] shadow-2xl rounded-xl overflow-hidden border-4 border-slate-400">
            {isAuditing && (
              <div className="absolute top-2.5 left-2.5 right-2.5 bg-amber-500/95 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg shadow-xl flex items-center justify-between z-10 border border-amber-300 backdrop-blur-sm">
                <span className="flex items-center gap-1.5 truncate">
                  <History className="w-4 h-4 flex-shrink-0 animate-pulse text-slate-950" />
                  <span className="truncate">Fotograma Histórico: Min {displayedMinute}' • {displayedEvent?.type}</span>
                </span>
                <span className="font-mono text-xs bg-slate-950 text-amber-300 px-2 py-0.5 rounded ml-2 flex-shrink-0">
                  {displayedScore.home} - {displayedScore.away}
                </span>
              </div>
            )}

            <canvas
              ref={canvasRef}
              width={560}
              height={800}
              className="w-full h-full block cursor-pointer"
            />
          </div>

          <p className="text-[11px] text-slate-400 mt-3 text-center">
            ⚽ Física Anti-Solapamiento: Cada chapa mantiene su radio de distancia personal (34px) y corre con aceleración e inercia realistas.
          </p>
        </div>

        {/* Columna Derecha: HUD de Tiradas D20 y Crónica */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl shadow-md p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-blue-300 flex items-center gap-2">
                <Dices className="w-4 h-4 text-valle-yellow" />
                Tirada D20 Minuto {displayedMinute}'
              </h3>
              {displayedEvent?.tacticalAdvantage === 'SPACE_EXPLOITED' && (
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-500 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                  ⭐ Ventaja Táctica
                </span>
              )}
            </div>

            {displayedEvent?.contestedCheck ? (
              <div className="space-y-3">
                <div className="bg-slate-800/90 rounded-lg p-3 border border-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">Tirada Enfrentada de Rol:</div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-center">
                      <div className="text-xs text-blue-300 font-bold truncate max-w-[100px]">
                        {displayedEvent.primaryPlayer?.name || 'Atacante'}
                      </div>
                      <div className="text-3xl font-black text-valle-yellow">
                        {displayedEvent.contestedCheck.attacker.total}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        d20 ({displayedEvent.contestedCheck.attacker.naturalRoll}) + {displayedEvent.contestedCheck.attacker.modifier}
                      </div>
                    </div>

                    <div className="text-slate-500 font-black text-sm">VS</div>

                    <div className="text-center">
                      <div className="text-xs text-red-300 font-bold truncate max-w-[100px]">
                        {displayedEvent.secondaryPlayer?.name || 'Defensor'}
                      </div>
                      <div className="text-3xl font-black text-white">
                        {displayedEvent.contestedCheck.defender.total}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        d20 ({displayedEvent.contestedCheck.defender.naturalRoll}) + {displayedEvent.contestedCheck.defender.modifier}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-700 text-center">
                    <span
                      className={`text-xs font-black px-3 py-1 rounded uppercase tracking-wider ${
                        displayedEvent.contestedCheck.attackerWon
                          ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-500'
                          : 'bg-red-900/80 text-red-300 border border-red-500'
                      }`}
                    >
                      {displayedEvent.contestedCheck.attackerWon ? '¡Éxito Atacante!' : '¡Robo / Corte Defensivo!'}
                    </span>
                  </div>
                </div>

                {displayedEvent.diceCheck?.isCritical && (
                  <div className="bg-yellow-500/20 border border-yellow-400 text-yellow-300 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2 animate-bounce">
                    <Award className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <span>¡NAT 20 CRÍTICO! Jugada de antología.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 text-xs text-center py-4 italic">
                {isAuditing ? 'Sin tirada enfrentada en este fotograma.' : 'Pulsa en "Tirada D20" para ejecutar y animar la siguiente jugada.'}
              </div>
            )}
          </div>

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
