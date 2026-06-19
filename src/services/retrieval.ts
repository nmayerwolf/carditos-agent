import OpenAI from 'openai';
import { supabase } from '../db/client.js';
import { logger } from '../lib/logger.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface RetrievalResult {
  documentTitle: string;
  chunkText: string;
  similarity: number;
}

async function embedQuery(query: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
    encoding_format: 'float',
  });
  return response.data[0].embedding;
}

export async function retrieveContext(
  query: string,
  limit: number = 5,
): Promise<RetrievalResult[]> {
  try {
    logger.info({ queryLength: query.length }, 'Searching corpus');

    const queryEmbedding = await embedQuery(query);

    const { data: results, error } = await supabase.rpc('search_corpus', {
      query_embedding: queryEmbedding,
      similarity_threshold: 0.5,
      match_limit: limit,
    });

    if (error) {
      logger.error(error, 'search_corpus RPC failed');
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
