import { Player, PlayerAttributes, PersonalityTrait, SoccerPosition } from './types';
import { createPRNG } from './d20';

const FIRST_NAMES = [
  'Hugo', 'Mateo', 'Lucas', 'Martín', 'Leo', 'Daniel', 'Alejandro', 'Pablo',
  'Manuel', 'Álvaro', 'Adrián', 'David', 'Mario', 'Diego', 'Marcos', 'Javier',
  'Carlos', 'Iker', 'Sergio', 'Alex', 'Nicolás', 'Gonzalo', 'Rodrigo', 'Gael',
  'Brais', 'Antón', 'Roi', 'Xoel', 'Iago', 'Bruno', 'Samuel', 'Jorge'
];

const LAST_NAMES = [
  'García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez',
  'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno',
  'Álvarez', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro', 'Torres', 'Domínguez',
  'Vázquez', 'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina', 'Castro'
];

const TRAITS_POOL: PersonalityTrait[] = [
  'COLD_BLOODED',
  'SET_PIECE_SPECIALIST',
  'AERIAL_TOWER',
  'EXPLOSIVE_WINGER',
  'DEFENSIVE_GENERAL',
  'POACHER',
  'ANCHOR_TACKLER',
  'DRIBBLE_WIZARD'
];

interface PositionRequirement {
  pos: SoccerPosition;
  min: number;
  max: number;
  primaryAttr: keyof PlayerAttributes;
  secondaryAttr: keyof PlayerAttributes;
  suitedTraits: PersonalityTrait[];
}

const POSITION_PROFILES: PositionRequirement[] = [
  { pos: 'GK', min: 2, max: 2, primaryAttr: 'dexterity', secondaryAttr: 'wisdom', suitedTraits: ['COLD_BLOODED'] },
  { pos: 'CB', min: 3, max: 4, primaryAttr: 'strength', secondaryAttr: 'wisdom', suitedTraits: ['AERIAL_TOWER', 'DEFENSIVE_GENERAL', 'ANCHOR_TACKLER'] },
  { pos: 'LB', min: 1, max: 2, primaryAttr: 'dexterity', secondaryAttr: 'constitution', suitedTraits: ['EXPLOSIVE_WINGER', 'SET_PIECE_SPECIALIST'] },
  { pos: 'RB', min: 1, max: 2, primaryAttr: 'dexterity', secondaryAttr: 'constitution', suitedTraits: ['EXPLOSIVE_WINGER', 'ANCHOR_TACKLER'] },
  { pos: 'CDM', min: 2, max: 2, primaryAttr: 'wisdom', secondaryAttr: 'strength', suitedTraits: ['ANCHOR_TACKLER', 'DEFENSIVE_GENERAL'] },
  { pos: 'CM', min: 2, max: 3, primaryAttr: 'intelligence', secondaryAttr: 'constitution', suitedTraits: ['SET_PIECE_SPECIALIST', 'COLD_BLOODED'] },
  { pos: 'CAM', min: 1, max: 2, primaryAttr: 'intelligence', secondaryAttr: 'dexterity', suitedTraits: ['DRIBBLE_WIZARD', 'SET_PIECE_SPECIALIST'] },
  { pos: 'LM', min: 1, max: 2, primaryAttr: 'dexterity', secondaryAttr: 'intelligence', suitedTraits: ['EXPLOSIVE_WINGER', 'DRIBBLE_WIZARD'] },
  { pos: 'RM', min: 1, max: 2, primaryAttr: 'dexterity', secondaryAttr: 'intelligence', suitedTraits: ['EXPLOSIVE_WINGER', 'DRIBBLE_WIZARD'] },
  { pos: 'ST', min: 2, max: 3, primaryAttr: 'strength', secondaryAttr: 'dexterity', suitedTraits: ['POACHER', 'AERIAL_TOWER', 'COLD_BLOODED'] },
  { pos: 'LW', min: 1, max: 2, primaryAttr: 'dexterity', secondaryAttr: 'strength', suitedTraits: ['DRIBBLE_WIZARD', 'EXPLOSIVE_WINGER'] },
  { pos: 'RW', min: 1, max: 2, primaryAttr: 'dexterity', secondaryAttr: 'strength', suitedTraits: ['DRIBBLE_WIZARD', 'EXPLOSIVE_WINGER'] },
];

