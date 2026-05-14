/* Fixture builder for the BreakOut harness. Generates a deterministic
 * tournament fixture (24 teams + 51 matches, no winners recorded) that
 * the harness intercepts Supabase requests to return.
 *
 * To keep the renderer happy we re-use the same matchData shape produced
 * by templateModSe12_12To64() in index.html. Since the harness runs in
 * Node and can't easily import the page's helpers, we replicate the
 * generation logic here verbatim.
 */
'use strict';

const SEED_ORDER_16 = [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11];

function gen12Bracket(label) {
  const matches = [];
  for (let i = 0; i < 8; i++) {
    const topSeed = SEED_ORDER_16[i * 2];
    const botSeed = SEED_ORDER_16[i * 2 + 1];
    const topReal = topSeed <= 12 ? topSeed : null;
    const botReal = botSeed <= 12 ? botSeed : null;
    if (topReal && botReal) {
      matches.push({ id: label + '-R1-M' + i, bracket: label, round: 1, slot: i, is_bye: false,
                     top_seed: topReal, bot_seed: botReal });
    } else {
      const seededTeam = topReal || botReal;
      matches.push({ id: label + '-R1-BYE' + i, bracket: label, round: 1, slot: i, is_bye: true,
                     top_seed: seededTeam, bot_seed: null });
    }
  }
  for (let i = 0; i < 4; i++) {
    matches.push({ id: label + '-R2-M' + (i + 1), bracket: label, round: 2, slot: i, is_bye: false,
                   top_from: { match_id: matches[i * 2].id, kind: 'winner' },
                   bot_from: { match_id: matches[i * 2 + 1].id, kind: 'winner' } });
  }
  const r2 = matches.filter(m => m.round === 2);
  for (let i = 0; i < 2; i++) {
    matches.push({ id: label + '-R3-M' + (i + 1), bracket: label, round: 3, slot: i, is_bye: false,
                   top_from: { match_id: r2[i * 2].id, kind: 'winner' },
                   bot_from: { match_id: r2[i * 2 + 1].id, kind: 'winner' } });
  }
  const r3 = matches.filter(m => m.round === 3);
  matches.push({ id: label + '-R4-M1', bracket: label, round: 4, slot: 0, is_bye: false,
                 top_from: { match_id: r3[0].id, kind: 'winner' },
                 bot_from: { match_id: r3[1].id, kind: 'winner' } });
  return matches;
}

function gen64Bracket() {
  const matches = [];
  const aR1Real = [1, 3, 5, 7].map(i => 'A-R1-M' + i);
  const aR2     = [1, 2, 3, 4].map(i => 'A-R2-M' + i);
  const bR1Real = [1, 3, 5, 7].map(i => 'B-R1-M' + i);
  const bR2     = [1, 2, 3, 4].map(i => 'B-R2-M' + i);
  for (let i = 0; i < 4; i++) {
    matches.push({ id: '64-R1-M' + (i + 1), bracket: '64', round: 1, slot: i, is_bye: false,
                   top_from: { match_id: aR1Real[i], kind: 'loser' },
                   bot_from: { match_id: aR2[i], kind: 'loser' } });
  }
  for (let i = 0; i < 4; i++) {
    matches.push({ id: '64-R1-M' + (i + 5), bracket: '64', round: 1, slot: i + 4, is_bye: false,
                   top_from: { match_id: bR1Real[i], kind: 'loser' },
                   bot_from: { match_id: bR2[i], kind: 'loser' } });
  }
  for (let i = 0; i < 4; i++) {
    matches.push({ id: '64-R2-M' + (i + 1), bracket: '64', round: 2, slot: i, is_bye: false,
                   top_from: { match_id: '64-R1-M' + (i * 2 + 1), kind: 'winner' },
                   bot_from: { match_id: '64-R1-M' + (i * 2 + 2), kind: 'winner' } });
  }
  const integ = [
    ['64-R3-M1', 'A-R3-M1', '64-R2-M1'],
    ['64-R3-M2', 'A-R3-M2', '64-R2-M2'],
    ['64-R3-M3', 'B-R3-M1', '64-R2-M3'],
    ['64-R3-M4', 'B-R3-M2', '64-R2-M4']
  ];
  integ.forEach((row, idx) => {
    const [id, loserSrc, winnerSrc] = row;
    matches.push({ id, bracket: '64', round: 3, slot: idx, is_bye: false,
                   top_from: { match_id: loserSrc, kind: 'loser' },
                   bot_from: { match_id: winnerSrc, kind: 'winner' } });
  });
  for (let i = 0; i < 2; i++) {
    matches.push({ id: '64-R4-M' + (i + 1), bracket: '64', round: 4, slot: i, is_bye: false,
                   top_from: { match_id: '64-R3-M' + (i * 2 + 1), kind: 'winner' },
                   bot_from: { match_id: '64-R3-M' + (i * 2 + 2), kind: 'winner' } });
  }
  matches.push({ id: '64-R5-M1', bracket: '64', round: 5, slot: 0, is_bye: false,
                 top_from: { match_id: 'A-R4-M1', kind: 'loser' },
                 bot_from: { match_id: '64-R4-M1', kind: 'winner' } });
  matches.push({ id: '64-R5-M2', bracket: '64', round: 5, slot: 1, is_bye: false,
                 top_from: { match_id: 'B-R4-M1', kind: 'loser' },
                 bot_from: { match_id: '64-R4-M2', kind: 'winner' } });
  matches.push({ id: '64-R6-M1', bracket: '64', round: 6, slot: 0, is_bye: false,
                 top_from: { match_id: '64-R5-M1', kind: 'winner' },
                 bot_from: { match_id: '64-R5-M2', kind: 'winner' } });
  return matches;
}

