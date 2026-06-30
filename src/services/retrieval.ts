import { supabase } from '../db/client.js';
import { logger } from '../lib/logger.js';

interface RetrievalResult {
  documentTitle: string;
  chunkText: string;
}

const TOP_K = 5;

export async function retrieveContext(query: string): Promise<RetrievalResult[]> {
  try {
    const { data, error } = await supabase
      .from('corpus_documents')
      .select('title, content')
      .textSearch('content_tsv', query, { type: 'websearch', config: 'spanish' })
      .limit(TOP_K);

    if (error) {
      logger.error(error, 'FTS search failed');
      return [];
    }

    const results = (data || []).map((doc) => ({
      documentTitle: doc.title as string,
      chunkText: doc.content as string,
    }));

    logger.info({ found: results.length }, 'FTS retrieval');
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
