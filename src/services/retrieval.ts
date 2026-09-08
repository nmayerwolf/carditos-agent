import { supabase } from '../db/client.js';
import { logger } from '../lib/logger.js';

interface RetrievalResult {
  documentTitle: string;
  chunkText: string;
}

const TOP_K = 3;
const OR_FALLBACK_LIMIT = 20;

// Mitigación de costo: los documentos del corpus están sin chunkear (uno por PDF,
// hasta ~47k tokens). Inyectarlos enteros dispara el input por mensaje. Hasta que
// el ingest chunkee de verdad, recortamos cada doc a una ventana alrededor del
// primer término de la query que aparezca en el texto.
const WINDOW_CHARS = 2200;
const WINDOW_LEAD = 400;

function windowAround(content: string, terms: string[]): string {
  if (content.length <= WINDOW_CHARS) return content;

  const haystack = content.toLowerCase();
  let hit = -1;
  for (const t of terms) {
    const idx = haystack.indexOf(t);
    if (idx !== -1 && (hit === -1 || idx < hit)) hit = idx;
  }

  const start = hit === -1 ? 0 : Math.max(0, hit - WINDOW_LEAD);
  const end = Math.min(content.length, start + WINDOW_CHARS);
  const slice = content.slice(start, end).trim();

  return `${start > 0 ? '… ' : ''}${slice}${end < content.length ? ' …' : ''}`;
}

const STOPWORDS = new Set([
  'a',
  'al',
  'ante',
  'como',
  'con',
  'cual',
  'cuales',
  'cuando',
  'de',
  'del',
  'el',
  'ella',
  'ellas',
  'ellos',
  'en',
  'entre',
  'es',
  'esta',
  'este',
  'esto',
  'la',
  'las',
  'lo',
  'los',
  'mi',
  'mis',
  'nos',
  'o',
  'para',
  'per',
  'por',
  'que',
  'se',
  'si',
  'sin',
  'sobre',
  'su',
  'sus',
  'te',
  'tu',
  'tus',
  'u',
  'un',
  'una',
  'unas',
  'unos',
  'y',
]);

function significantTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[?¿!¡.,;:()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

async function searchDocuments(tsQuery: string, limit: number) {
  return supabase
    .from('corpus_documents')
    .select('title, content')
    .textSearch('content_tsv', tsQuery, { type: 'websearch', config: 'spanish' })
    .limit(limit);
}

export async function retrieveContext(query: string): Promise<RetrievalResult[]> {
  try {
    const terms = significantTerms(query);
    let { data, error } = await searchDocuments(query, TOP_K);

    // websearch_to_tsquery combina los términos con AND implícito: alcanza con que
    // una sola palabra de la pregunta no esté en el documento para que no matchee
    // nada. Si la búsqueda estricta no encuentra nada, reintentamos en OR sobre
    // las palabras significativas y reordenamos por cantidad de términos que
    // matchean cada doc (el OR de Postgres no viene ordenado por relevancia).
    if (!error && (!data || data.length === 0)) {
      if (terms.length > 0) {
        const orQuery = terms.join(' OR ');
        const orResult = await searchDocuments(orQuery, OR_FALLBACK_LIMIT);
        data = orResult.data;
        error = orResult.error;

        if (!error && data) {
          data = [...data]
            .sort((a, b) => {
              const scoreA = terms.filter((t) =>
                (a.content as string).toLowerCase().includes(t),
              ).length;
              const scoreB = terms.filter((t) =>
                (b.content as string).toLowerCase().includes(t),
              ).length;
              return scoreB - scoreA;
            })
            .slice(0, TOP_K);
        }
      }
    }

    if (error) {
      logger.error(error, 'FTS search failed');
      return [];
    }

    const results = (data || []).map((doc) => ({
      documentTitle: doc.title as string,
      chunkText: windowAround(doc.content as string, terms),
    }));

    logger.info(
      { found: results.length, chars: results.reduce((n, r) => n + r.chunkText.length, 0) },
      'FTS retrieval',
    );
    return results;
  } catch (err) {
    logger.error(err, 'Retrieval failed');
    return [];
  }
}

export function formatContext(results: RetrievalResult[]): string {
  if (results.length === 0) return '';
  const sections = results.map((r) => `[${r.documentTitle}]\n${r.chunkText}`).join('\n\n---\n\n');
  return `Contexto del corpus:\n\n${sections}`;
}
