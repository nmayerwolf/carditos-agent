export interface FixtureTeam {
  name: string;
  type: 'competitivo' | 'formativo';
}

export interface FixtureMatch {
  court: string;
  home: string;
  away: string;
}

export interface FixtureRound {
  matches: FixtureMatch[];
}

export interface FixtureInput {
  courts: string[];
  teams: FixtureTeam[];
  max_matches: number;
  mixed?: boolean;
  category: string;
}

export interface FixtureOutput {
  category: string;
  rounds: FixtureRound[];
}

function buildPairs(teams: FixtureTeam[], mixed: boolean): [FixtureTeam, FixtureTeam][] {
  const pairs: [FixtureTeam, FixtureTeam][] = [];

  if (mixed) {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        pairs.push([teams[i], teams[j]]);
      }
    }
    return pairs;
  }

  for (const type of ['competitivo', 'formativo'] as const) {
    const group = teams.filter((t) => t.type === type);
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.push([group[i], group[j]]);
      }
    }
  }

  return pairs;
}

export function generateFixture(input: FixtureInput): FixtureOutput {
  const { courts, teams, max_matches, mixed = false, category } = input;

  const pairs = buildPairs(teams, mixed).slice(0, max_matches);

  const rounds: FixtureRound[] = [];
  let i = 0;

  while (i < pairs.length) {
    const roundMatches: FixtureMatch[] = [];
    for (let c = 0; c < courts.length && i < pairs.length; c++, i++) {
      roundMatches.push({
        court: courts[c],
        home: pairs[i][0].name,
        away: pairs[i][1].name,
      });
    }
    rounds.push({ matches: roundMatches });
  }

  return { category, rounds };
}

export function formatFixture(output: FixtureOutput): string {
  const lines: string[] = [`🏉 Fixture ${output.category}`];

  for (let i = 0; i < output.rounds.length; i++) {
    lines.push('');
    lines.push(`*Ronda ${i + 1}*`);
    for (const match of output.rounds[i].matches) {
      lines.push(`C${match.court} · ${match.home} vs ${match.away}`);
    }
  }

  return lines.join('\n');
}
