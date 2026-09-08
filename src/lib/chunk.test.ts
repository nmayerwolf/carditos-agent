import { describe, it, expect } from 'vitest';
import { chunkText } from './chunk.js';

describe('chunkText', () => {
  it('devuelve un solo chunk cuando el texto entra en maxChars', () => {
    const text = 'Párrafo corto.\n\nOtro párrafo corto.';
    expect(chunkText(text)).toEqual([text]);
  });

  it('parte en varios chunks respetando el tope (+ solape arrastrado)', () => {
    const paragraphs = Array.from(
      { length: 20 },
      (_, i) => `Parrafo ${i}. ` + 'contenido variado aqui '.repeat(40),
    );
    const chunks = chunkText(paragraphs.join('\n\n'), { maxChars: 2000, overlapChars: 200 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(2000 + 200);
  });

  it('arrastra solape entre chunks consecutivos', () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) => `Idea numero ${i} ` + 'x'.repeat(300));
    const chunks = chunkText(paragraphs.join('\n\n'), { maxChars: 800, overlapChars: 150 });

    expect(chunks.length).toBeGreaterThan(2);
    const tailOfFirst = chunks[0].slice(-80);
    expect(chunks[1].includes(tailOfFirst.trim().split(' ')[0])).toBe(true);
  });

  it('hace hard-split de un párrafo más largo que maxChars', () => {
    const huge = 'a'.repeat(5000);
    const chunks = chunkText(huge, { maxChars: 1000, overlapChars: 100 });

    expect(chunks.length).toBeGreaterThanOrEqual(5);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000);
  });

  it('ignora texto vacío', () => {
    expect(chunkText('   \n\n   ')).toEqual([]);
  });
});
