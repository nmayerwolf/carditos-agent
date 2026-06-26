import { supabase } from '../db/client.js';
import { logger } from '../lib/logger.js';

interface RetrievalResult {
  documentTitle: string;
  chunkText: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
let corpusCache: RetrievalResult[] | null = null;
let cacheLoadedAt = 0;

export async function retrieveContext(_query: string): Promise<RetrievalResult[]> {
  const now = Date.now();
  if (corpusCache && now - cacheLoadedAt < CACHE_TTL_MS) {
    return corpusCache;
  }

  try {
    logger.info('Loading corpus from DB');

    const { data, error } = await supabase
      .from('corpus_documents')
      .select('title, content')
      .order('ingested_at', { ascending: true });

    if (error) {
      logger.error(error, 'Failed to load corpus');
      return corpusCache || [];
    }

    corpusCache = (data || []).map((doc) => ({
      documentTitle: doc.title as string,
      chunkText: doc.content as string,
    }));
    cacheLoadedAt = now;
    return corpusCache;
  } catch (err) {
    logger.error(err, 'Retrieval failed');
    return corpusCache || [];
  }
}

export function formatContext(results: RetrievalResult[]): string {
  if (results.length === 0) {
    return '';
  }

  const sections = results.map((r) => `[${r.documentTitle}]\n${r.chunkText}`).join('\n\n---\n\n');

  return `Contexto del corpus:\n\n${sections}`;
}
