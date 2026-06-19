import { logger } from '../lib/logger.js';

const OUT_OF_SCOPE_KEYWORDS = [
  'política',
  'religión',
  'covid',
  'vacuna',
  'dinero',
  'inversión',
  'criptomoneda',
  'apuestas',
  'comida',
  'receta',
  'nutrición',
  'dieta',
  'pérdida de peso',
  'psicólogo',
  'depresión',
  'ansiedad',
  'medicamento',
  'doctor',
  'hospital',
];

export function isLikelyOutOfScope(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Check for obvious out-of-scope keywords
  const hasOutOfScopeKeyword = OUT_OF_SCOPE_KEYWORDS.some((keyword) =>
    lowerQuery.includes(keyword),
  );

  // Check if query mentions rugby, training, drills, coaching, etc.
  const rugbyKeywords = ['rugby', 'entreno', 'entrenamiento', 'drill', 'coach', 'jugador', 'partido', 'equipo', 'reglamento', 'modalidad', 'pase', 'try', 'scrum', 'lineout', 'ruck', 'maul', 'categoría', 'infantil', 'juvenil'];
  const hasRugbyKeyword = rugbyKeywords.some((keyword) => lowerQuery.includes(keyword));

  if (hasOutOfScopeKeyword) {
    logger.info({ query }, 'Detected out-of-scope keywords');
    return true;
  }

  // If no rugby keywords and query is long/specific, might be out-of-scope
  if (!hasRugbyKeyword && query.length > 100) {
    logger.info({ query }, 'No rugby keywords in long query');
    return true;
  }

  return false;
}

export function getOutOfScopeResponse(): string {
  const responses = [
    'Eso está fuera de mi cancha — yo soy bueno pensando rugby. ¿Qué tenés para el próximo entrenamiento?',
    'Eso no es lo mío. Consultame de rugby, drills, reglamento, o cómo manejar los chicos en el campo.',
    'No es mi tema. Mejor preguntale a alguien que sepa de eso. Yo estoy para ayudarte con el entrenamiento.',
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}
