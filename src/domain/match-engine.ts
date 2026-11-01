import { Player, Team, SoccerPosition } from './types';
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
  score: { home: number; away: number };
  possessionTeamId: string | number;
  ballZone: PitchZone;
  events: MatchEvent[];
  isFinished: boolean;
}

export interface EngineSnapshot {
  readonly currentMinute: number;
  readonly score: { home: number; away: number };
  readonly possessionTeamId: string | number;
  readonly ballZone: PitchZone;
  readonly isFinished: boolean;
  readonly eventsCount: number;
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
      score: { home: 0, away: 0 },
      possessionTeamId: homeTeam.id,
      ballZone: 'MIDFIELD',
      events: [],
      isFinished: false,
    };

    this.recordEvent({
      minute: 0,
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

  /**
   * Ejecuta 1 minuto de simulación táctica basada en tiradas D20.
   */
  public step(): MatchEvent | null {
    if (this.state.isFinished) return null;

    this.state.currentMinute++;
    const minute = this.state.currentMinute;

    if (minute === 45) {
      return this.recordEvent({
        minute: 45,
        type: 'HALF_TIME',
        attackingTeamId: this.state.possessionTeamId,
        defendingTeamId: this.getDefendingTeam().id,
        zone: 'MIDFIELD',
        commentary: `Descanso. Marcador: ${this.state.homeTeam.name} ${this.state.score.home} - ${this.state.score.away} ${this.state.awayTeam.name}.`,
        score: { ...this.state.score },
      });
    }

    if (minute >= 90) {
      this.state.isFinished = true;
      return this.recordEvent({
        minute: 90,
        type: 'FULL_TIME',
        attackingTeamId: this.state.possessionTeamId,
        defendingTeamId: this.getDefendingTeam().id,
        zone: 'MIDFIELD',
        commentary: `¡Final del partido! Resultado: ${this.state.homeTeam.name} ${this.state.score.home} - ${this.state.score.away} ${this.state.awayTeam.name}.`,
        score: { ...this.state.score },
      });
    }

    const attackingTeam = this.getAttackingTeam();
    const defendingTeam = this.getDefendingTeam();

    // 1. Resolver según la zona del balón mediante el motor de evaluación táctica
    switch (this.state.ballZone) {
      case 'OWN_BOX':
      case 'DEFENSIVE_HALF':
        return this.resolveBuildUpOrCounter(attackingTeam, defendingTeam, minute);

      case 'MIDFIELD':
        return this.resolveMidfieldDecisions(attackingTeam, defendingTeam, minute);

      case 'ATTACKING_THIRD':
        return this.resolveAttackingThirdDecisions(attackingTeam, defendingTeam, minute);

      case 'OPPONENT_BOX':
        return this.resolveBoxShot(attackingTeam, defendingTeam, minute);

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

  private resolveBuildUpOrCounter(atk: Team, def: Team, min: number): MatchEvent {
    const passer = getActivePlayer(atk, ['CB', 'LB', 'RB'], true);
    const presser = getActivePlayer(def, ['ST', 'LW', 'RW'], true);
    const midfielder = getActivePlayer(atk, ['CM', 'CDM', 'CAM', 'LM', 'RM'], true, [passer.id]);
    const forward = getActivePlayer(atk, ['ST', 'LW', 'RW'], true, [passer.id]);

    const passerInt = passer.attributes.intelligence;
    const passerDes = passer.attributes.dexterity;
    const modPass = getAttributeModifier(passerDes);

    // Evaluar opciones de salida
    const isCounterAdvantage = atk.tactics.tempo === 'FAST_TRANSITION' && forward.attributes.dexterity >= 13;

    const optShort: TacticalOption = {
      actionType: 'SHORT_PASS',
      label: `Pase seguro en corto a ${midfielder.name}`,
      targetPlayer: midfielder,
      targetZone: 'MIDFIELD',
      utilityScore: isCounterAdvantage ? 55 : 82,
      riskLevel: 'LOW',
      reason: `Asegurar posesión y dar salida limpia ante la presión de ${presser.name}`,
      d20Bonus: modPass + 1,
    };

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
      d20Bonus: getAttributeModifier(passerInt),
    };

    const evaluatedOptions = [optShort, optCounter];
    const chosen = isCounterAdvantage ? optCounter : optShort;

    const decision: PlayerDecision = {
      decisionMaker: passer,
      chosenOption: chosen,
      evaluatedOptions,
      tacticalContext: `Salida de balón en campo propio (${this.state.ballZone})`,
    };

    if (chosen.actionType === 'COUNTER_ATTACK') {
      const rollAtk = rollD20(chosen.d20Bonus, { advantage: true, rng: this.rng });
      const rollDef = rollD20(getAttributeModifier(presser.attributes.strength), { rng: this.rng });
      const check = resolveContestedCheck(rollAtk, rollDef);

      if (check.attackerWon) {
        this.state.ballZone = 'ATTACKING_THIRD'; // Salta directo a tres cuartos (sin volver al centro)
        return this.recordEvent({
          minute: min,
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
          commentary: `⚡ ¡CONTRAGOLPE RÁPIDO! ${passer.name} mete un pase largo que rompe la presión rival y encuentra la carrera de ${forward.name}.`,
          score: { ...this.state.score },
        });
      } else {
        this.switchPossession();
        this.state.ballZone = 'MIDFIELD';
        return this.recordEvent({
          minute: min,
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
    } else {
      // Salida en corto
      const rollAtk = rollD20(chosen.d20Bonus, { rng: this.rng });
      const rollDef = rollD20(getAttributeModifier(presser.attributes.strength), { rng: this.rng });
      const check = resolveContestedCheck(rollAtk, rollDef);

      if (check.attackerWon) {
        // Si sale desde su propia área pasa a su mitad defensiva; si ya estaba en su mitad avanza a la medular
        const nextZone = this.state.ballZone === 'OWN_BOX' ? 'DEFENSIVE_HALF' : 'MIDFIELD';
        this.state.ballZone = nextZone;
        return this.recordEvent({
          minute: min,
          type: 'PASS_COMPLETED',
          attackingTeamId: atk.id,
          defendingTeamId: def.id,
          primaryPlayer: passer,
          secondaryPlayer: presser,
          targetPlayer: midfielder,
          zone: nextZone,
          contestedCheck: check,
          decision,
          commentary: `${passer.name} juega con criterio en corto con ${midfielder.name} para dar salida al balón.`,
          score: { ...this.state.score },
        });
      } else {
        this.switchPossession();
        const turnoverZone = this.state.ballZone === 'OWN_BOX' ? 'OPPONENT_BOX' : 'ATTACKING_THIRD';
        this.state.ballZone = turnoverZone;
        return this.recordEvent({
          minute: min,
          type: 'PASS_INTERCEPTED',
          attackingTeamId: def.id,
          defendingTeamId: atk.id,
          primaryPlayer: presser,
          secondaryPlayer: passer,
          targetPlayer: midfielder,
          zone: turnoverZone,
          contestedCheck: check,
          decision,
          commentary: `¡Peligro! ${presser.name} corta el pase de ${passer.name} en zona comprometida.`,
          score: { ...this.state.score },
        });
      }
    }
  }

  private resolveMidfieldDecisions(atk: Team, def: Team, min: number): MatchEvent {
    const playmaker = getActivePlayer(atk, ['CM', 'CAM', 'CDM', 'LM', 'RM'], true);
    const defender = getActivePlayer(def, ['CDM', 'CM', 'CB'], true);
    const forward = getActivePlayer(atk, ['ST', 'LW', 'RW', 'CAM'], true, [playmaker.id]);
    const winger = getActivePlayer(atk, ['LW', 'RW'], true, [playmaker.id]);

    const intVal = playmaker.attributes.intelligence;
    const desVal = playmaker.attributes.dexterity;
    const fwdDes = forward.attributes.dexterity;

    const optThrough: TacticalOption = {
      actionType: 'THROUGH_BALL',
      label: `Pase filtrado al hueco para ${forward.name}`,
      targetPlayer: forward,
      targetZone: 'ATTACKING_THIRD',
      utilityScore: fwdDes >= 13 ? 85 : 60,
      riskLevel: 'MEDIUM',
      reason: `${forward.name} tira un desmarque al hueco buscando la espalda del central rival`,
      d20Bonus: getAttributeModifier(intVal) + (fwdDes >= 13 ? 1 : 0),
    };

    const optWide: TacticalOption = {
      actionType: 'SHORT_PASS',
      label: `Abrir juego a la banda para ${winger.name}`,
      targetPlayer: winger,
      targetZone: 'ATTACKING_THIRD',
      utilityScore: atk.tactics.width === 'WIDE' ? 82 : 70,
      riskLevel: 'LOW',
      reason: `Aprovechar la amplitud de banda para estirar el bloque defensivo rival`,
      d20Bonus: getAttributeModifier(desVal) + 2,
    };

    const optDribble: TacticalOption = {
      actionType: 'DRIBBLE',
      label: `Conducción individual superando línea de presión`,
      targetZone: 'ATTACKING_THIRD',
      utilityScore: desVal >= 14 ? 75 : 40,
      riskLevel: 'HIGH',
      reason: `Encarar en el 1vs1 para atraer defensores y generar superioridad`,
      d20Bonus: getAttributeModifier(desVal),
    };

    const evaluatedOptions = [optThrough, optWide, optDribble].sort((a, b) => b.utilityScore - a.utilityScore);
    const chosen = evaluatedOptions[0];

    const decision: PlayerDecision = {
      decisionMaker: playmaker,
      chosenOption: chosen,
      evaluatedOptions,
      tacticalContext: `Construcción en el centro del campo (Minuto ${min}')`,
    };

    const rollPlay = rollD20(chosen.d20Bonus, {
      advantage: chosen.actionType === 'THROUGH_BALL' && fwdDes >= 13,
      rng: this.rng,
    });
    const rollDef = rollD20(getAttributeModifier(defender.attributes.wisdom) + 1, { rng: this.rng });
    const check = resolveContestedCheck(rollPlay, rollDef);

    if (check.attackerWon) {
      this.state.ballZone = 'ATTACKING_THIRD'; // AVANZA A TRES CUARTOS
      return this.recordEvent({
        minute: min,
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
      // ¡NO vuelve forzadamente al centro si fue corte en 3/4!
      this.state.ballZone = 'DEFENSIVE_HALF';
      return this.recordEvent({
        minute: min,
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

  private resolveAttackingThirdDecisions(atk: Team, def: Team, min: number): MatchEvent {
    // Determinar si la jugada transcurre por banda (extremo/lateral) o por el carril central (mediapunta/interior)
    const flankPlayer = getActivePlayer(atk, ['LW', 'RW', 'LB', 'RB'], true);
    const centralPlaymaker = getActivePlayer(atk, ['CAM', 'CM', 'ST'], true);
    const isFlankPlay = atk.tactics.width === 'WIDE' || (this.rng ? this.rng() > 0.45 : Math.random() > 0.45);

    const carrier = isFlankPlay ? flankPlayer : centralPlaymaker;
    const fullBack = getActivePlayer(def, ['LB', 'RB', 'CB'], true);
    // El rematador o receptor del pase NUNCA puede ser el portador del balón
    const striker = getActivePlayer(atk, ['ST', 'CAM', 'LW', 'RW'], true, [carrier.id]);

    const carrierDes = carrier.attributes.dexterity;
    const carrierFue = carrier.attributes.strength;
    const carrierInt = carrier.attributes.intelligence;
    const isPoacher = striker.traits.includes('POACHER') || striker.attributes.strength >= 13;

    let evaluatedOptions: TacticalOption[] = [];

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
        d20Bonus: getAttributeModifier(carrierDes) + (striker.traits.includes('AERIAL_TOWER') ? 2 : 0),
      };

      const optDribbleBox: TacticalOption = {
        actionType: 'DRIBBLE',
        label: `Desborde 1vs1 por banda hacia línea de fondo`,
        targetZone: 'OPPONENT_BOX',
        utilityScore: carrierDes >= 14 ? 80 : 52,
        riskLevel: 'HIGH',
        reason: `Encarar a ${fullBack.name} con regate exterior para pisar área con balón dominado`,
        d20Bonus: getAttributeModifier(carrierDes),
      };

      const optLongShot: TacticalOption = {
        actionType: 'LONG_SHOT',
        label: `Diagonal hacia el interior y disparo con rosca`,
        targetZone: 'OPPONENT_BOX',
        utilityScore: carrierFue >= 14 ? 70 : 46,
        riskLevel: 'MEDIUM',
        reason: `Trazar la diagonal hacia la frontal buscando el ángulo lejano`,
        d20Bonus: getAttributeModifier(carrierFue),
      };

      evaluatedOptions = [optCross, optDribbleBox, optLongShot].sort((a, b) => b.utilityScore - a.utilityScore);
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
        d20Bonus: getAttributeModifier(carrierInt) + 1,
      };

      const optSpread: TacticalOption = {
        actionType: 'SHORT_PASS',
        label: `Apertura a la banda para ${flankPlayer.name}`,
        targetPlayer: flankPlayer,
        targetZone: 'ATTACKING_THIRD',
        utilityScore: 78,
        riskLevel: 'LOW',
        reason: `Abrir el juego a la banda para estirar la zaga y buscar el 2vs1`,
        d20Bonus: getAttributeModifier(carrierInt),
      };

      const optEdgeShot: TacticalOption = {
        actionType: 'LONG_SHOT',
        label: `Disparo seco desde la frontal del área`,
        targetZone: 'OPPONENT_BOX',
        utilityScore: carrierFue >= 14 ? 74 : 50,
        riskLevel: 'MEDIUM',
        reason: `Probar el golpeo de media distancia ante el bloque bajo rival`,
        d20Bonus: getAttributeModifier(carrierFue),
      };

      evaluatedOptions = [optThrough, optSpread, optEdgeShot].sort((a, b) => b.utilityScore - a.utilityScore);
    }

    const chosen = evaluatedOptions[0];

    const decision: PlayerDecision = {
      decisionMaker: carrier,
      chosenOption: chosen,
      evaluatedOptions,
      tacticalContext: `Ataque en tres cuartos de campo (${isFlankPlay ? 'Acción por Banda' : 'Creación Interior'})`,
    };

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

  private resolveBoxShot(atk: Team, def: Team, min: number): MatchEvent {
    const striker = getActivePlayer(atk, ['ST', 'LW', 'RW', 'CAM'], true);
    const keeper = getActivePlayer(def, ['GK'], false); // ¡Aquí y solo aquí actúa el portero!
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
      d20Bonus: getAttributeModifier(strikerDes) + (isPoacher ? 1 : 0),
    };

    const optPower: TacticalOption = {
      actionType: 'LONG_SHOT',
      label: `Fusilar con potencia a romper la red`,
      targetZone: 'OPPONENT_BOX',
      utilityScore: strikerFue >= 14 ? 82 : 70,
      riskLevel: 'MEDIUM',
      reason: `Zambombazo seco de empeine total buscando doblarle las manos a ${keeper.name}`,
      d20Bonus: getAttributeModifier(strikerFue),
    };

    const optDribbleKeeper: TacticalOption = {
      actionType: 'DRIBBLE',
      label: `Regatear al portero en el mano a mano`,
      targetZone: 'OPPONENT_BOX',
      utilityScore: (strikerDes >= 15 && striker.traits.includes('DRIBBLE_WIZARD')) ? 86 : 52,
      riskLevel: 'HIGH',
      reason: `Amagar la salida de ${keeper.name} para empujarla a puerta vacía`,
      d20Bonus: getAttributeModifier(strikerDes),
    };

    const evaluatedOptions = [optPlacement, optPower, optDribbleKeeper].sort((a, b) => b.utilityScore - a.utilityScore);
    const chosen = evaluatedOptions[0];

    const decision: PlayerDecision = {
      decisionMaker: striker,
      chosenOption: chosen,
      evaluatedOptions,
      tacticalContext: `Definición en el área rival ante ${keeper.name} (OPPONENT_BOX)`,
    };

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
