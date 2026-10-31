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
  readonly zone: PitchZone;
  readonly diceCheck?: DiceCheckResult;
  readonly contestedCheck?: ContestedCheckResult;
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
 */
function getActivePlayer(team: Team, positions: SoccerPosition[]): Player {
  const starters = team.roster.filter(p => team.lineup.includes(p.id));
  const candidate = starters.find(p => positions.includes(p.position));
  if (candidate) return candidate;
  return starters[Math.floor(Math.random() * starters.length)] || team.roster[0];
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

  // --- Resoluciones Tácticas con Tiradas D20 ---

  private resolveBuildUp(atk: Team, def: Team, min: number): MatchEvent {
    const passer = getActivePlayer(atk, ['CB', 'LB', 'RB', 'GK']);
    const presser = getActivePlayer(def, ['ST', 'LW', 'RW']);

    const modPass = getAttributeModifier(passer.attributes.dexterity);
    const modPress = getAttributeModifier(presser.attributes.strength);

    const rollAtk = rollD20(modPass, { rng: this.rng });
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
        zone: 'MIDFIELD',
        contestedCheck: check,
        commentary: `${passer.name} supera la presión inicial y conecta con el mediocampo (D20: ${rollAtk.total} vs ${rollDef.total}).`,
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
        zone: 'ATTACKING_THIRD',
        contestedCheck: check,
        commentary: `¡Robo peligroso! ${presser.name} intercepta la salida de balón de ${passer.name}.`,
        score: { ...this.state.score },
      });
    }
  }

  private resolveMidfieldPlay(atk: Team, def: Team, min: number): MatchEvent {
    const playmaker = getActivePlayer(atk, ['CM', 'CAM', 'CDM', 'LM', 'RM']);
    const defender = getActivePlayer(def, ['CDM', 'CM', 'CB']);

    const hasIntTrait = playmaker.traits.includes('SET_PIECE_SPECIALIST') || playmaker.traits.includes('COLD_BLOODED');
    const rollPlay = rollD20(getAttributeModifier(playmaker.attributes.intelligence), {
      advantage: hasIntTrait && Math.random() > 0.5,
      rng: this.rng,
    });
    const rollDef = rollD20(getAttributeModifier(defender.attributes.wisdom), { rng: this.rng });
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
        zone: 'ATTACKING_THIRD',
        contestedCheck: check,
        commentary: `${playmaker.name} encuentra el hueco y filtra un balón a tres cuartos de campo (D20: ${rollPlay.total} vs ${rollDef.total}).`,
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
        zone: 'MIDFIELD',
        contestedCheck: check,
        commentary: `${defender.name} lee la intención del pase y recupera el control del balón.`,
        score: { ...this.state.score },
      });
    }
  }

  private resolveAttackingThird(atk: Team, def: Team, min: number): MatchEvent {
    const winger = getActivePlayer(atk, ['LW', 'RW', 'CAM', 'ST']);
    const fullBack = getActivePlayer(def, ['LB', 'RB', 'CB']);

    const isExplosive = winger.traits.includes('EXPLOSIVE_WINGER') || winger.traits.includes('DRIBBLE_WIZARD');
    const rollWinger = rollD20(getAttributeModifier(winger.attributes.dexterity), {
      advantage: isExplosive && Math.random() > 0.4,
      rng: this.rng,
    });
    // La defensa en campo grande cuenta con cobertura del central (+2 bono táctico de repliegue)
    const rollBack = rollD20(getAttributeModifier(fullBack.attributes.dexterity) + 2, { rng: this.rng });
    const check = resolveContestedCheck(rollWinger, rollBack);

    // Solo un desborde claro (victoria por > 2) penetra al área pequeña; victoria ajustada mantiene balón en 3/4
    if (check.attackerWon && check.diff >= 3) {
      this.state.ballZone = 'OPPONENT_BOX';
      return this.recordEvent({
        minute: min,
        type: 'DRIBBLE_SUCCESS',
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: winger,
        secondaryPlayer: fullBack,
        zone: 'OPPONENT_BOX',
        contestedCheck: check,
        commentary: `¡Gran jugada! ${winger.name} desborda a ${fullBack.name} y pisa el área rival con peligro (D20: ${rollWinger.total} vs ${rollBack.total}).`,
        score: { ...this.state.score },
      });
    } else if (check.attackerWon) {
      // Retiene el balón en tres cuartos
      return this.recordEvent({
        minute: min,
        type: 'PASS_COMPLETED',
        attackingTeamId: atk.id,
        defendingTeamId: def.id,
        primaryPlayer: winger,
        zone: 'ATTACKING_THIRD',
        contestedCheck: check,
        commentary: `${winger.name} aguanta la entrada pero la defensa cierra el paso al área. Balón circulando.`,
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
        commentary: `Excelente corte de ${fullBack.name} frenando la internada de ${winger.name}.`,
        score: { ...this.state.score },
      });
    }
  }

  private resolveBoxShot(atk: Team, def: Team, min: number): MatchEvent {
    const striker = getActivePlayer(atk, ['ST', 'LW', 'RW', 'CAM']);
    const keeper = getActivePlayer(def, ['GK']);
    const defender = getActivePlayer(def, ['CB']);

    const isPoacher = striker.traits.includes('POACHER');
    const rollShot = rollD20(getAttributeModifier(striker.attributes.strength), {
      criticalThreshold: isPoacher ? 18 : 20,
      rng: this.rng,
    });

    // En F11, el portero tiene cobertura del central (+2 a la defensa del arco)
    const defBonus = 2 + getAttributeModifier(defender.attributes.wisdom);
    const rollSave = rollD20(getAttributeModifier(keeper.attributes.dexterity) + defBonus, { rng: this.rng });
    const check = resolveContestedCheck(rollShot, rollSave);

    // Se requiere ganar la tirada enfrentada para marcar
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
        commentary: `¡PARADÓN! El guardameta ${keeper.name} salva el gol con una estirada providencial.`,
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
