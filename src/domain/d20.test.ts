import { describe, it, expect } from 'vitest';
import { getAttributeModifier, rollD20, resolveContestedCheck } from './d20';

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
});
