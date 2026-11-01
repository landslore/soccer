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

/**
 * Encuentra el jugador titular más adecuado para una acción según posición.
 * Si excludeGK es true, jamás devuelve al portero (vital para jugadas fuera del área).
 */
function getActivePlayer(team: Team, positions: SoccerPosition[], excludeGK: boolean = true): Player {
  const starters = team.roster.filter(p => team.lineup.includes(p.id));
  const candidate = starters.find(p => positions.includes(p.position));
  if (candidate && (!excludeGK || candidate.position !== 'GK')) {
    return candidate;
  }
  const pool = excludeGK ? starters.filter(p => p.position !== 'GK') : starters;
  return pool[Math.floor(Math.random() * pool.length)] || team.roster[0];
}

export class MatchEngine {
  private state: MatchState;
  private rng: () => number;

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
    const midfielder = getActivePlayer(atk, ['CM', 'CDM', 'CAM', 'LM', 'RM'], true);
    const forward = getActivePlayer(atk, ['ST', 'LW', 'RW'], true);

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
    const forward = getActivePlayer(atk, ['ST', 'LW', 'RW', 'CAM'], true);
    const winger = getActivePlayer(atk, ['LW', 'RW'], true);

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
    const winger = getActivePlayer(atk, ['LW', 'RW', 'CAM', 'ST'], true);
    const fullBack = getActivePlayer(def, ['LB', 'RB', 'CB'], true);
    const striker = getActivePlayer(atk, ['ST', 'CAM'], true);

    const wingerDes = winger.attributes.dexterity;
    const wingerFue = winger.attributes.strength;
    const isPoacher = striker.traits.includes('POACHER') || striker.attributes.strength >= 13;

    // Opciones en zona de ataque
    const optCross: TacticalOption = {
      actionType: 'CROSS',
      label: `Centro al área buscando el remate de ${striker.name}`,
      targetPlayer: striker,
      targetZone: 'OPPONENT_BOX',
      utilityScore: isPoacher ? 86 : 68,
      riskLevel: 'MEDIUM',
      reason: `Aprovechar el posicionamiento de ${striker.name} en el punto de penalti para remate franco`,
      d20Bonus: getAttributeModifier(wingerDes) + (striker.traits.includes('AERIAL_TOWER') ? 2 : 0),
    };

    const optDribbleBox: TacticalOption = {
      actionType: 'DRIBBLE',
      label: `Desborde 1vs1 hacia línea de fondo`,
      targetZone: 'OPPONENT_BOX',
      utilityScore: wingerDes >= 14 ? 80 : 50,
      riskLevel: 'HIGH',
      reason: `Encarar a ${fullBack.name} para pisar área con balón dominado`,
      d20Bonus: getAttributeModifier(wingerDes),
    };

    const optLongShot: TacticalOption = {
      actionType: 'LONG_SHOT',
      label: `Disparo potente desde la frontal del área`,
      targetZone: 'OPPONENT_BOX',
      utilityScore: wingerFue >= 14 ? 72 : 45,
      riskLevel: 'MEDIUM',
      reason: `Probar el tiro de media distancia ante el repliegue rival`,
      d20Bonus: getAttributeModifier(wingerFue),
    };

    const evaluatedOptions = [optCross, optDribbleBox, optLongShot].sort((a, b) => b.utilityScore - a.utilityScore);
    const chosen = evaluatedOptions[0];

    const decision: PlayerDecision = {
      decisionMaker: winger,
      chosenOption: chosen,
      evaluatedOptions,
      tacticalContext: `Ataque en tres cuartos de campo rival (${this.state.ballZone})`,
    };

    const rollAtk = rollD20(chosen.d20Bonus, {
      advantage: winger.traits.includes('EXPLOSIVE_WINGER'),
      rng: this.rng,
    });
    // Cobertura colectiva de la zaga en el último tercio
    const rollDef = rollD20(getAttributeModifier(fullBack.attributes.dexterity) + 2, { rng: this.rng });
    const check = resolveContestedCheck(rollAtk, rollDef);

    if (check.attackerWon) {
      // ¡ÉXITO: PISA EL ÁREA RIVAL PARA DISPARAR O CENTRAR!
      this.state.ballZone = 'OPPONENT_BOX';
      return this.recordEvent({
        minute: min,
        type: chosen.actionType === 'CROSS' ? 'CROSS_COMPLETED' : 'DRIBBLE_SUCCESS',
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: winger,
        secondaryPlayer: fullBack,
        targetPlayer: striker,
        zone: 'OPPONENT_BOX',
        contestedCheck: check,
        decision,
        commentary: chosen.actionType === 'CROSS'
          ? `¡Qué centro milimétrico de ${winger.name}! Conecta con ${striker.name} dentro del área pequeña (D20: ${rollAtk.total} vs ${rollDef.total}).`
          : `¡Desborde sensacional! ${winger.name} supera a ${fullBack.name} y se mete hasta la cocina en el área rival.`,
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
        secondaryPlayer: winger,
        zone: 'DEFENSIVE_HALF',
        contestedCheck: check,
        decision,
        commentary: `Gran acción defensiva de ${fullBack.name} taponando la incursión de ${winger.name} y despejando el peligro.`,
        score: { ...this.state.score },
      });
    }
  }

  private resolveBoxShot(atk: Team, def: Team, min: number): MatchEvent {
    const striker = getActivePlayer(atk, ['ST', 'LW', 'RW', 'CAM'], true);
    const keeper = getActivePlayer(def, ['GK'], false); // ¡Aquí y solo aquí actúa el portero!
    const defender = getActivePlayer(def, ['CB'], true);

    const isPoacher = striker.traits.includes('POACHER');
    const rollShot = rollD20(getAttributeModifier(striker.attributes.strength), {
      criticalThreshold: isPoacher ? 18 : 20,
      rng: this.rng,
    });

    // En F11, el portero tiene achique posicional y cobertura del central (+3 bono defensivo del arco)
    const defBonus = 3 + getAttributeModifier(defender.attributes.wisdom);
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
        commentary: `⚽ ¡GOOOOOOL DE ${atk.name.toUpperCase()}! ${striker.name} fusila las redes (Tirada D20: ${rollShot.total} ${rollShot.isCritical ? '¡NAT 20 CRÍTICO!' : ''}).`,
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
        commentary: `¡PARADÓN! El guardameta ${keeper.name} salva el gol bajo palos y asegura el esférico en su área.`,
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
    return event;
  }
}
