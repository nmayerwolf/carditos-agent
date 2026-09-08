export interface ChunkOptions {
  /** Tamaño objetivo de cada chunk en caracteres (~4 chars por token). */
  maxChars?: number;
  /** Solape entre chunks consecutivos, en caracteres. */
  overlapChars?: number;
}

const DEFAULT_MAX = 3200; // ~800 tokens
const DEFAULT_OVERLAP = 400; // ~100 tokens

/** Última ventana de `text` de hasta `n` chars, arrancando en un límite de palabra. */
function tailOverlap(text: string, n: number): string {
  if (n <= 0 || text.length <= n) return text;
  const tail = text.slice(text.length - n);
  const spaceIdx = tail.indexOf(' ');
  return spaceIdx === -1 ? tail : tail.slice(spaceIdx + 1);
}

/** Parte un párrafo más largo que `maxChars` en trozos con solape. */
function hardSplit(paragraph: string, maxChars: number, overlapChars: number): string[] {
  const out: string[] = [];
  let start = 0;
  while (start < paragraph.length) {
    const end = Math.min(paragraph.length, start + maxChars);
    out.push(paragraph.slice(start, end).trim());
    if (end >= paragraph.length) break;
    start = end - overlapChars;
  }
  return out;
}

/**
 * Divide un documento en chunks de ~`maxChars`, respetando límites de párrafo y
 * arrastrando un solape para no cortar ideas al medio.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP;

  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed) chunks.push(trimmed);
    buffer = trimmed ? tailOverlap(trimmed, overlapChars) : '';
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (buffer.trim()) flush();
      const pieces = hardSplit(paragraph, maxChars, overlapChars);
      for (const piece of pieces) chunks.push(piece);
      buffer = tailOverlap(pieces[pieces.length - 1] ?? '', overlapChars);
      continue;
    }

    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars && buffer.trim()) {
      flush();
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    } else {
      buffer = candidate;
    }
  }

  const last = buffer.trim();
  if (last) {
    // El solape puede dejar un último fragmento ya contenido entero en el chunk previo.
    const prev = chunks[chunks.length - 1];
    if (!prev || !prev.includes(last)) chunks.push(last);
  }

  return chunks;
}
