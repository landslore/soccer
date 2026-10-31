import { create } from 'zustand';
import { LeagueDatabase, Team } from '../domain/types';
import leagueDataJson from '../data/league-data.json';
import { MatchEngine, MatchEvent, MatchState } from '../domain/match-engine';

export type ActiveTab = 'MATCH' | 'TACTICS' | 'STANDINGS' | 'FIXTURES';

interface GameState {
  database: LeagueDatabase;
  userTeamId: string | number | null;
  selectedGroupId: number;
  activeTab: ActiveTab;
  currentMatch: {
    homeTeam: Team;
    awayTeam: Team;
    fixtureId?: string | number;
    engine: MatchEngine;
    state: MatchState;
    lastEvent: MatchEvent | null;
    isPlaying: boolean;
  } | null;

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
    set({
      activeTab: 'MATCH',
      currentMatch: {
        homeTeam: home,
        awayTeam: away,
        fixtureId,
        engine,
        state: engine.getState(),
        lastEvent: null,
        isPlaying: false,
      },
    });
  },

  stepMatch: () => {
    const { currentMatch } = get();
    if (!currentMatch || currentMatch.state.isFinished) return;

    const event = currentMatch.engine.step();
    set({
      currentMatch: {
        ...currentMatch,
        state: { ...currentMatch.engine.getState() },
        lastEvent: event,
      },
    });
  },

  simulateRestOfMatch: () => {
    const { currentMatch } = get();
    if (!currentMatch) return;

    currentMatch.engine.simulateFullMatch();
    const finalState = currentMatch.engine.getState();
    const lastEv = finalState.events[finalState.events.length - 1] || null;

    set({
      currentMatch: {
        ...currentMatch,
        state: { ...finalState },
        lastEvent: lastEv,
        isPlaying: false,
      },
    });
  },

  toggleAutoPlay: () => {
    const { currentMatch } = get();
    if (!currentMatch) return;
    set({
      currentMatch: {
        ...currentMatch,
        isPlaying: !currentMatch.isPlaying,
      },
    });
  },
}));
