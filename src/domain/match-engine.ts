import { Player, Team, SoccerPosition, PlayerPersonalityType } from './types';
import { 
  rollD20, 
  getAttributeModifier, 
  resolveContestedCheck, 
  ContestedCheckResult, 
  DiceCheckResult,
  createPRNG
} from './d20';

export type PitchZone = 
  | 'OWN_BOX' 
  | 'DEFENSIVE_HALF' 
  | 'MIDFIELD' 
  | 'ATTACKING_THIRD' 
  | 'OPPONENT_BOX';

export type MatchEventType = 
  | 'KICK_OFF'
  | 'PASS_COMPLETED'
  | 'PASS_INTERCEPTED'
  | 'DRIBBLE_SUCCESS'
  | 'DRIBBLE_TACKLED'
  | 'CROSS_COMPLETED'
  | 'THROUGH_BALL'
  | 'CONTROL_AND_DRIVE'
  | 'CHANNEL_SPRINT'
  | 'SWITCH_PLAY'
  | 'HOLD_UP_PLAY'
  | 'AERIAL_DUEL_WON'
  | 'SHOT_SAVED'
  | 'GOAL'
  | 'SHOT_MISSED'
  | 'FOUL'
  | 'YELLOW_CARD'
  | 'RED_CARD'
  | 'OFFSIDE'
  | 'HALF_TIME'
  | 'FULL_TIME';

export interface TacticalOption {
  readonly actionType: 
    | 'SHORT_PASS' 
    | 'THROUGH_BALL' 
    | 'DRIBBLE' 
    | 'CROSS' 
    | 'LONG_SHOT' 
    | 'BOX_FINISH' 
    | 'SAFETY_BACKPASS'
    | 'CONTROL_AND_DRIVE'
    | 'CHANNEL_SPRINT'
    | 'SWITCH_PLAY'
    | 'HOLD_UP_PLAY'
    | 'COUNTER_ATTACK';
  readonly label: string;
  readonly targetPlayer?: Player;
  readonly targetZone: PitchZone;
  readonly utilityScore: number; // 0 - 100
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly reason: string;
  readonly d20Bonus: number;
}

export interface PlayerDecision {
  readonly decisionMaker: Player;
  readonly chosenOption: TacticalOption;
  readonly evaluatedOptions: TacticalOption[];
  readonly tacticalContext: string;
}

export interface MatchEvent {
  readonly minute: number;
  readonly second?: number; // 0 o 30 segundos
  readonly type: MatchEventType;
  readonly attackingTeamId: string | number;
  readonly defendingTeamId: string | number;
  readonly primaryPlayer?: Player;
  readonly secondaryPlayer?: Player;
  readonly targetPlayer?: Player;
  readonly zone: PitchZone;
  readonly diceCheck?: DiceCheckResult;
  readonly contestedCheck?: ContestedCheckResult;
  readonly tacticalAdvantage?: 'SPACE_EXPLOITED' | 'OVERLOAD' | 'OFFSIDE_TRAP_BROKEN' | 'TIGHT_MARKING';
  readonly decision?: PlayerDecision; // Registro completo de la toma de decisiones para debug y mejora
  readonly commentary: string;
  readonly score: { home: number; away: number };
}

export interface MatchState {
  readonly homeTeam: Team;
  readonly awayTeam: Team;
  currentMinute: number;
  currentSecond: number; // 0 o 30
  currentTick: number;   // 0 a 180 (cada tick representa ~30s de juego)
  score: { home: number; away: number };
  possessionTeamId: string | number;
  ballZone: PitchZone;
  events: MatchEvent[];
  isFinished: boolean;
}

export interface EngineSnapshot {
  readonly currentMinute: number;
  readonly currentSecond: number;
  readonly currentTick: number;
  readonly score: { home: number; away: number };
  readonly possessionTeamId: string | number;
  readonly ballZone: PitchZone;
  readonly isFinished: boolean;
  readonly eventsCount: number;
}

/**
 * Modula la utilidad de una opción táctica en función del arquetipo de personalidad del jugador.
 * Permite que jugadores con perfil regateador tiendan a encarar incluso jugando en el centro,
 * o que pasadores natos busquen siempre el pase asociativo.
 */
export function applyPersonalityBias(player: Player, opt: TacticalOption): TacticalOption {
  const personality: PlayerPersonalityType = player.personality || 'SAFETY_FIRST';
  let scoreDelta = 0;
  let personalityReason = '';

  switch (personality) {
    case 'SOLO_DRIBBLER':
      if (opt.actionType === 'DRIBBLE' || opt.actionType === 'CONTROL_AND_DRIVE') {
        scoreDelta = +26;
        personalityReason = ' [Rasgo Regateador: tendencia natural a encarar y avanzar en solitario]';
      } else if (opt.actionType === 'SHORT_PASS' || opt.actionType === 'SAFETY_BACKPASS') {
        scoreDelta = -14;
      }
      break;

    case 'PASS_MAESTRO':
      if (opt.actionType === 'THROUGH_BALL' || opt.actionType === 'CROSS' || opt.actionType === 'SWITCH_PLAY' || opt.actionType === 'CHANNEL_SPRINT') {
        scoreDelta = +24;
        personalityReason = ' [Rasgo Organizador: prioriza visión asociativa y envíos al hueco]';
      } else if (opt.actionType === 'DRIBBLE') {
        scoreDelta = -18;
      }
      break;

    case 'SNIPER_SHOOTER':
      if (opt.actionType === 'LONG_SHOT' || opt.actionType === 'BOX_FINISH') {
        scoreDelta = +28;
        personalityReason = ' [Rasgo Gatillo Fácil: busca el disparo franco ante cualquier resquicio]';
      } else if (opt.actionType === 'SAFETY_BACKPASS') {
        scoreDelta = -15;
      }
      break;

    case 'BOX_TO_BOX_RUNNER':
      if (opt.actionType === 'CHANNEL_SPRINT' || opt.actionType === 'COUNTER_ATTACK' || opt.actionType === 'THROUGH_BALL') {
        scoreDelta = +22;
        personalityReason = ' [Rasgo Pulmón Incansable: explota el despliegue físico y las rupturas al espacio]';
      }
      break;

    case 'SAFETY_FIRST':
      if (opt.actionType === 'SHORT_PASS' || opt.actionType === 'SAFETY_BACKPASS' || opt.actionType === 'HOLD_UP_PLAY') {
        scoreDelta = +25;
        personalityReason = ' [Rasgo Conservador: minimiza pérdidas asegurando la posesión]';
      } else if (opt.actionType === 'DRIBBLE' || opt.actionType === 'LONG_SHOT') {
        scoreDelta = -22;
      }
      break;

    case 'AGGRESSIVE_PRESSER':
      if (opt.actionType === 'COUNTER_ATTACK' || opt.actionType === 'DRIBBLE') {
        scoreDelta = +14;
        personalityReason = ' [Rasgo Presionador: busca verticalidad inmediata tras recuperación]';
      }
      break;
  }

  const newScore = Math.max(5, Math.min(98, opt.utilityScore + scoreDelta));
  return {
    ...opt,
    utilityScore: newScore,
    reason: personalityReason ? `${opt.reason}${personalityReason}` : opt.reason,
  };
}

