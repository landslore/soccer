// Motor de Reglas D20 para Fútbol 11 (Agnóstico de UI)

export interface DiceCheckResult {
  readonly naturalRoll: number;
  readonly modifier: number;
  readonly total: number;
  readonly isCritical: boolean;  // Nat 20 (o 18-20 con trait Poacher)
  readonly isFumble: boolean;    // Nat 1
  readonly advantageRolls?: [number, number];
  readonly hasAdvantage?: boolean;
  readonly hasDisadvantage?: boolean;
  readonly description?: string;
}

export interface ContestedCheckResult {
  readonly attacker: DiceCheckResult;
  readonly defender: DiceCheckResult;
  readonly diff: number;
  readonly attackerWon: boolean;
  readonly outcome: 'CRITICAL_WIN' | 'WIN' | 'DRAW' | 'LOSS' | 'FUMBLE_LOSS';
}

/**
 * Convierte un atributo numérico (8 a 18) en su modificador estándar d20.
 * 8-9: -1 | 10-11: 0 | 12-13: +1 | 14-15: +2 | 16-17: +3 | 18+: +4
 */
export function getAttributeModifier(attributeValue: number): number {
  return Math.floor((attributeValue - 10) / 2);
}

/**
 * Generador de números pseudoaleatorios seeded (Mulberry32) para garantizar determinismo y reproducibilidad.
 */
export function createPRNG(seed: number = Date.now()) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Realiza una tirada de d20 considerando ventajas, desventajas y modificadores.
 */
export function rollD20(
  modifier: number = 0,
  options: {
    advantage?: boolean;
    disadvantage?: boolean;
    criticalThreshold?: number; // Por defecto 20
    rng?: () => number;
    description?: string;
  } = {}
): DiceCheckResult {
  const rng = options.rng || Math.random;
  const rollDie = () => Math.floor(rng() * 20) + 1;
  const critThreshold = options.criticalThreshold ?? 20;

  let naturalRoll: number;
  let advantageRolls: [number, number] | undefined;
  const isAdv = Boolean(options.advantage && !options.disadvantage);
  const isDisadv = Boolean(options.disadvantage && !options.advantage);

  if (isAdv) {
    const r1 = rollDie();
    const r2 = rollDie();
    advantageRolls = [r1, r2];
    naturalRoll = Math.max(r1, r2);
  } else if (isDisadv) {
    const r1 = rollDie();
    const r2 = rollDie();
    advantageRolls = [r1, r2];
    naturalRoll = Math.min(r1, r2);
  } else {
    naturalRoll = rollDie();
  }

  const isCritical = naturalRoll >= critThreshold;
  const isFumble = naturalRoll === 1;
  const total = naturalRoll + modifier;

  return {
    naturalRoll,
    modifier,
    total,
    isCritical,
    isFumble,
    advantageRolls,
    hasAdvantage: isAdv,
    hasDisadvantage: isDisadv,
    description: options.description,
  };
}

/**
 * Resuelve una tirada enfrentada entre atacante y defensor.
 */
export function resolveContestedCheck(
  attackerRoll: DiceCheckResult,
  defenderRoll: DiceCheckResult
): ContestedCheckResult {
  if (attackerRoll.isCritical && !defenderRoll.isCritical) {
    return {
      attacker: attackerRoll,
      defender: defenderRoll,
      diff: 10,
      attackerWon: true,
      outcome: 'CRITICAL_WIN',
    };
  }

  if (attackerRoll.isFumble && !defenderRoll.isFumble) {
    return {
      attacker: attackerRoll,
      defender: defenderRoll,
      diff: -10,
      attackerWon: false,
      outcome: 'FUMBLE_LOSS',
    };
  }

  const diff = attackerRoll.total - defenderRoll.total;
  let outcome: 'CRITICAL_WIN' | 'WIN' | 'DRAW' | 'LOSS' | 'FUMBLE_LOSS';

  if (diff > 5) outcome = 'CRITICAL_WIN';
  else if (diff > 0) outcome = 'WIN';
  else if (diff === 0) outcome = 'DRAW';
  else outcome = 'LOSS';

  return {
    attacker: attackerRoll,
    defender: defenderRoll,
    diff,
    attackerWon: diff > 0,
    outcome,
  };
}
