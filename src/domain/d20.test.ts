import { describe, it, expect } from 'vitest';
import { getAttributeModifier, rollD20, resolveContestedCheck } from './d20';
import { MatchEngine } from './match-engine';
import { generateTeamRoster, getDefaultLineup } from './procedural-roster';
import { Team } from './types';

function createMockTeam(id: string, name: string): Team {
  const roster = generateTeamRoster(id, 42);
  const lineup = getDefaultLineup(roster, '4-3-3');
  return {
    id,
    key: `team_${id}`,
    name,
    badgeUrl: '',
    sourceOrigin: 'ECM_MADRID',
    groupNumber: 1,
    groupName: 'Grupo 1',
    stats: { position: 1, points: 30, played: 10, won: 10, drawn: 0, lost: 0, goalsFor: 30, goalsAgainst: 5, goalDiff: 25, form: 'VVVV' },
    roster,
    lineup,
    tactics: { formation: '4-3-3', tempo: 'BALANCED', mentality: 'BALANCED', pressingLevel: 'MID_FIELD', width: 'BALANCED' },
  };
}

describe('D20 Rule Engine', () => {
  it('calcula correctamente los modificadores d20 basados en atributos clásicos', () => {
    expect(getAttributeModifier(8)).toBe(-1);
    expect(getAttributeModifier(9)).toBe(-1);
    expect(getAttributeModifier(10)).toBe(0);
    expect(getAttributeModifier(11)).toBe(0);
    expect(getAttributeModifier(12)).toBe(1);
    expect(getAttributeModifier(14)).toBe(2);
    expect(getAttributeModifier(16)).toBe(3);
    expect(getAttributeModifier(18)).toBe(4);
  });

  it('genera tiradas dentro del rango [1, 20]', () => {
    for (let i = 0; i < 200; i++) {
      const res = rollD20(2);
      expect(res.naturalRoll).toBeGreaterThanOrEqual(1);
      expect(res.naturalRoll).toBeLessThanOrEqual(20);
      expect(res.total).toBe(res.naturalRoll + 2);
    }
  });

  it('aplica ventaja eligiendo el resultado más alto de 2d20', () => {
    let mockValues = [0.15, 0.85]; // Corresponde a 4 y 18
    let call = 0;
    const mockRng = () => mockValues[call++];

    const res = rollD20(0, { advantage: true, rng: mockRng });
    expect(res.hasAdvantage).toBe(true);
    expect(res.hasDisadvantage).toBe(false);
    expect(res.advantageRolls).toBeDefined();
    expect(res.naturalRoll).toBe(18); // Max(4, 18)
  });

  it('aplica desventaja eligiendo el resultado más bajo de 2d20', () => {
    let mockValues = [0.15, 0.85]; // 4 y 18
    let call = 0;
    const mockRng = () => mockValues[call++];

    const res = rollD20(0, { disadvantage: true, rng: mockRng });
    expect(res.hasDisadvantage).toBe(true);
    expect(res.hasAdvantage).toBe(false);
    expect(res.advantageRolls).toBeDefined();
    expect(res.naturalRoll).toBe(4); // Min(4, 18)
  });

  it('identifica éxito crítico en Nat 20 y pifia en Nat 1', () => {
    const crit = rollD20(0, { rng: () => 0.999 }); // 20
    expect(crit.naturalRoll).toBe(20);
    expect(crit.isCritical).toBe(true);
    expect(crit.isFumble).toBe(false);

    const fumble = rollD20(0, { rng: () => 0.001 }); // 1
    expect(fumble.naturalRoll).toBe(1);
    expect(fumble.isCritical).toBe(false);
    expect(fumble.isFumble).toBe(true);
  });

  it('resuelve tiradas enfrentadas correctamente', () => {
    const atk = rollD20(3, { rng: () => 0.7 }); // ~15 + 3 = 18
    const def = rollD20(1, { rng: () => 0.4 }); // ~9 + 1 = 10

    const contested = resolveContestedCheck(atk, def);
    expect(contested.attackerWon).toBe(true);
    expect(contested.outcome).toBe('CRITICAL_WIN');
  });

  it('permite rebobinar (time-travel rewind) a un minuto exacto y bifurcar', () => {
    const teamA = createMockTeam('1', 'Team A');
    const teamB = createMockTeam('2', 'Team B');
    const engine = new MatchEngine(teamA, teamB, 12345);

    // Simular 20 micro-ticks (10 minutos)
    for (let i = 0; i < 20; i++) {
      engine.step();
    }
    expect(engine.getState().currentMinute).toBe(10);
    expect(engine.getState().currentTick).toBe(20);
    const step10Score = engine.getState().events[10]?.score || { home: 0, away: 0 };

    // Rebobinar al paso 10
    const ok = engine.rewindToStep(10);
    expect(ok).toBe(true);
    expect(engine.getState().currentMinute).toBe(5);
    expect(engine.getState().currentTick).toBe(10);
    expect(engine.getState().score).toEqual(step10Score);
    expect(engine.getState().events.length).toBe(11); // Tick 0 + 10 ticks
  });
});