/**
 * Encuentra el jugador titular más adecuado para una acción según posición.
 * Si excludeGK es true, jamás devuelve al portero (vital para jugadas fuera del área).
 * Si se pasa excludePlayerIds, evita que un jugador se pase o centre a sí mismo.
 */
function getActivePlayer(
  team: Team, 
  positions: SoccerPosition[], 
  excludeGK: boolean = true,
  excludePlayerIds: (string | number)[] = []
): Player {
  const starters = team.roster.filter(p => team.lineup.includes(p.id) && !excludePlayerIds.includes(p.id));
  const candidate = starters.find(p => positions.includes(p.position));
  if (candidate && (!excludeGK || candidate.position !== 'GK')) {
    return candidate;
  }
  const pool = excludeGK ? starters.filter(p => p.position !== 'GK') : starters;
  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return team.roster.find(p => !excludePlayerIds.includes(p.id)) || team.roster[0];
}

export class MatchEngine {
  private state: MatchState;
  private rng: () => number;
  private snapshots: EngineSnapshot[] = [];

  constructor(homeTeam: Team, awayTeam: Team, seed: number = Date.now()) {
    this.rng = createPRNG(seed);
    this.state = {
      homeTeam,
      awayTeam,
      currentMinute: 0,
      currentSecond: 0,
      currentTick: 0,
      score: { home: 0, away: 0 },
      possessionTeamId: homeTeam.id,
      ballZone: 'MIDFIELD',
      events: [],
      isFinished: false,
    };

    this.recordEvent({
      minute: 0,
      second: 0,
      type: 'KICK_OFF',
      attackingTeamId: homeTeam.id,
      defendingTeamId: awayTeam.id,
      zone: 'MIDFIELD',
      commentary: `¡Comienza el partido en ${homeTeam.name}! Rueda el balón en la primera parte.`,
      score: { ...this.state.score },
    });
  }

  public getState(): MatchState {
    return this.state;
  }

  private applyEffort(player: Player, intensity: 'LOW' | 'MEDIUM' | 'HIGH'): void {
    const conMod = getAttributeModifier(player.attributes.constitution);
    let drain = 0.4;
    if (intensity === 'MEDIUM') drain = 0.9;
    if (intensity === 'HIGH') drain = 2.4;

    const effectiveDrain = Math.max(0.1, drain - conMod * 0.12);
    player.stamina = Math.max(5, Math.min(100, Math.round((player.stamina - effectiveDrain) * 10) / 10));
  }

  private getFatigueModifier(player: Player): number {
    if (player.stamina < 30) return -1;
    if (player.stamina < 15) return -2;
    return 0;
  }

  /**
   * Ejecuta 1 micro-tick de simulación táctica (cada tick equivale a ~30 segundos de juego).
   * Un partido completo de 90 minutos se resuelve en 180 ticks.
   */
  public step(): MatchEvent | null {
    if (this.state.isFinished) return null;

    this.state.currentTick++;
    this.state.currentMinute = Math.floor(this.state.currentTick / 2);
    this.state.currentSecond = (this.state.currentTick % 2) * 30;

    const minute = this.state.currentMinute;
    const second = this.state.currentSecond;

    // Descanso en el tick 90 (45' 00")
    if (this.state.currentTick === 90) {
      [this.state.homeTeam, this.state.awayTeam].forEach(team => {
        team.roster.forEach(p => {
          const conMod = getAttributeModifier(p.attributes.constitution);
          p.stamina = Math.min(100, Math.round((p.stamina + 22 + conMod * 1.5) * 10) / 10);
        });
      });

      return this.recordEvent({
        minute: 45,
        second: 0,
        type: 'HALF_TIME',
        attackingTeamId: this.state.possessionTeamId,
        defendingTeamId: this.getDefendingTeam().id,
        zone: 'MIDFIELD',
        commentary: `⏱️ Descanso (45' 00"). Marcador: ${this.state.homeTeam.name} ${this.state.score.home} - ${this.state.score.away} ${this.state.awayTeam.name}.`,
        score: { ...this.state.score },
      });
    }

    // Final del partido en el tick 180 (90' 00")
    if (this.state.currentTick >= 180) {
      this.state.isFinished = true;
      return this.recordEvent({
        minute: 90,
        second: 0,
        type: 'FULL_TIME',
        attackingTeamId: this.state.possessionTeamId,
        defendingTeamId: this.getDefendingTeam().id,
        zone: 'MIDFIELD',
        commentary: `🏁 ¡Final del partido! (90' 00"). Resultado: ${this.state.homeTeam.name} ${this.state.score.home} - ${this.state.score.away} ${this.state.awayTeam.name}.`,
        score: { ...this.state.score },
      });
    }

    const attackingTeam = this.getAttackingTeam();
    const defendingTeam = this.getDefendingTeam();

    // Resolver según la zona del balón mediante el motor de evaluación táctica
    switch (this.state.ballZone) {
      case 'OWN_BOX':
      case 'DEFENSIVE_HALF':
        return this.resolveBuildUpOrCounter(attackingTeam, defendingTeam, minute, second);

      case 'MIDFIELD':
        return this.resolveMidfieldDecisions(attackingTeam, defendingTeam, minute, second);

      case 'ATTACKING_THIRD':
        return this.resolveAttackingThirdDecisions(attackingTeam, defendingTeam, minute, second);

      case 'OPPONENT_BOX':
        return this.resolveBoxShot(attackingTeam, defendingTeam, minute, second);

      default:
        this.state.ballZone = 'MIDFIELD';
        return null;
    }
  }

  /**
   * Simula el partido completo hasta el pitido final.
   */
  public simulateFullMatch(): MatchState {
    while (!this.state.isFinished) {
      this.step();
    }
    return this.state;
  }

  // --- Sistema Inteligente de Toma de Decisiones y Opciones Tácticas ---

