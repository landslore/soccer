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

    // Resolver acción según la zona donde se encuentra el balón
    switch (this.state.ballZone) {
      case 'OWN_BOX':
      case 'DEFENSIVE_HALF':
        return this.resolveBuildUp(attackingTeam, defendingTeam, minute);

      case 'MIDFIELD':
        return this.resolveMidfieldPlay(attackingTeam, defendingTeam, minute);

      case 'ATTACKING_THIRD':
        return this.resolveAttackingThird(attackingTeam, defendingTeam, minute);

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

  // --- Resoluciones Tácticas con Tiradas D20 y Movimientos de Apoyo ---

  private resolveBuildUp(atk: Team, def: Team, min: number): MatchEvent {
    // Los porteros NUNCA suben a iniciar pases arriesgados en mediocampo
    const passer = getActivePlayer(atk, ['CB', 'LB', 'RB'], true);
    const presser = getActivePlayer(def, ['ST', 'LW', 'RW'], true);
    const receiver = getActivePlayer(atk, ['CM', 'CDM', 'CAM', 'LM', 'RM'], true);

    // Movimiento táctico: ¿El receptor se desmarca ofreciendo línea de pase limpia?
    const receiverOffersOption = receiver.attributes.intelligence >= 12;
    const modPass = getAttributeModifier(passer.attributes.dexterity) + (receiverOffersOption ? 1 : 0);
    const modPress = getAttributeModifier(presser.attributes.strength);

    const rollAtk = rollD20(modPass, {
      advantage: receiverOffersOption && Math.random() > 0.4,
      rng: this.rng,
    });
    const rollDef = rollD20(modPress, { rng: this.rng });
    const check = resolveContestedCheck(rollAtk, rollDef);

    if (check.attackerWon) {
      this.state.ballZone = 'MIDFIELD';
      return this.recordEvent({
        minute: min,
        type: 'PASS_COMPLETED',
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: passer,
        secondaryPlayer: presser,
        targetPlayer: receiver,
        zone: 'MIDFIELD',
        contestedCheck: check,
        tacticalAdvantage: receiverOffersOption ? 'SPACE_EXPLOITED' : undefined,
        commentary: receiverOffersOption
          ? `${receiver.name} se desmarca ofreciendo apoyo y ${passer.name} conecta un pase limpio superando la presión de ${presser.name} (D20: ${rollAtk.total} vs ${rollDef.total}).`
          : `${passer.name} aguanta la presión de ${presser.name} y conecta en corto con ${receiver.name}.`,
        score: { ...this.state.score },
      });
    } else {
      this.switchPossession();
      this.state.ballZone = 'ATTACKING_THIRD';
      return this.recordEvent({
        minute: min,
        type: 'PASS_INTERCEPTED',
        attackingTeamId: def.id,
        defendingTeamId: atk.id,
        primaryPlayer: presser,
        secondaryPlayer: passer,
        targetPlayer: receiver,
        zone: 'ATTACKING_THIRD',
        contestedCheck: check,
        commentary: `¡Robo en salida! ${presser.name} anticipa la línea de pase de ${passer.name} hacia ${receiver.name}.`,
        score: { ...this.state.score },
      });
    }
  }

  private resolveMidfieldPlay(atk: Team, def: Team, min: number): MatchEvent {
    const playmaker = getActivePlayer(atk, ['CM', 'CAM', 'CDM', 'LM', 'RM'], true);
    const defender = getActivePlayer(def, ['CDM', 'CM', 'CB'], true);
    const forward = getActivePlayer(atk, ['ST', 'LW', 'RW', 'CAM'], true);

    // Movimiento táctico: ¿El delantero tira un desmarque al hueco a la espalda de los centrales?
    const runsInBehind = forward.attributes.dexterity >= 13;
    const hasIntTrait = playmaker.traits.includes('SET_PIECE_SPECIALIST') || playmaker.traits.includes('COLD_BLOODED');

    const rollPlay = rollD20(getAttributeModifier(playmaker.attributes.intelligence), {
      advantage: (hasIntTrait || runsInBehind) && Math.random() > 0.45,
      rng: this.rng,
    });
    // La defensa balancea y bascula con sabiduría táctica
    const rollDef = rollD20(getAttributeModifier(defender.attributes.wisdom) + 1, { rng: this.rng });
    const check = resolveContestedCheck(rollPlay, rollDef);

    if (check.attackerWon) {
      this.state.ballZone = 'ATTACKING_THIRD';
      return this.recordEvent({
        minute: min,
        type: 'PASS_COMPLETED',
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: playmaker,
        secondaryPlayer: defender,
        targetPlayer: forward,
        zone: 'ATTACKING_THIRD',
        contestedCheck: check,
        tacticalAdvantage: runsInBehind ? 'SPACE_EXPLOITED' : undefined,
        commentary: runsInBehind
          ? `¡Desmarque al hueco de ${forward.name}! ${playmaker.name} lee el movimiento y filtra un pase con ventaja táctica (D20: ${rollPlay.total} vs ${rollDef.total}).`
          : `${playmaker.name} hace circular el balón encontrando a ${forward.name} en tres cuartos de campo.`,
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
        primaryPlayer: defender,
        secondaryPlayer: playmaker,
        targetPlayer: forward,
        zone: 'MIDFIELD',
        contestedCheck: check,
        tacticalAdvantage: 'TIGHT_MARKING',
        commentary: `La defensa rival balancea bien las líneas y ${defender.name} intercepta el pase de ${playmaker.name}.`,
        score: { ...this.state.score },
      });
    }
  }

  private resolveAttackingThird(atk: Team, def: Team, min: number): MatchEvent {
    const winger = getActivePlayer(atk, ['LW', 'RW', 'CAM', 'ST'], true);
    const fullBack = getActivePlayer(def, ['LB', 'RB', 'CB'], true);
    const targetStriker = getActivePlayer(atk, ['ST', 'CAM'], true);

    const isExplosive = winger.traits.includes('EXPLOSIVE_WINGER') || winger.traits.includes('DRIBBLE_WIZARD');
    const rollWinger = rollD20(getAttributeModifier(winger.attributes.dexterity), {
      advantage: isExplosive && Math.random() > 0.4,
      rng: this.rng,
    });
    // Cobertura del central (+2 bono táctico de repliegue)
    const rollBack = rollD20(getAttributeModifier(fullBack.attributes.dexterity) + 2, { rng: this.rng });
    const check = resolveContestedCheck(rollWinger, rollBack);

    // Solo un desborde claro penetra al área pequeña
    if (check.attackerWon && check.diff >= 3) {
      this.state.ballZone = 'OPPONENT_BOX';
      return this.recordEvent({
        minute: min,
        type: 'DRIBBLE_SUCCESS',
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: winger,
        secondaryPlayer: fullBack,
        targetPlayer: targetStriker,
        zone: 'OPPONENT_BOX',
        contestedCheck: check,
        commentary: `¡Gran jugada! ${winger.name} desborda a ${fullBack.name} y pisa el área rival con peligro (D20: ${rollWinger.total} vs ${rollBack.total}).`,
        score: { ...this.state.score },
      });
    } else if (check.attackerWon) {
      return this.recordEvent({
        minute: min,
        type: 'PASS_COMPLETED',
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: winger,
        secondaryPlayer: fullBack,
        targetPlayer: targetStriker,
        zone: 'ATTACKING_THIRD',
        contestedCheck: check,
        commentary: `${winger.name} aguanta la entrada de ${fullBack.name} y apoya en corto hacia ${targetStriker.name}.`,
        score: { ...this.state.score },
      });
    } else {
      this.switchPossession();
      this.state.ballZone = 'DEFENSIVE_HALF';
      return this.recordEvent({
        minute: min,
        type: 'DRIBBLE_TACKLED',
        attackingTeamId: def.id,
        defendingTeamId: atk.id,
        primaryPlayer: fullBack,
        secondaryPlayer: winger,
        zone: 'DEFENSIVE_HALF',
        contestedCheck: check,
        commentary: `Excelente corte de ${fullBack.name} cerrando la internada de ${winger.name}.`,
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

    // En F11, el portero tiene cobertura del central
    const defBonus = 2 + getAttributeModifier(defender.attributes.wisdom);
    const rollSave = rollD20(getAttributeModifier(keeper.attributes.dexterity) + defBonus, { rng: this.rng });
    const check = resolveContestedCheck(rollShot, rollSave);

    if (check.attackerWon) {
      if (atk.id === this.state.homeTeam.id) {
        this.state.score.home++;
      } else {
        this.state.score.away++;
      }

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
      this.switchPossession();
      this.state.ballZone = 'DEFENSIVE_HALF';
      return this.recordEvent({
        minute: min,
        type: 'SHOT_SAVED',
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: keeper,
        secondaryPlayer: striker,
        zone: 'DEFENSIVE_HALF',
        contestedCheck: check,
        commentary: `¡PARADÓN! El guardameta ${keeper.name} salva el gol bajo palos ante el remate de ${striker.name}.`,
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
