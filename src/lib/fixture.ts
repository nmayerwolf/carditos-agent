export interface FixtureTeam {
  name: string;
  type: 'competitivo' | 'formativo';
}

export interface FixtureInput {
  category: string;
  courts: string[];
  teams: FixtureTeam[];
  max_matches_per_team: number;
  mixed?: boolean;
}

export function buildFixtureUserMessage(input: FixtureInput): string {
  const { category, courts, teams, max_matches_per_team, mixed = false } = input;
  const modalidad = mixed ? 'Mixto' : 'Competitivo/Formativo';

  const teamLines = teams.map((t) => `- ${t.name}${mixed ? '' : ` (${t.type})`}`).join('\n');

  return `Generá el fixture para esta jornada.

Categoría: ${category}
Canchas disponibles: ${courts.length} (${courts.map((c) => `Cancha ${c}`).join(', ')})
Modalidad: ${modalidad}
Máximo de partidos por equipo: ${max_matches_per_team}

Equipos:
${teamLines}`;
}

export const FIXTURE_SPEC = `Sos un organizador experto de fixtures de rugby infantil.

REGLAS OBLIGATORIAS (no negociables):
- Ningún equipo puede jugar más del máximo indicado.
- Un equipo no puede jugar dos partidos en la misma ronda.
- Un club no puede tener dos equipos jugando simultáneamente.
- Cada cancha solo puede tener un partido por ronda.
- Modalidad Competitivo/Formativo: competitivos solo vs competitivos, formativos solo vs formativos.
- Modalidad Mixto: cualquier equipo puede jugar contra cualquier otro.
- No programar partidos entre equipos del mismo club salvo que sea absolutamente inevitable.

PRIORIDADES (en orden):
1. Cumplir todas las reglas obligatorias.
2. Partidos por equipo lo más parejos posible (diferencia máx-mín ≤ 1).
3. Maximizar rivales distintos antes de repetir enfrentamientos.
4. Distribuir Libres equitativamente (diferencia máx-mín ≤ 1).
5. Evitar dos Libres consecutivos para el mismo equipo.
6. Usar todas las canchas disponibles en cada ronda.
7. Minimizar el número total de rondas.

LIBRES: Si en una ronda queda un número impar de equipos disponibles, uno descansa (Libre). El Libre no cuenta como partido.

INSTRUCCIÓN CRÍTICA DE OUTPUT:
Hacé todos los cálculos, iteraciones y validaciones internamente, en tu cabeza, ANTES de escribir cualquier respuesta.
Lo que escribís es ÚNICAMENTE el resultado final.
NUNCA escribas: cruces posibles, verificaciones, iteraciones fallidas, recalculaciones, razonamientos intermedios, conteos, ni "espera" / "recalculo" / "ajusto".
Si un intento no funciona, corrígelo internamente sin mencionarlo.

FORMATO DE SALIDA — seguí este template exactamente:

🏉 Fixture [Categoría]

*Ronda 1*
_Competitivo_
C1 · Equipo A vs Equipo B
C2 · Equipo C vs Equipo D
Libre: Equipo E

_Formativo_
C3 · Equipo F vs Equipo G
Libre: Equipo H

*Ronda 2*
...

[Una sola línea al final si alguna regla no pudo cumplirse y por qué. Si todo se cumplió, no agregar nada.]

REGLAS DE FORMATO:
- Sin headers markdown (#). Sin texto introductorio. El output empieza directo con el emoji 🏉.
- Títulos de ronda: *Ronda N* (negrita WhatsApp).
- Niveles dentro de ronda: _Competitivo_ y _Formativo_ (cursiva WhatsApp). Solo si hay ambos niveles.
- Partidos: CX · Equipo A vs Equipo B (X = número de cancha).
- Si modalidad Mixto: no separar por nivel dentro de la ronda.`;