  private resolveBuildUpOrCounter(atk: Team, def: Team, min: number, sec: number = 0): MatchEvent {
    const passer = getActivePlayer(atk, ['CB', 'LB', 'RB'], true);
    const presser = getActivePlayer(def, ['ST', 'LW', 'RW'], true);
    const midfielder = getActivePlayer(atk, ['CDM', 'CM', 'CAM', 'LM', 'RM'], true, [passer.id]);
    const fullback = getActivePlayer(atk, ['LB', 'RB', 'CB'], true, [passer.id]);
    const forward = getActivePlayer(atk, ['ST', 'LW', 'RW'], true, [passer.id, midfielder.id]);
    const opposingShadow = getActivePlayer(def, ['CAM', 'CM', 'ST'], true, [presser.id]);

    const passerInt = passer.attributes.intelligence;
    const passerDes = passer.attributes.dexterity;
    const modPass = getAttributeModifier(passerDes) + this.getFatigueModifier(passer);
    const isDangerZone = this.state.ballZone === 'OWN_BOX';

    // Evaluación táctica de sombra de presión (GAP-001):
    // El mediocentro está comprometido si el rival presiona alto o si el mediapunta rival vigila la zona interior
    const isMidfielderMarked = def.tactics.pressingLevel === 'HIGH_PRESS' || 
      opposingShadow.attributes.wisdom >= 11 || 
      opposingShadow.attributes.dexterity >= 11;

    // Evaluar opciones de salida
    const isCounterAdvantage = atk.tactics.tempo === 'FAST_TRANSITION' && forward.attributes.dexterity >= 13;

    // 1. Pase interior al mediocentro: Si está marcado, NUNCA es de bajo riesgo ni tiene utilidad alta
    const optShort: TacticalOption = {
      actionType: 'SHORT_PASS',
      label: isMidfielderMarked 
        ? `Pase interior comprometido a ${midfielder.name}` 
        : `Pase en corto a ${midfielder.name}`,
      targetPlayer: midfielder,
      targetZone: isDangerZone ? 'DEFENSIVE_HALF' : 'MIDFIELD',
      utilityScore: isMidfielderMarked 
        ? Math.max(25, 42 - (12 - passerInt)) // Penalización severa por estar en sombra de pase
        : (isCounterAdvantage ? 55 : 80),
      riskLevel: isMidfielderMarked ? 'HIGH' : 'LOW',
      reason: isMidfielderMarked 
        ? `Riesgo elevado: ${midfielder.name} se encuentra en la sombra de presión y vigilancia de ${opposingShadow.name}` 
        : `Apoyo en el pivote defensivo con línea de pase limpia ante la presión de ${presser.name}`,
      d20Bonus: isMidfielderMarked ? modPass - 1 : modPass + 1,
    };

    // 2. Apertura a la banda hacia el lateral libre (Solución táctica preferida ante congestión interior)
    const optWide: TacticalOption = {
      actionType: 'SHORT_PASS',
      label: `Apertura segura a la banda hacia ${fullback.name}`,
      targetPlayer: fullback,
      targetZone: isDangerZone ? 'DEFENSIVE_HALF' : 'MIDFIELD',
      utilityScore: isMidfielderMarked ? 84 : 74,
      riskLevel: 'LOW',
      reason: `Aprovechar el carril exterior libre de la presión central de ${presser.name} para ganar metros`,
      d20Bonus: modPass + 2,
    };

    // 3. Contragolpe / Envío en largo al delantero
    const optCounter: TacticalOption = {
      actionType: 'COUNTER_ATTACK',
      label: `Balón largo al desmarque de ${forward.name}`,
      targetPlayer: forward,
      targetZone: 'ATTACKING_THIRD',
      utilityScore: isCounterAdvantage ? 88 : 45,
      riskLevel: 'HIGH',
      reason: isCounterAdvantage 
        ? `Lanza contragolpe directo aprovechando la velocidad punta de ${forward.name}` 
        : `Envío directo hacia campo rival buscando saltar líneas`,
      d20Bonus: getAttributeModifier(passerInt) + this.getFatigueModifier(passer),
    };

    // 4. Despeje de seguridad orientado (En área propia bajo agobio)
    const optClearance: TacticalOption = {
      actionType: 'COUNTER_ATTACK',
      label: `Despeje de seguridad hacia la divisoria`,
      targetZone: 'MIDFIELD',
      utilityScore: isDangerZone && isMidfielderMarked ? 70 : 40,
      riskLevel: 'MEDIUM',
      reason: `Ante el asedio rival en área propia y el centro tapado, alejar el balón hacia zona neutra`,
      d20Bonus: getAttributeModifier(passer.attributes.strength) + this.getFatigueModifier(passer),
    };

    // 5. Conducción vertical de escape
    const optDribbleExit: TacticalOption = {
      actionType: 'DRIBBLE',
      label: `Conducción vertical para sortear la presión de ${presser.name}`,
      targetZone: 'MIDFIELD',
      utilityScore: passerDes >= 13 ? 62 : 32,
      riskLevel: 'HIGH',
      reason: `Eludir al delantero con quiebro y salir con balón dominado`,
      d20Bonus: getAttributeModifier(passerDes) + this.getFatigueModifier(passer),
    };

    const rawOptions = [optWide, optShort, optCounter, optClearance, optDribbleExit];
    const evaluatedOptions = rawOptions
      .map(opt => applyPersonalityBias(passer, opt))
      .sort((a, b) => b.utilityScore - a.utilityScore);

    const chosen = evaluatedOptions[0];

    const decision: PlayerDecision = {
      decisionMaker: passer,
      chosenOption: chosen,
      evaluatedOptions,
      tacticalContext: `Salida de balón en campo propio (${this.state.ballZone}) - Min ${min}' ${sec ? '30"' : '00"'}`,
    };

    if (chosen.actionType === 'COUNTER_ATTACK') {
      this.applyEffort(passer, 'HIGH');
      this.applyEffort(forward, 'HIGH');
      this.applyEffort(presser, 'MEDIUM');

      const rollAtk = rollD20(chosen.d20Bonus, { advantage: true, rng: this.rng });
      const rollDef = rollD20(getAttributeModifier(presser.attributes.strength), { rng: this.rng });
      const check = resolveContestedCheck(rollAtk, rollDef);

      if (check.attackerWon) {
        this.state.ballZone = 'ATTACKING_THIRD'; // Salta directo a tres cuartos (sin volver al centro)
        return this.recordEvent({
          minute: min,
          second: sec,
          type: 'PASS_COMPLETED',
          attackingTeamId: atk.id,
          defendingTeamId: def.id,
          primaryPlayer: passer,
          secondaryPlayer: presser,
          targetPlayer: forward,
          zone: 'ATTACKING_THIRD',
          contestedCheck: check,
          tacticalAdvantage: 'SPACE_EXPLOITED',
          decision,
          commentary: `⚡ ¡CONTRAGOLPE RÁPIDO! ${passer.name} mete un pase largo que rompe la presión rival y encuentra la carrera al sprint de ${forward.name}.`,
          score: { ...this.state.score },
        });
      } else {
        this.switchPossession();
        this.state.ballZone = 'MIDFIELD';
        return this.recordEvent({
          minute: min,
          second: sec,
          type: 'PASS_INTERCEPTED',
          attackingTeamId: def.id,
          defendingTeamId: atk.id,
          primaryPlayer: presser,
          secondaryPlayer: passer,
          targetPlayer: forward,
          zone: 'MIDFIELD',
          contestedCheck: check,
          decision,
          commentary: `El pase largo de ${passer.name} es interceptado en el salto por ${presser.name}.`,
          score: { ...this.state.score },
        });
      }
    } else if (chosen.actionType === 'DRIBBLE') {
      this.applyEffort(passer, 'HIGH');
      this.applyEffort(presser, 'MEDIUM');

      const rollAtk = rollD20(chosen.d20Bonus, { rng: this.rng });
      const rollDef = rollD20(getAttributeModifier(presser.attributes.dexterity), { rng: this.rng });
      const check = resolveContestedCheck(rollAtk, rollDef);

      if (check.attackerWon) {
        this.state.ballZone = 'MIDFIELD';
        return this.recordEvent({
          minute: min,
          second: sec,
          type: 'DRIBBLE_SUCCESS',
          attackingTeamId: atk.id,
          defendingTeamId: def.id,
          primaryPlayer: passer,
          secondaryPlayer: presser,
          zone: 'MIDFIELD',
          contestedCheck: check,
          decision,
          commentary: `¡Qué personalidad! ${passer.name} quiebra a ${presser.name} en su propia mitad y avanza conduciendo con soltura.`,
          score: { ...this.state.score },
        });
      } else {
        this.switchPossession();
        this.state.ballZone = 'DEFENSIVE_HALF';
        return this.recordEvent({
          minute: min,
          second: sec,
          type: 'DRIBBLE_TACKLED',
          attackingTeamId: def.id,
          defendingTeamId: atk.id,
          primaryPlayer: presser,
          secondaryPlayer: passer,
          zone: 'DEFENSIVE_HALF',
          contestedCheck: check,
          decision,
          commentary: `¡Error grave! ${passer.name} arriesgó en el regate y ${presser.name} le roba la cartera en salida de balón.`,
          score: { ...this.state.score },
        });
      }
    } else {
      // Salida en corto (hacia banda o interior)
      const target = chosen.targetPlayer || midfielder;
      const isPassToFlank = target.id === fullback.id;
      const interceptor = isPassToFlank ? presser : (isMidfielderMarked ? opposingShadow : presser);

      this.applyEffort(passer, 'LOW');
      this.applyEffort(target, 'LOW');

      const rollAtk = rollD20(chosen.d20Bonus, { rng: this.rng });
      const rollDef = rollD20(getAttributeModifier(interceptor.attributes.dexterity), { rng: this.rng });
      const check = resolveContestedCheck(rollAtk, rollDef);

      if (check.attackerWon) {
        // Si sale desde su propia área pasa a su mitad defensiva; si ya estaba en su mitad avanza a la medular
        const nextZone = this.state.ballZone === 'OWN_BOX' ? 'DEFENSIVE_HALF' : 'MIDFIELD';
        this.state.ballZone = nextZone;
        return this.recordEvent({
          minute: min,
          second: sec,
          type: 'PASS_COMPLETED',
          attackingTeamId: atk.id,
          defendingTeamId: def.id,
          primaryPlayer: passer,
          secondaryPlayer: interceptor,
          targetPlayer: target,
          zone: nextZone,
          contestedCheck: check,
          decision,
          commentary: isPassToFlank
            ? `${passer.name} encuentra el desahogo en la banda hacia ${target.name}, eludiendo con solvencia el embudo central.`
            : `${passer.name} juega con criterio en corto con ${target.name} para dar salida al balón.`,
          score: { ...this.state.score },
        });
      } else {
        this.switchPossession();
        // Si el corte fue en banda, el balón queda en la divisoria lateral, no regalado en el punto de penalti
        const turnoverZone = isPassToFlank 
          ? 'DEFENSIVE_HALF' 
          : (this.state.ballZone === 'OWN_BOX' ? 'OPPONENT_BOX' : 'ATTACKING_THIRD');
        this.state.ballZone = turnoverZone;
        return this.recordEvent({
          minute: min,
          second: sec,
          type: 'PASS_INTERCEPTED',
          attackingTeamId: def.id,
          defendingTeamId: atk.id,
          primaryPlayer: interceptor,
          secondaryPlayer: passer,
          targetPlayer: target,
          zone: turnoverZone,
          contestedCheck: check,
          decision,
          commentary: isPassToFlank
            ? `${interceptor.name} encima la salida hacia la cal y corta el avance de ${target.name}.`
            : `¡Peligro! ${interceptor.name} anticipa el pase interior de ${passer.name} y roba en zona comprometida.`,
          score: { ...this.state.score },
        });
      }
    }
  }

