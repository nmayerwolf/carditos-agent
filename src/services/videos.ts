import { supabase } from '../db/client.js';
import { logger } from '../lib/logger.js';

export interface CorpusVideo {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  url: string;
}

export async function getVideosCatalog(): Promise<CorpusVideo[]> {
  try {
    const { data, error } = await supabase
      .from('corpus_videos')
      .select('id, title, description, tags, url')
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error(error, 'Failed to load videos catalog');
      return [];
    }

    return (data || []) as CorpusVideo[];
  } catch (err) {
    logger.error(err, 'Failed to load videos catalog');
    return [];
  }
}

export function formatVideosCatalog(videos: CorpusVideo[]): string {
  if (videos.length === 0) return '';
  const lines = videos.map(
    (v) => `- [${v.id}] ${v.title}${v.description ? ` — ${v.description}` : ''} (tags: ${v.tags.join(', ')})`,
  );
  return `Videos disponibles:\n${lines.join('\n')}`;
}
