import { create } from 'zustand';
import { LeagueDatabase, Team, SoccerPosition } from '../domain/types';
import leagueDataJson from '../data/league-data.json';
import { MatchEngine, MatchEvent, MatchState, PitchZone } from '../domain/match-engine';

export type ActiveTab = 'MATCH' | 'TACTICS' | 'STANDINGS' | 'FIXTURES';

export interface ChapaSnapshot {
  id: string;
  name: string;
  number: number;
  position: SoccerPosition | string;
  isHome: boolean;
  x: number;
  y: number;
  hasBall: boolean;
  isHighlight: boolean;
  isMakingRun: boolean;
}

export interface BoardSnapshot {
  ball: { x: number; y: number };
  chapas: Record<string, ChapaSnapshot>;
}

export interface MatchAuditStep {
  stepIndex: number;
  minute: number;
  second?: number;
  event: MatchEvent;
  score: { home: number; away: number };
  ballZone: PitchZone | string;
  possessionTeamId: string | number;
  boardSnapshot?: BoardSnapshot;
  isKeyMoment: boolean;
  keyCategory: 'GOAL' | 'SAVE' | 'COUNTER' | 'CARD' | 'HALFTIME' | 'KICKOFF' | 'NORMAL';
  keyLabel?: string;
}

export interface CurrentMatchState {
  homeTeam: Team;
  awayTeam: Team;
  fixtureId?: string | number;
  engine: MatchEngine;
  state: MatchState;
  lastEvent: MatchEvent | null;
  isPlaying: boolean;
  // Auditoría y Time-Travel
  auditTrail: MatchAuditStep[];
  inspectingStepIndex: number | null; // null si estamos en directo (tiempo real)
}

interface GameState {
  database: LeagueDatabase;
  userTeamId: string | number | null;
  selectedGroupId: number;
  activeTab: ActiveTab;
  currentMatch: CurrentMatchState | null;

  // Acciones
  setUserTeam: (teamId: string | number) => void;
  setSelectedGroup: (groupId: number) => void;
  setActiveTab: (tab: ActiveTab) => void;
  updateUserTactics: (formation: any, mentality: any, tempo: any) => void;
  swapPlayers: (playerAId: string, playerBId: string) => void;
  startMatch: (homeTeamId: string | number, awayTeamId: string | number, fixtureId?: string | number) => void;
  stepMatch: () => void;
  simulateRestOfMatch: () => void;
  toggleAutoPlay: () => void;
  goToAuditStep: (stepIndex: number) => void;
  returnToLive: () => void;
  resumeFromAuditStep: (stepIndex: number) => void;
  setBoardSnapshotForStep: (stepIndex: number, snapshot: BoardSnapshot) => void;
}

const rawDb = leagueDataJson as unknown as LeagueDatabase;