  private resolveMidfieldDecisions(atk: Team, def: Team, min: number, sec: number = 0): MatchEvent {
    const playmaker = getActivePlayer(atk, ['CM', 'CAM', 'CDM', 'LM', 'RM'], true);
    const defender = getActivePlayer(def, ['CDM', 'CM', 'CB'], true);
    const forward = getActivePlayer(atk, ['ST', 'LW', 'RW', 'CAM'], true, [playmaker.id]);
    const winger = getActivePlayer(atk, ['LW', 'RW'], true, [playmaker.id]);

    const intVal = playmaker.attributes.intelligence;
    const desVal = playmaker.attributes.dexterity;
    const fwdDes = forward.attributes.dexterity;
    const wingDes = winger.attributes.dexterity;

    // 1. Control orientado y avance en conducción (micro-tick de circulación)
    const optControl: TacticalOption = {
      actionType: 'CONTROL_AND_DRIVE',
      label: `Control orientado y avance 5 metros con balón dominado`,
      targetZone: 'ATTACKING_THIRD',
      utilityScore: desVal >= 14 ? 74 : 66,
      riskLevel: 'LOW',
      reason: `${playmaker.name} orienta el cuerpo, templa el juego y gana metros en conducción arrastrando marcas`,
      d20Bonus: getAttributeModifier(desVal) + this.getFatigueModifier(playmaker),
    };

    // 2. Balón al espacio al córner para la carrera al sprint del extremo
    const optChannelSprint: TacticalOption = {
      actionType: 'CHANNEL_SPRINT',
      label: `Pase en profundidad al córner para la carrera de ${winger.name}`,
      targetPlayer: winger,
      targetZone: 'ATTACKING_THIRD',
      utilityScore: wingDes >= 13 ? 84 : 64,
      riskLevel: 'MEDIUM',
      reason: `${playmaker.name} manda un envío largo al espacio hacia el banderín de córner para la zancada de ${winger.name}`,
      d20Bonus: getAttributeModifier(intVal) + this.getFatigueModifier(playmaker),
    };

    // 3. Pase filtrado vertical entre centrales
    const optThrough: TacticalOption = {
      actionType: 'THROUGH_BALL',
      label: `Pase filtrado al hueco para ${forward.name}`,
      targetPlayer: forward,
      targetZone: 'ATTACKING_THIRD',
      utilityScore: fwdDes >= 13 ? 83 : 62,
      riskLevel: 'MEDIUM',
      reason: `${forward.name} tira un desmarque de ruptura buscando la espalda del central rival`,
      d20Bonus: getAttributeModifier(intVal) + (fwdDes >= 13 ? 1 : 0) + this.getFatigueModifier(playmaker),
    };

    // 4. Apertura a banda
    const optWide: TacticalOption = {
      actionType: 'SHORT_PASS',
      label: `Abrir juego a la banda para ${winger.name}`,
      targetPlayer: winger,
      targetZone: 'ATTACKING_THIRD',
      utilityScore: atk.tactics.width === 'WIDE' ? 80 : 68,
      riskLevel: 'LOW',
      reason: `Aprovechar la amplitud de banda para estirar el bloque defensivo rival`,
      d20Bonus: getAttributeModifier(desVal) + 2 + this.getFatigueModifier(playmaker),
    };

    // 5. Regate 1vs1
    const optDribble: TacticalOption = {
      actionType: 'DRIBBLE',
      label: `Conducción individual superando línea de presión`,
      targetZone: 'ATTACKING_THIRD',
      utilityScore: desVal >= 14 ? 74 : 40,
      riskLevel: 'HIGH',
      reason: `Encarar a ${defender.name} en el 1vs1 para atraer defensores y generar superioridad`,
      d20Bonus: getAttributeModifier(desVal) + this.getFatigueModifier(playmaker),
    };

    // 6. Pase de seguridad atrás
    const optReset: TacticalOption = {
      actionType: 'SAFETY_BACKPASS',
      label: `Pase de seguridad atrás para reorganizar la posesión`,
      targetZone: 'MIDFIELD',
      utilityScore: 72,
      riskLevel: 'LOW',
      reason: `Pausar la circulación y bascular con los centrales ante la falta de huecos claros`,
      d20Bonus: getAttributeModifier(intVal) + 3 + this.getFatigueModifier(playmaker),
    };

    const rawOptions = [optControl, optChannelSprint, optThrough, optWide, optDribble, optReset];
    const evaluatedOptions = rawOptions
      .map(opt => applyPersonalityBias(playmaker, opt))
      .sort((a, b) => b.utilityScore - a.utilityScore);

    const chosen = evaluatedOptions[0];

    const decision: PlayerDecision = {
      decisionMaker: playmaker,
      chosenOption: chosen,
      evaluatedOptions,
      tacticalContext: `Construcción en el centro del campo (Minuto ${min}' ${sec ? '30"' : '00"'})`,
    };

    if (chosen.actionType === 'CONTROL_AND_DRIVE') {
      this.applyEffort(playmaker, 'MEDIUM');
      this.applyEffort(defender, 'LOW');

      const rollAtk = rollD20(chosen.d20Bonus, { rng: this.rng });
      const rollDef = rollD20(getAttributeModifier(defender.attributes.wisdom), { rng: this.rng });
      const check = resolveContestedCheck(rollAtk, rollDef);

      if (check.attackerWon) {
        this.state.ballZone = 'ATTACKING_THIRD';
        return this.recordEvent({
          minute: min,
          second: sec,
          type: 'CONTROL_AND_DRIVE',
          attackingTeamId: atk.id,
          defendingTeamId: def.id,
          primaryPlayer: playmaker,
          secondaryPlayer: defender,
          zone: 'ATTACKING_THIRD',
          contestedCheck: check,
          decision,
          commentary: `⚡ ${playmaker.name} orienta el control con categoría y avanza con balón dominado pisando tres cuartos de campo.`,
          score: { ...this.state.score },
        });
      } else {
        this.switchPossession();
        this.state.ballZone = 'DEFENSIVE_HALF';
        return this.recordEvent({
          minute: min,
          second: sec,
          type: 'DRIBBLE_TACKLED',
          attackingTeamId: def.id,
          defendingTeamId: atk.id,
          primaryPlayer: defender,
          secondaryPlayer: playmaker,
          zone: 'DEFENSIVE_HALF',
          contestedCheck: check,
          decision,
          commentary: `${defender.name} sale al paso con determinación y frena el avance de ${playmaker.name}.`,
          score: { ...this.state.score },
        });
      }
    } else if (chosen.actionType === 'CHANNEL_SPRINT') {
      this.applyEffort(playmaker, 'MEDIUM');
      this.applyEffort(winger, 'HIGH');
      this.applyEffort(defender, 'HIGH');

      const rollPlay = rollD20(chosen.d20Bonus + getAttributeModifier(wingDes), { rng: this.rng });
      const rollDef = rollD20(getAttributeModifier(defender.attributes.dexterity) + 1, { rng: this.rng });
      const check = resolveContestedCheck(rollPlay, rollDef);

      if (check.attackerWon) {
        this.state.ballZone = 'ATTACKING_THIRD';
        return this.recordEvent({
          minute: min,
          second: sec,
          type: 'CHANNEL_SPRINT',
          attackingTeamId: atk.id,
          defendingTeamId: def.id,
          primaryPlayer: playmaker,
          secondaryPlayer: defender,
          targetPlayer: winger,
          zone: 'ATTACKING_THIRD',
          contestedCheck: check,
          tacticalAdvantage: 'SPACE_EXPLOITED',
          decision,
          commentary: `🚀 ¡Balón en profundidad al córner! ${playmaker.name} lanza al espacio y ${winger.name} gana la carrera al sprint hasta la línea de fondo.`,
          score: { ...this.state.score },
        });
      } else {
        this.switchPossession();
        this.state.ballZone = 'DEFENSIVE_HALF';
        return this.recordEvent({
          minute: min,
          second: sec,
          type: 'PASS_INTERCEPTED',
          attackingTeamId: def.id,
          defendingTeamId: atk.id,
          primaryPlayer: defender,
          secondaryPlayer: playmaker,
          targetPlayer: winger,
          zone: 'DEFENSIVE_HALF',
          contestedCheck: check,
          decision,
          commentary: `${defender.name} corrige la posición con velocidad y corta el pase en profundidad hacia ${winger.name}.`,
          score: { ...this.state.score },
        });
      }
    } else if (chosen.actionType === 'SAFETY_BACKPASS') {
      this.applyEffort(playmaker, 'LOW');

      return this.recordEvent({
        minute: min,
        second: sec,
        type: 'PASS_COMPLETED',
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: playmaker,
        secondaryPlayer: defender,
        zone: 'MIDFIELD',
        decision,
        commentary: `${playmaker.name} pausa la jugada y apoya atrás en corto para conservar la posesión y reorganizar el ataque.`,
        score: { ...this.state.score },
      });
    } else {
      this.applyEffort(playmaker, chosen.actionType === 'DRIBBLE' ? 'HIGH' : 'MEDIUM');
      if (chosen.targetPlayer) this.applyEffort(chosen.targetPlayer, chosen.actionType === 'THROUGH_BALL' ? 'HIGH' : 'LOW');
      this.applyEffort(defender, 'MEDIUM');

      const rollPlay = rollD20(chosen.d20Bonus, {
        advantage: chosen.actionType === 'THROUGH_BALL' && fwdDes >= 13,
        rng: this.rng,
      });
      const rollDef = rollD20(getAttributeModifier(defender.attributes.wisdom) + 1, { rng: this.rng });
      const check = resolveContestedCheck(rollPlay, rollDef);

      if (check.attackerWon) {
        this.state.ballZone = 'ATTACKING_THIRD';
        return this.recordEvent({
          minute: min,
          second: sec,
          type: chosen.actionType === 'DRIBBLE' ? 'DRIBBLE_SUCCESS' : 'PASS_COMPLETED',
          attackingTeamId: atk.id,
          defendingTeamId: def.id,
          primaryPlayer: playmaker,
          secondaryPlayer: defender,
          targetPlayer: chosen.targetPlayer,
          zone: 'ATTACKING_THIRD',
          contestedCheck: check,
          tacticalAdvantage: chosen.actionType === 'THROUGH_BALL' ? 'SPACE_EXPLOITED' : undefined,
          decision,
          commentary: chosen.actionType === 'THROUGH_BALL'
            ? `¡Visión estelar! ${playmaker.name} filtra un balón perfecto al desmarque de ${forward.name} (D20: ${rollPlay.total} vs ${rollDef.total}).`
            : `${playmaker.name} abre con precisión a banda para ${chosen.targetPlayer?.name}, plantando al equipo en campo contrario.`,
          score: { ...this.state.score },
        });
      } else {
        this.switchPossession();
        this.state.ballZone = 'DEFENSIVE_HALF';
        return this.recordEvent({
          minute: min,
          second: sec,
          type: 'PASS_INTERCEPTED',
          attackingTeamId: def.id,
          defendingTeamId: atk.id,
          primaryPlayer: defender,
          secondaryPlayer: playmaker,
          targetPlayer: chosen.targetPlayer,
          zone: 'DEFENSIVE_HALF',
          contestedCheck: check,
          tacticalAdvantage: 'TIGHT_MARKING',
          decision,
          commentary: `${defender.name} lee la intención de ${playmaker.name} y corta el avance defensivamente.`,
          score: { ...this.state.score },
        });
      }
    }
  }

