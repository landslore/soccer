// Dominio de Entidades y Tipos para D20 Soccer Manager (Fútbol 11)

export type SoccerPosition = 
  | 'GK'               // Portero
  | 'CB' | 'LB' | 'RB' // Defensas (Central, Lateral Izquierdo, Lateral Derecho)
  | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' // Mediocampistas (Pivote, Mediocentro, Mediapunta, Interior Izq/Der)
  | 'ST' | 'LW' | 'RW'; // Delanteros (Punta / Centrodelantero, Extremo Izq/Der)

export type F11Formation = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2' | '5-3-2';

export interface PlayerAttributes {
  strength: number;     // FUE (8-18): Golpeo potente, choque físico, duelos aéreos
  dexterity: number;    // DES (8-18): Velocidad punta, regate, centros precisos, reflejos portero
  constitution: number; // CON (8-18): Resistencia a fatiga, recuperación física tras sprint
  intelligence: number; // INT (8-18): Visión de juego, pase al hueco, cambio de banda
  wisdom: number;       // SAB (8-18): Posicionamiento táctico, intercepciones, tirar fuera de juego
  charisma: number;     // CAR (8-18): Liderazgo moral, capitanía, templanza en penaltis
}

export type PersonalityTrait = 
  | 'COLD_BLOODED'          // Sangre fría en minutos finales (75-90')
  | 'SET_PIECE_SPECIALIST'  // Especialista a balón parado (+3 en faltas/córners)
  | 'AERIAL_TOWER'          // Torre aérea (ventaja en duelos de cabeza)
  | 'EXPLOSIVE_WINGER'      // Extremo explosivo (ventaja en primer desborde)
  | 'DEFENSIVE_GENERAL'     // Mariscal defensivo (+1 SAB a la línea defensiva)
  | 'POACHER'               // Cazagoles (crítico con 18-20 dentro del área)
  | 'ANCHOR_TACKLER'        // Pivote destructor (+2 en entradas, riesgo de tarjeta)
  | 'DRIBBLE_WIZARD';       // Mago del regate (ventaja en 1vs1)

export interface Player {
  readonly id: string;
  readonly name: string;
  readonly number: number;
  readonly position: SoccerPosition;
  readonly attributes: PlayerAttributes;
  readonly traits: PersonalityTrait[];
  stamina: number; // 0 a 100
  morale: number;  // -2 a +2
  cards: { yellow: number; red: boolean };
}

export interface TeamTactics {
  formation: F11Formation;
  tempo: 'SLOW_BUILDUP' | 'BALANCED' | 'FAST_TRANSITION';
  mentality: 'DEFENSIVE' | 'BALANCED' | 'ALL_OUT_ATTACK';
  pressingLevel: 'LOW_BLOCK' | 'MID_FIELD' | 'HIGH_PRESS';
  width: 'NARROW' | 'BALANCED' | 'WIDE';
}

export interface TeamStats {
  position: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  form: string; // Ej: "VVEP" o "PPEP"
}

export interface Team {
  readonly id: number | string;
  readonly key: string;
  readonly name: string;
  readonly shortName?: string;
  readonly badgeUrl: string;
  readonly sourceOrigin: 'ECM_MADRID' | 'SANTACRUZ_FUTGAL';
  readonly groupNumber: number;
  readonly groupName: string;
  readonly defaultField?: string;
  readonly stats: TeamStats;
  readonly roster: Player[]; // Plantilla completa (18-22 jugadores)
  lineup: string[];          // IDs de los 11 titulares
  tactics: TeamTactics;
}

export interface MatchFixture {
  readonly id: number | string;
  readonly round: number;
  readonly groupNumber: number;
  readonly dateText: string;
  readonly timeText: string;
  readonly field: string;
  readonly homeTeamId: number | string;
  readonly awayTeamId: number | string;
  homeGoals: number | null;
  awayGoals: number | null;
  played: boolean;
}

export interface CompetitionGroup {
  readonly id: number;
  readonly number: number;
  readonly name: string;
  readonly teams: Team[];
  readonly fixtures: MatchFixture[];
}

export interface LeagueDatabase {
  readonly updatedAt: string;
  readonly groups: CompetitionGroup[];
  readonly teams: Record<string, Team>;
}