/**
 * Genera una plantilla procedural equilibrada de 18 a 20 jugadores de Fútbol 11 para un club dado.
 */
export function generateTeamRoster(teamId: string | number, teamSeed: number): Player[] {
  const rng = createPRNG(teamSeed);
  const roster: Player[] = [];
  let squadNumber = 1;

  for (const profile of POSITION_PROFILES) {
    const count = profile.min;
    for (let i = 0; i < count; i++) {
      const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
      const name = `${firstName} ${lastName}`;

      // Atributos base entre 8 y 16, con bonos a atributos principales
      const baseStats: PlayerAttributes = {
        strength: Math.floor(rng() * 7) + 9,     // 9 - 15
        dexterity: Math.floor(rng() * 7) + 9,    // 9 - 15
        constitution: Math.floor(rng() * 7) + 9, // 9 - 15
        intelligence: Math.floor(rng() * 7) + 9, // 9 - 15
        wisdom: Math.floor(rng() * 7) + 9,       // 9 - 15
        charisma: Math.floor(rng() * 7) + 9,     // 9 - 15
      };

      // Potenciar atributos según perfil de posición (+2 a +3)
      baseStats[profile.primaryAttr] = Math.min(18, baseStats[profile.primaryAttr] + Math.floor(rng() * 2) + 2);
      baseStats[profile.secondaryAttr] = Math.min(18, baseStats[profile.secondaryAttr] + Math.floor(rng() * 2) + 1);

      // Asignar 1 o 2 rasgos de personalidad
      const traits: PersonalityTrait[] = [];
      if (profile.suitedTraits.length > 0 && rng() > 0.3) {
        traits.push(profile.suitedTraits[Math.floor(rng() * profile.suitedTraits.length)]);
      }
      if (rng() > 0.6) {
        const randomTrait = TRAITS_POOL[Math.floor(rng() * TRAITS_POOL.length)];
        if (!traits.includes(randomTrait)) {
          traits.push(randomTrait);
        }
      }

      roster.push({
        id: `ply_${teamId}_${squadNumber}`,
        name,
        number: squadNumber,
        position: profile.pos,
        attributes: baseStats,
        traits,
        stamina: 100,
        morale: 0,
        cards: { yellow: 0, red: false }
      });

      squadNumber++;
    }
  }

  return roster;
}

/**
 * Selecciona una alineación titular de 11 jugadores basada en la formación táctica elegida.
 */
export function getDefaultLineup(roster: Player[], formation: string = '4-3-3'): string[] {
  // Orden ideal según 4-3-3: 1 GK, 2 CB, 1 LB, 1 RB, 1 CDM, 2 CM (o CAM), 1 ST, 1 LW, 1 RW
  const targetPositions: SoccerPosition[] = formation === '4-3-3' 
    ? ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'ST', 'RW']
    : ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CDM', 'RM', 'ST', 'ST']; // 4-4-2 fallback

  const chosenIds: string[] = [];
  const available = [...roster];

  for (const pos of targetPositions) {
    const candidateIdx = available.findIndex(p => p.position === pos);
    if (candidateIdx >= 0) {
      chosenIds.push(available[candidateIdx].id);
      available.splice(candidateIdx, 1);
    } else {
      // Tomar el mejor disponible
      if (available.length > 0) {
        chosenIds.push(available[0].id);
        available.splice(0, 1);
      }
    }
  }

  return chosenIds.slice(0, 11);
}