  private resolveAttackingThirdDecisions(atk: Team, def: Team, min: number, sec: number = 0): MatchEvent {
    // Determinar si la jugada transcurre por banda (extremo/lateral) o por el carril central (mediapunta/interior)
    const flankPlayer = getActivePlayer(atk, ['LW', 'RW', 'LB', 'RB'], true);
    const centralPlaymaker = getActivePlayer(atk, ['CAM', 'CM', 'ST'], true);
    const isFlankPlay = atk.tactics.width === 'WIDE' || (this.rng ? this.rng() > 0.45 : Math.random() > 0.45);

    const carrier = isFlankPlay ? flankPlayer : centralPlaymaker;
    const fullBack = getActivePlayer(def, ['LB', 'RB', 'CB'], true);
    const striker = getActivePlayer(atk, ['ST', 'CAM', 'LW', 'RW'], true, [carrier.id]);

    const carrierDes = carrier.attributes.dexterity;
    const carrierFue = carrier.attributes.strength;
    const carrierInt = carrier.attributes.intelligence;
    const isPoacher = striker.traits.includes('POACHER') || striker.attributes.strength >= 13;

    let rawOptions: TacticalOption[] = [];

    if (isFlankPlay) {
      // JUGADA POR BANDA: Centros, desborde por línea de fondo o diagonal interior
      const optCross: TacticalOption = {
        actionType: 'CROSS',
        label: `Centro al área buscando el remate de ${striker.name}`,
        targetPlayer: striker,
        targetZone: 'OPPONENT_BOX',
        utilityScore: isPoacher ? 88 : 72,
        riskLevel: 'MEDIUM',
        reason: `${carrier.name} gana línea de fondo y pone un centro medido al corazón del área para ${striker.name}`,
        d20Bonus: getAttributeModifier(carrierDes) + (striker.traits.includes('AERIAL_TOWER') ? 2 : 0) + this.getFatigueModifier(carrier),
      };

      const optDribbleBox: TacticalOption = {
        actionType: 'DRIBBLE',
        label: `Desborde 1vs1 por banda hacia línea de fondo`,
        targetZone: 'OPPONENT_BOX',
        utilityScore: carrierDes >= 14 ? 80 : 52,
        riskLevel: 'HIGH',
        reason: `Encarar a ${fullBack.name} con regate exterior para pisar área con balón dominado`,
        d20Bonus: getAttributeModifier(carrierDes) + this.getFatigueModifier(carrier),
      };

      const optLongShot: TacticalOption = {
        actionType: 'LONG_SHOT',
        label: `Diagonal hacia el interior y disparo con rosca`,
        targetZone: 'OPPONENT_BOX',
        utilityScore: carrierFue >= 14 ? 70 : 46,
        riskLevel: 'MEDIUM',
        reason: `Trazar la diagonal hacia la frontal buscando el ángulo lejano`,
        d20Bonus: getAttributeModifier(carrierFue) + this.getFatigueModifier(carrier),
      };

      rawOptions = [optCross, optDribbleBox, optLongShot];
    } else {
      // JUGADA POR EL CENTRO (CAM / CM): Pase filtrado al desmarque, apertura o tiro lejano
      const optThrough: TacticalOption = {
        actionType: 'THROUGH_BALL',
        label: `Pase filtrado al desmarque de ruptura de ${striker.name}`,
        targetPlayer: striker,
        targetZone: 'OPPONENT_BOX',
        utilityScore: striker.attributes.dexterity >= 13 ? 90 : 75,
        riskLevel: 'MEDIUM',
        reason: `${carrier.name} filtra un balón milimétrico a la espalda de los centrales para la carrera de ${striker.name}`,
        d20Bonus: getAttributeModifier(carrierInt) + 1 + this.getFatigueModifier(carrier),
      };

      const optSpread: TacticalOption = {
        actionType: 'SHORT_PASS',
        label: `Apertura a la banda para ${flankPlayer.name}`,
        targetPlayer: flankPlayer,
        targetZone: 'ATTACKING_THIRD',
        utilityScore: 78,
        riskLevel: 'LOW',
        reason: `Abrir el juego a la banda para estirar la zaga y buscar el 2vs1`,
        d20Bonus: getAttributeModifier(carrierInt) + this.getFatigueModifier(carrier),
      };

      const optEdgeShot: TacticalOption = {
        actionType: 'LONG_SHOT',
        label: `Disparo seco desde la frontal del área`,
        targetZone: 'OPPONENT_BOX',
        utilityScore: carrierFue >= 14 ? 74 : 50,
        riskLevel: 'MEDIUM',
        reason: `Probar el golpeo de media distancia ante el bloque bajo rival`,
        d20Bonus: getAttributeModifier(carrierFue) + this.getFatigueModifier(carrier),
      };

      rawOptions = [optThrough, optSpread, optEdgeShot];
    }

    const evaluatedOptions = rawOptions
      .map(opt => applyPersonalityBias(carrier, opt))
      .sort((a, b) => b.utilityScore - a.utilityScore);

    const chosen = evaluatedOptions[0];

    const decision: PlayerDecision = {
      decisionMaker: carrier,
      chosenOption: chosen,
      evaluatedOptions,
      tacticalContext: `Ataque en tres cuartos de campo (${isFlankPlay ? 'Acción por Banda' : 'Creación Interior'}) - Min ${min}' ${sec ? '30"' : '00"'}`,
    };

    this.applyEffort(carrier, chosen.actionType === 'DRIBBLE' ? 'HIGH' : 'MEDIUM');
    if (chosen.targetPlayer) this.applyEffort(chosen.targetPlayer, chosen.actionType === 'THROUGH_BALL' || chosen.actionType === 'CROSS' ? 'HIGH' : 'LOW');
    this.applyEffort(fullBack, 'MEDIUM');

    const rollAtk = rollD20(chosen.d20Bonus, {
      advantage: carrier.traits.includes('EXPLOSIVE_WINGER') || carrier.traits.includes('DRIBBLE_WIZARD'),
      rng: this.rng,
    });
    // Cobertura colectiva de la zaga y repliegue en el último tercio (+3 bono posicional)
    const rollDef = rollD20(getAttributeModifier(fullBack.attributes.dexterity) + 3, { rng: this.rng });
    const check = resolveContestedCheck(rollAtk, rollDef);

    if (check.attackerWon) {
      // ¡ÉXITO: PISA EL ÁREA RIVAL PARA DISPARAR O CENTRAR!
      this.state.ballZone = 'OPPONENT_BOX';
      const eventType: MatchEventType = chosen.actionType === 'CROSS' 
        ? 'CROSS_COMPLETED' 
        : chosen.actionType === 'DRIBBLE' 
        ? 'DRIBBLE_SUCCESS' 
        : chosen.actionType === 'THROUGH_BALL'
        ? 'THROUGH_BALL'
        : 'PASS_COMPLETED';

      const commentaryText = chosen.actionType === 'CROSS'
        ? `¡Qué centro milimétrico de ${carrier.name}! Conecta con ${striker.name} dentro del área de penalti (D20: ${rollAtk.total} vs ${rollDef.total}).`
        : chosen.actionType === 'THROUGH_BALL'
        ? `¡Visión estelar! ${carrier.name} filtra un balón quirúrgico entre centrales para ${striker.name}, que se planta dentro del área.`
        : `¡Desborde sensacional! ${carrier.name} supera a ${fullBack.name} y se mete hasta la cocina en el área rival.`;

      return this.recordEvent({
        minute: min,
        second: sec,
        type: eventType,
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: carrier,
        secondaryPlayer: fullBack,
        targetPlayer: chosen.targetPlayer || striker,
        zone: 'OPPONENT_BOX',
        contestedCheck: check,
        decision,
        commentary: commentaryText,
        score: { ...this.state.score },
      });
    } else {
      // Pérdida en tres cuartos: el defensor despeja o recupera en su propio campo
      this.switchPossession();
      this.state.ballZone = 'DEFENSIVE_HALF'; // El nuevo equipo atacante inicia desde atrás, ¡no en el centro!
      return this.recordEvent({
        minute: min,
        second: sec,
        type: 'DRIBBLE_TACKLED',
        attackingTeamId: def.id,
        defendingTeamId: atk.id,
        primaryPlayer: fullBack,
        secondaryPlayer: carrier,
        zone: 'DEFENSIVE_HALF',
        contestedCheck: check,
        decision,
        commentary: `Gran acción defensiva de ${fullBack.name} taponando la incursión de ${carrier.name} y despejando el peligro.`,
        score: { ...this.state.score },
      });
    }
  }