const TEMPLATE_SCHEDULES = {
  twelve: [
    { day: 'Saturday', time: '9:00 AM',  payout: null },
    { day: 'Saturday', time: '10:30 AM', payout: null },
    { day: 'Saturday', time: '12:00 PM', payout: 100 },
    { day: 'Saturday', time: '1:30 PM',  payout: 400 }
  ],
  sixtyfour: [
    { day: 'Saturday', time: '11:00 AM', payout: null },
    { day: 'Saturday', time: '1:00 PM',  payout: null },
    { day: 'Saturday', time: '3:00 PM',  payout: null },
    { day: 'Saturday', time: '5:00 PM',  payout: null },
    { day: 'Sunday',   time: '10:00 AM', payout: 100 },
    { day: 'Sunday',   time: '12:00 PM', payout: 600 }
  ]
};

function applyTemplateSchedule(matchData) {
  for (const m of matchData) {
    const sched = (m.bracket === '64' ? TEMPLATE_SCHEDULES.sixtyfour : TEMPLATE_SCHEDULES.twelve)[m.round - 1];
    if (sched) { m.day = sched.day; m.time = sched.time; m.payout = sched.payout; }
  }
}

function assignMatchNumbers(matchData) {
  const bracketOrder = ['A', 'B', '64'];
  let no = 1;
  for (const bracket of bracketOrder) {
    const inBracket = matchData.filter(m => m.bracket === bracket);
    if (!inBracket.length) continue;
    const maxRound = Math.max(...inBracket.map(m => m.round));
    for (let r = 1; r <= maxRound; r++) {
      inBracket.filter(m => m.round === r)
               .sort((a, b) => a.slot - b.slot)
               .forEach(m => { m.match_no = no++; });
    }
  }
}

function assignTableNumbers(matchData) {
  for (const bracket of ['A', 'B', '64']) {
    for (let r = 1; r <= 6; r++) {
      const ms = matchData.filter(m => m.bracket === bracket && m.round === r && !m.is_bye)
                          .sort((a, b) => a.slot - b.slot);
      ms.forEach((m, idx) => { m.table_no = idx + 1; });
    }
  }
}

function buildTemplate() {
  const md = [...gen12Bracket('A'), ...gen12Bracket('B'), ...gen64Bracket()];
  applyTemplateSchedule(md);
  assignMatchNumbers(md);
  assignTableNumbers(md);
  return md;
}

function buildTeams() {
  const names = [
    'Alpha Strike', 'Bravo Brigade', 'Charlie Chaos', 'Delta Force',
    'Echo Eight', 'Foxtrot Five', 'Golf Gladiators', 'Hotel Hustlers',
    'India Ink', 'Juliet Jinx', 'Kilo Killers', 'Lima Lions',
    'Mike Mavericks', 'November Nines', 'Oscar Outlaws', 'Papa Pool Sharks',
    'Quebec Queens', 'Romeo Renegades', 'Sierra Snipers', 'Tango Titans',
    'Uniform Underdogs', 'Victor Vipers', 'Whiskey Warriors', 'Xray Xpress'
  ];
  return names.map((n, i) => ({
    id: 'team-' + (i + 1),
    number: 1000 + i + 1,
    name: n
  }));
}

function buildTournamentRow() {
  return {
    id: 'fixture-tournament-id',
    slug: 'test-fixture',
    name: 'BreakOut Test Fixture',
    status: 'live',
    start_date: '2026-06-20',
    end_date:   '2026-06-21',
    venue_name: 'Test Venue',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-14T00:00:00Z',
    matches: buildTemplate(),
    seed_assignments: null,
    config: { bracketChampText: 'Bracket Champ', championText: 'Champion' }
  };
}

module.exports = { buildTeams, buildTournamentRow };
