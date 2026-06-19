import { supabase } from '../db/client.js';
import { logger } from '../lib/logger.js';

interface RetrievalResult {
  documentTitle: string;
  chunkText: string;
  similarity: number;
}

export async function retrieveContext(
  query: string,
  limit: number = 5,
): Promise<RetrievalResult[]> {
  try {
    logger.info({ query }, 'Searching corpus');

    const { data: results, error } = await supabase.rpc('search_corpus', {
      query_text: query,
      similarity_threshold: 0.5,
      match_limit: limit,
    });

    if (error) {
      // Fallback: simple text search if RPC doesn't exist
      logger.warn('RPC search_corpus not available, using fallback');
      return [];
    }

    return (results || []).map((result: Record<string, unknown>) => ({
      documentTitle: result.document_title as string,
      chunkText: result.chunk_text as string,
      similarity: result.similarity as number,
    }));
  } catch (err) {
    logger.error(err, 'Retrieval failed');
    return [];
  }
}

export function formatContext(results: RetrievalResult[]): string {
  if (results.length === 0) {
    return '';
  }

  const sections = results.map((r) => `[${r.documentTitle}]\n${r.chunkText}`).join('\n\n---\n\n');

  return `Contexto del corpus:\n\n${sections}`;
}