  private resolveBoxShot(atk: Team, def: Team, min: number, sec: number = 0): MatchEvent {
    const striker = getActivePlayer(atk, ['ST', 'LW', 'RW', 'CAM'], true);
    const keeper = getActivePlayer(def, ['GK'], false);
    const defender = getActivePlayer(def, ['CB', 'LB', 'RB'], true);

    const strikerDes = striker.attributes.dexterity;
    const strikerFue = striker.attributes.strength;
    const isPoacher = striker.traits.includes('POACHER');

    // Opciones tácticas del delantero en boca de gol
    const optPlacement: TacticalOption = {
      actionType: 'BOX_FINISH',
      label: `Disparo colocado a la escuadra`,
      targetZone: 'OPPONENT_BOX',
      utilityScore: strikerDes >= 14 ? 85 : 72,
      riskLevel: 'LOW',
      reason: `Buscar el ángulo imposible ajustando el balón al poste con rosca sutil fuera del alcance de ${keeper.name}`,
      d20Bonus: getAttributeModifier(strikerDes) + (isPoacher ? 1 : 0) + this.getFatigueModifier(striker),
    };

    const optPower: TacticalOption = {
      actionType: 'LONG_SHOT',
      label: `Fusilar con potencia a romper la red`,
      targetZone: 'OPPONENT_BOX',
      utilityScore: strikerFue >= 14 ? 82 : 70,
      riskLevel: 'MEDIUM',
      reason: `Zambombazo seco de empeine total buscando doblarle las manos a ${keeper.name}`,
      d20Bonus: getAttributeModifier(strikerFue) + this.getFatigueModifier(striker),
    };

    const optDribbleKeeper: TacticalOption = {
      actionType: 'DRIBBLE',
      label: `Regatear al portero en el mano a mano`,
      targetZone: 'OPPONENT_BOX',
      utilityScore: (strikerDes >= 15 && striker.traits.includes('DRIBBLE_WIZARD')) ? 86 : 52,
      riskLevel: 'HIGH',
      reason: `Amagar la salida de ${keeper.name} para empujarla a puerta vacía`,
      d20Bonus: getAttributeModifier(strikerDes) + this.getFatigueModifier(striker),
    };

    const rawOptions = [optPlacement, optPower, optDribbleKeeper];
    const evaluatedOptions = rawOptions
      .map(opt => applyPersonalityBias(striker, opt))
      .sort((a, b) => b.utilityScore - a.utilityScore);

    const chosen = evaluatedOptions[0];

    const decision: PlayerDecision = {
      decisionMaker: striker,
      chosenOption: chosen,
      evaluatedOptions,
      tacticalContext: `Definición en el área rival ante ${keeper.name} (OPPONENT_BOX) - Min ${min}' ${sec ? '30"' : '00"'}`,
    };

    this.applyEffort(striker, 'HIGH');
    this.applyEffort(keeper, 'HIGH');

    const rollShot = rollD20(chosen.d20Bonus, {
      criticalThreshold: isPoacher ? 18 : 20,
      advantage: chosen.actionType === 'DRIBBLE' && striker.traits.includes('DRIBBLE_WIZARD'),
      rng: this.rng,
    });

    // En F11, el portero tiene achique posicional y cobertura del central (+4 bono defensivo del arco)
    const defBonus = 4 + getAttributeModifier(defender.attributes.wisdom);
    const rollSave = rollD20(getAttributeModifier(keeper.attributes.dexterity) + defBonus, { rng: this.rng });
    const check = resolveContestedCheck(rollShot, rollSave);

    if (check.attackerWon) {
      if (atk.id === this.state.homeTeam.id) {
        this.state.score.home++;
      } else {
        this.state.score.away++;
      }

      // TRAS GOL: Saque de centro del campo por el equipo que encajó
      this.state.ballZone = 'MIDFIELD';
      this.switchPossession();

      return this.recordEvent({
        minute: min,
        second: sec,
        type: 'GOAL',
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: striker,
        secondaryPlayer: keeper,
        zone: 'OPPONENT_BOX',
        diceCheck: rollShot,
        contestedCheck: check,
        decision,
        commentary: `⚽ ¡GOOOOOOL DE ${atk.name.toUpperCase()}! ${striker.name} culmina la jugada con ${chosen.label.toLowerCase()} (Tirada D20: ${rollShot.total} ${rollShot.isCritical ? '¡NAT 20 CRÍTICO!' : ''}).`,
        score: { ...this.state.score },
      });
    } else {
      // TRAS PARADA: El portero se queda el balón en su propia área (OWN_BOX)
      this.switchPossession();
      this.state.ballZone = 'OWN_BOX';
      return this.recordEvent({
        minute: min,
        second: sec,
        type: 'SHOT_SAVED',
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: keeper,
        secondaryPlayer: striker,
        zone: 'OWN_BOX',
        contestedCheck: check,
        decision,
        commentary: `¡PARADÓN! El guardameta ${keeper.name} salva el gol bajo palos ante el intento de ${striker.name} (${chosen.label.toLowerCase()}).`,
        score: { ...this.state.score },
      });
    }
  }

