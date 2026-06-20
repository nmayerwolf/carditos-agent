import { supabase } from '../db/client.js';
import { logger } from '../lib/logger.js';

interface RetrievalResult {
  documentTitle: string;
  chunkText: string;
}

export async function retrieveContext(_query: string): Promise<RetrievalResult[]> {
  try {
    logger.info('Loading corpus from DB');

    const { data, error } = await supabase
      .from('corpus_documents')
      .select('title, content')
      .order('ingested_at', { ascending: true });

    if (error) {
      logger.error(error, 'Failed to load corpus');
      return [];
    }

    return (data || []).map((doc) => ({
      documentTitle: doc.title as string,
      chunkText: doc.content as string,
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
