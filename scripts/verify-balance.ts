import { MatchEngine } from '../src/domain/match-engine';
import { generateTeamRoster, getDefaultLineup } from '../src/domain/procedural-roster';
import { Team } from '../src/domain/types';

function createDummyTeam(id: string, name: string, seed: number): Team {
  const roster = generateTeamRoster(id, seed);
  return {
    id,
    key: id,
    name,
    badgeUrl: '',
    sourceOrigin: 'ECM_MADRID',
    groupNumber: 1,
    groupName: 'Grupo 1',
    stats: {
      position: 1,
      points: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      form: 'E',
    },
    roster,
    lineup: getDefaultLineup(roster, '4-3-3'),
    tactics: {
      formation: '4-3-3',
      tempo: 'BALANCED',
      mentality: 'BALANCED',
      pressingLevel: 'MID_FIELD',
      width: 'BALANCED',
    },
  };
}

async function runMonteCarlo() {
  console.log('🎲 Iniciando verificación estadística de balanceo Monte Carlo (Fútbol 11)...');

  const teamA = createDummyTeam('teamA', 'Real Madrid D20', 101);
  const teamB = createDummyTeam('teamB', 'FC Barcelona D20', 202);

  const NUM_MATCHES = 1000;
  let totalGoals = 0;
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;

  const startMs = Date.now();

  for (let i = 0; i < NUM_MATCHES; i++) {
    const engine = new MatchEngine(teamA, teamB, i * 499 + 17);
    const finalState = engine.simulateFullMatch();
    const gHome = finalState.score.home;
    const gAway = finalState.score.away;

    totalGoals += gHome + gAway;

    if (gHome > gAway) homeWins++;
    else if (gAway > gHome) awayWins++;
    else draws++;
  }

  const elapsedMs = Date.now() - startMs;
  const avgGoals = totalGoals / NUM_MATCHES;

  console.log(`⏱️  Simulados ${NUM_MATCHES} partidos en ${elapsedMs} ms (${(NUM_MATCHES / (elapsedMs / 1000)).toFixed(0)} partidos/seg)`);
  console.log(`⚽ Promedio de goles por partido: ${avgGoals.toFixed(2)}`);
  console.log(`🏆 Victorias Local: ${((homeWins / NUM_MATCHES) * 100).toFixed(1)}%`);
  console.log(`🤝 Empates: ${((draws / NUM_MATCHES) * 100).toFixed(1)}%`);
  console.log(`✈️  Victorias Visitante: ${((awayWins / NUM_MATCHES) * 100).toFixed(1)}%`);

  // Verificaciones de Calibración
  if (avgGoals < 1.8 || avgGoals > 4.2) {
    throw new Error(`❌ Calibración fallida: el promedio de goles (${avgGoals.toFixed(2)}) está fuera del rango objetivo para F11 [1.8, 4.2]`);
  }

  console.log('✅ Balance estadístico Monte Carlo verificado con éxito.');
}

runMonteCarlo().catch(err => {
  console.error('❌ Error en test de balanceo:', err);
  process.exit(1);
});