  private switchPossession(): void {
    this.state.possessionTeamId = 
      this.state.possessionTeamId === this.state.homeTeam.id 
        ? this.state.awayTeam.id 
        : this.state.homeTeam.id;
  }

  private getAttackingTeam(): Team {
    return this.state.possessionTeamId === this.state.homeTeam.id 
      ? this.state.homeTeam 
      : this.state.awayTeam;
  }

  private getDefendingTeam(): Team {
    return this.state.possessionTeamId === this.state.homeTeam.id 
      ? this.state.awayTeam 
      : this.state.homeTeam;
  }

  private recordEvent(event: MatchEvent): MatchEvent {
    this.state.events.push(event);
    this.saveSnapshot();
    return event;
  }

  private saveSnapshot(): void {
    this.snapshots.push({
      currentMinute: this.state.currentMinute,
      currentSecond: this.state.currentSecond,
      currentTick: this.state.currentTick,
      score: { ...this.state.score },
      possessionTeamId: this.state.possessionTeamId,
      ballZone: this.state.ballZone,
      isFinished: this.state.isFinished,
      eventsCount: this.state.events.length,
    });
  }

  /**
   * Rebobina el estado interno del motor al instante temporal de un paso previo.
   * Permite reanudar y bifurcar la simulación desde cualquier punto auditado.
   */
  public rewindToStep(stepIndex: number): boolean {
    if (stepIndex < 0 || stepIndex >= this.snapshots.length) {
      return false;
    }

    const snap = this.snapshots[stepIndex];
    this.state = {
      ...this.state,
      currentMinute: snap.currentMinute,
      currentSecond: snap.currentSecond,
      currentTick: snap.currentTick,
      score: { ...snap.score },
      possessionTeamId: snap.possessionTeamId,
      ballZone: snap.ballZone,
      isFinished: snap.isFinished,
      events: this.state.events.slice(0, snap.eventsCount),
    };

    this.snapshots = this.snapshots.slice(0, stepIndex + 1);
    return true;
  }
}
