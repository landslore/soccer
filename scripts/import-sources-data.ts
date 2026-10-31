import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  CompetitionGroup, 
  LeagueDatabase, 
  MatchFixture, 
  Team, 
  TeamStats 
} from '../src/domain/types';
import { generateTeamRoster, getDefaultLineup } from '../src/domain/procedural-roster';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCES_ECM_PATH = '/Users/israelvinualeslopez/sources/docs/data.json';
const SOURCES_SANTACRUZ_PATH = '/Users/israelvinualeslopez/sources/santacruz-2026/docs/data.json';
const OUTPUT_FILE = path.resolve(__dirname, '../src/data/league-data.json');

async function main() {
  console.log('🔄 Iniciando ingestión no invasiva desde sources...');

  if (!fs.existsSync(SOURCES_ECM_PATH)) {
    throw new Error(`No se encontró el fichero ECM en ${SOURCES_ECM_PATH}`);
  }
  if (!fs.existsSync(SOURCES_SANTACRUZ_PATH)) {
    throw new Error(`No se encontró el fichero Santa Cruz en ${SOURCES_SANTACRUZ_PATH}`);
  }

  const ecmRaw = JSON.parse(fs.readFileSync(SOURCES_ECM_PATH, 'utf-8'));
  const santacruzRaw = JSON.parse(fs.readFileSync(SOURCES_SANTACRUZ_PATH, 'utf-8'));

  const groups: CompetitionGroup[] = [];
  const allTeams: Record<string, Team> = {};

  let globalTeamIndex = 1;

  // 1. Procesar los 8 Grupos de ECM Madrid
  if (Array.isArray(ecmRaw.groups)) {
    for (const g of ecmRaw.groups) {
      const groupNum = g.numero || groups.length + 1;
      const groupName = g.nombreCompleto || g.nombre || `Grupo ${groupNum} (Madrid)`;
      const groupTeams: Team[] = [];
      const groupFixtures: MatchFixture[] = [];

      // Extraer equipos de standings / clasificacion
      const standingsList = g.clasificacion || g.standings || [];
      for (const row of standingsList) {
        const teamKey = row.equipoKey || row.equipo || `ecm_${row.idEquipo}`;
        const teamId = row.idEquipo || globalTeamIndex;
        const name = row.equipo || row.nombre || teamKey;
        const badgeUrl = row.escudo || '';

        const stats: TeamStats = {
          position: row.posicion || 1,
          points: row.puntos || 0,
          played: row.pj || 0,
          won: row.pg || 0,
          drawn: row.pe || 0,
          lost: row.pp || 0,
          goalsFor: row.gf || 0,
          goalsAgainst: row.gc || 0,
          goalDiff: row.diff || (row.gf || 0) - (row.gc || 0),
          form: 'E',
        };

        const roster = generateTeamRoster(teamId, globalTeamIndex * 997);
        const lineup = getDefaultLineup(roster, '4-3-3');

        const team: Team = {
          id: teamId,
          key: teamKey,
          name,
          badgeUrl,
          sourceOrigin: 'ECM_MADRID',
          groupNumber: groupNum,
          groupName,
          stats,
          roster,
          lineup,
          tactics: {
            formation: '4-3-3',
            tempo: 'BALANCED',
            mentality: 'BALANCED',
            pressingLevel: 'MID_FIELD',
            width: 'BALANCED',
          },
        };

        groupTeams.push(team);
        allTeams[String(teamId)] = team;
        globalTeamIndex++;
      }

      // Extraer jornadas
      const roundsList = g.jornadas || g.rounds || [];
      for (const round of roundsList) {
        const rNum = round.numero || round.round || 1;
        const matches = round.partidos || round.matches || [];
        for (const m of matches) {
          groupFixtures.push({
            id: m.id || `${groupNum}_${rNum}_${m.idEquipoLocal}_${m.idEquipoVisitante}`,
            round: rNum,
            groupNumber: groupNum,
            dateText: m.fechaCorta || m.fechaHoraTexto || 'Fecha por definir',
            timeText: m.horaTexto || '',
            field: m.direccion || 'Campo Municipal',
            homeTeamId: m.idEquipoLocal,
            awayTeamId: m.idEquipoVisitante,
            homeGoals: typeof m.golesLocalNum === 'number' ? m.golesLocalNum : null,
            awayGoals: typeof m.golesVisitanteNum === 'number' ? m.golesVisitanteNum : null,
            played: Boolean(m.jugado || m.cerrado),
          });
        }
      }

      groups.push({
        id: groupNum,
        number: groupNum,
        name: groupName,
        teams: groupTeams,
        fixtures: groupFixtures,
      });
    }
  }

  // 2. Procesar Grupo 9 con Santa Cruz (Primera Futgal)
  const santacruzGroupNum = 9;
  const santacruzGroupName = 'Grupo 9 - División Futgal (Galicia)';
  const scTeams: Team[] = [];
  const scFixtures: MatchFixture[] = [];

  const scClasif = santacruzRaw.clasificacion || [];
  for (const row of scClasif) {
    const teamId = row.id || `sc_${globalTeamIndex}`;
    const name = row.nombre || `Equipo ${teamId}`;
    const badgeUrl = row.escudo || '';
    const stats: TeamStats = {
      position: row.posicion || 1,
      points: row.puntos || 0,
      played: row.pj || 0,
      won: row.pg || 0,
      drawn: row.pe || 0,
      lost: row.pp || 0,
      goalsFor: row.gf || 0,
      goalsAgainst: row.gc || 0,
      goalDiff: row.diff || (row.gf || 0) - (row.gc || 0),
      form: row.forma || 'E',
    };

    const roster = generateTeamRoster(teamId, globalTeamIndex * 733);
    const lineup = getDefaultLineup(roster, '4-3-3');

    const team: Team = {
      id: teamId,
      key: `sc_${teamId}`,
      name,
      badgeUrl,
      sourceOrigin: 'SANTACRUZ_FUTGAL',
      groupNumber: santacruzGroupNum,
      groupName: santacruzGroupName,
      defaultField: row.campo || 'Torre Nº 5',
      stats,
      roster,
      lineup,
      tactics: {
        formation: '4-3-3',
        tempo: 'FAST_TRANSITION',
        mentality: 'BALANCED',
        pressingLevel: 'HIGH_PRESS',
        width: 'WIDE',
      },
    };

    scTeams.push(team);
    allTeams[String(teamId)] = team;
    globalTeamIndex++;
  }

  // Jornadas de Santa Cruz
  const scJornadas = santacruzRaw.jornadas || [];
  for (const j of scJornadas) {
    const rNum = j.jornada || j.numero || 1;
    const matches = j.partidos || [];
    for (const m of matches) {
      scFixtures.push({
        id: m.id || `sc_${rNum}_${m.equipoLocalId}_${m.equipoVisitanteId}`,
        round: rNum,
        groupNumber: santacruzGroupNum,
        dateText: m.fecha || 'Fecha por definir',
        timeText: m.hora || '',
        field: m.campo || 'Torre Nº 5',
        homeTeamId: m.equipoLocalId,
        awayTeamId: m.equipoVisitanteId,
        homeGoals: typeof m.golesLocal === 'number' ? m.golesLocal : null,
        awayGoals: typeof m.golesVisitante === 'number' ? m.golesVisitante : null,
        played: typeof m.golesLocal === 'number',
      });
    }
  }

  groups.push({
    id: santacruzGroupNum,
    number: santacruzGroupNum,
    name: santacruzGroupName,
    teams: scTeams,
    fixtures: scFixtures,
  });

  const database: LeagueDatabase = {
    updatedAt: new Date().toISOString(),
    groups,
    teams: allTeams,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(database, null, 2), 'utf-8');

  console.log(`✅ Base de datos generada con éxito en ${OUTPUT_FILE}`);
  console.log(`📊 Total Grupos: ${groups.length}`);
  console.log(`👥 Total Equipos de Fútbol 11: ${Object.keys(allTeams).length}`);
}

main().catch(err => {
  console.error('❌ Error en la importación:', err);
  process.exit(1);
});