export const useGameStore = create<GameState>((set, get) => ({
  database: rawDb,
  userTeamId: rawDb.groups[0]?.teams[0]?.id || null,
  selectedGroupId: 1,
  activeTab: 'TACTICS',
  currentMatch: null,

  setUserTeam: (teamId) => {
    const team = get().database.teams[String(teamId)];
    if (team) {
      set({
        userTeamId: teamId,
        selectedGroupId: team.groupNumber,
      });
    }
  },

  setSelectedGroup: (groupId) => set({ selectedGroupId: groupId }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  updateUserTactics: (formation, mentality, tempo) => {
    const { userTeamId, database } = get();
    if (!userTeamId) return;

    const team = database.teams[String(userTeamId)];
    if (!team) return;

    const updatedTeam: Team = {
      ...team,
      tactics: {
        ...team.tactics,
        formation: formation || team.tactics.formation,
        mentality: mentality || team.tactics.mentality,
        tempo: tempo || team.tactics.tempo,
      },
    };

    set({
      database: {
        ...database,
        teams: {
          ...database.teams,
          [String(userTeamId)]: updatedTeam,
        },
      },
    });
  },

  swapPlayers: (playerAId, playerBId) => {
    const { userTeamId, database } = get();
    if (!userTeamId) return;

    const team = database.teams[String(userTeamId)];
    if (!team) return;

    const newLineup = [...team.lineup];
    const idxA = newLineup.indexOf(playerAId);
    const idxB = newLineup.indexOf(playerBId);

    if (idxA !== -1 && idxB !== -1) {
      newLineup[idxA] = playerBId;
      newLineup[idxB] = playerAId;
    } else if (idxA !== -1 && idxB === -1) {
      newLineup[idxA] = playerBId;
    } else if (idxA === -1 && idxB !== -1) {
      newLineup[idxB] = playerAId;
    }

    const updatedTeam: Team = {
      ...team,
      lineup: newLineup,
    };

    set({
      database: {
        ...database,
        teams: {
          ...database.teams,
          [String(userTeamId)]: updatedTeam,
        },
      },
    });
  },

  startMatch: (homeTeamId, awayTeamId, fixtureId) => {
    const { database } = get();
    const home = database.teams[String(homeTeamId)];
    const away = database.teams[String(awayTeamId)];
    if (!home || !away) return;

    const engine = new MatchEngine(home, away);
    const initialEvent = engine.getState().events[0];
    const initialStep: MatchAuditStep = {
      stepIndex: 0,
      minute: 0,
      event: initialEvent,
      score: { home: 0, away: 0 },
      ballZone: 'MIDFIELD',
      possessionTeamId: home.id,
      isKeyMoment: true,
      keyCategory: 'KICKOFF',
      keyLabel: `⚡ Saque de Centro Inicial (0')`,
    };

    set({
      activeTab: 'MATCH',
      currentMatch: {
        homeTeam: home,
        awayTeam: away,
        fixtureId,
        engine,
        state: engine.getState(),
        lastEvent: initialEvent,
        isPlaying: false,
        auditTrail: [initialStep],
        inspectingStepIndex: null,
      },
    });
  },

  stepMatch: () => {
    const { currentMatch } = get();
    if (!currentMatch || currentMatch.state.isFinished) return;

    const event = currentMatch.engine.step();
    if (!event) return;

    let isKey = false;
    let category: MatchAuditStep['keyCategory'] = 'NORMAL';
    let keyLabel = '';
    const timeLabel = `${event.minute}'${event.second ? ' 30"' : ''}`;

    if (event.type === 'GOAL') {
      isKey = true;
      category = 'GOAL';
      keyLabel = `⚽ Min ${timeLabel} Gol de ${event.primaryPlayer?.name || 'Delantero'} (${event.score.home}-${event.score.away})`;
    } else if (event.type === 'SHOT_SAVED') {
      isKey = true;
      category = 'SAVE';
      keyLabel = `🧤 Min ${timeLabel} Parada de ${event.primaryPlayer?.name || 'Portero'}`;
    } else if (event.type === 'CHANNEL_SPRINT') {
      isKey = true;
      category = 'COUNTER';
      keyLabel = `🚀 Min ${timeLabel} Carrera al córner (${event.targetPlayer?.name || 'Extremo'})`;
    } else if (event.type === 'HALF_TIME') {
      isKey = true;
      category = 'HALFTIME';
      keyLabel = `⏱️ Min 45' Descanso (${event.score.home}-${event.score.away})`;
    } else if (event.type === 'FULL_TIME') {
      isKey = true;
      category = 'HALFTIME';
      keyLabel = `🏁 Min 90' Final (${event.score.home}-${event.score.away})`;
    } else if (event.tacticalAdvantage === 'SPACE_EXPLOITED') {
      isKey = true;
      category = 'COUNTER';
      keyLabel = `⚡ Min ${timeLabel} Contragolpe Rompelíneas`;
    } else if (event.diceCheck?.isCritical || event.contestedCheck?.attacker.isCritical) {
      isKey = true;
      category = 'COUNTER';
      keyLabel = `🎲 Min ${timeLabel} ¡Nat 20 Crítico!`;
    }

    const nextState = { ...currentMatch.engine.getState() };
    const auditStep: MatchAuditStep = {
      stepIndex: currentMatch.auditTrail.length,
      minute: event.minute,
      second: event.second || 0,
      event,
      score: { ...nextState.score },
      ballZone: nextState.ballZone,
      possessionTeamId: nextState.possessionTeamId,
      isKeyMoment: isKey,
      keyCategory: category,
      keyLabel: keyLabel || undefined,
    };

    set({
      currentMatch: {
        ...currentMatch,
        state: nextState,
        lastEvent: event,
        auditTrail: [...currentMatch.auditTrail, auditStep],
        inspectingStepIndex: null, // Mantenemos el modo directo en vivo
      },
    });
  },

  simulateRestOfMatch: () => {
    const { currentMatch, stepMatch } = get();
    if (!currentMatch) return;

    // Ejecuta todos los minutos restantes registrando cada paso en el histórico auditado
    while (!currentMatch.engine.getState().isFinished) {
      stepMatch();
    }
  },

  toggleAutoPlay: () => {
    const { currentMatch } = get();
    if (!currentMatch) return;
    set({
      currentMatch: {
        ...currentMatch,
        inspectingStepIndex: null,
        isPlaying: !currentMatch.isPlaying,
      },
    });
  },

  goToAuditStep: (stepIndex: number) => {
    const { currentMatch } = get();
    if (!currentMatch || stepIndex < 0 || stepIndex >= currentMatch.auditTrail.length) return;
    set({
      currentMatch: {
        ...currentMatch,
        isPlaying: false, // Pausar simulación continua al auditar
        inspectingStepIndex: stepIndex,
      },
    });
  },

  returnToLive: () => {
    const { currentMatch } = get();
    if (!currentMatch) return;
    set({
      currentMatch: {
        ...currentMatch,
        inspectingStepIndex: null,
      },
    });
  },

  resumeFromAuditStep: (stepIndex: number) => {
    const { currentMatch } = get();
    if (!currentMatch || stepIndex < 0 || stepIndex >= currentMatch.auditTrail.length) return;

    // Rebobinar el motor al estado del minuto seleccionado
    const ok = currentMatch.engine.rewindToStep(stepIndex);
    if (!ok) return;

    // Truncar historial eliminando el futuro y bifurcando la simulación
    const truncatedAudit = currentMatch.auditTrail.slice(0, stepIndex + 1);
    const restoredEvent = truncatedAudit[stepIndex].event;

    set({
      currentMatch: {
        ...currentMatch,
        state: { ...currentMatch.engine.getState() },
        lastEvent: restoredEvent,
        auditTrail: truncatedAudit,
        inspectingStepIndex: null, // Regresa a directo en el punto bifurcado
        isPlaying: false,
      },
    });
  },

  setBoardSnapshotForStep: (stepIndex: number, snapshot: BoardSnapshot) => {
    const { currentMatch } = get();
    if (!currentMatch || !currentMatch.auditTrail[stepIndex]) return;
    currentMatch.auditTrail[stepIndex].boardSnapshot = snapshot;
  },
}));
