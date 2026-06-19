import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { supabase } from '../src/db/client.js';
import { logger } from '../src/lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHUNK_SIZE = 500; // words per chunk
const OVERLAP = 50; // overlap words

interface Document {
  title: string;
  source: string;
  category: 'reglamento' | 'ejercicios' | 'manejo_grupal' | 'modalidades';
  content: string;
}

function chunkText(text: string, chunkSize: number = CHUNK_SIZE): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - OVERLAP) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  } catch (err) {
    logger.error(err, 'Failed to generate embedding');
    throw err;
  }
}

async function ingestDocument(doc: Document): Promise<void> {
  logger.info({ title: doc.title }, 'Ingesting document');

  // Insert document
  const { data: docData, error: docError } = await supabase
    .from('corpus_documents')
    .insert([
      {
        title: doc.title,
        source: doc.source,
        content: doc.content,
        category: doc.category,
      },
    ])
    .select()
    .single();

  if (docError) {
    logger.error(docError, 'Failed to insert document');
    throw docError;
  }

  const documentId = docData.id;

  // Chunk and embed
  const chunks = chunkText(doc.content);
  logger.info({ chunks: chunks.length }, 'Generated chunks');

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      const embedding = await generateEmbedding(chunk);

      const { error: embedError } = await supabase.from('corpus_embeddings').insert([
        {
          document_id: documentId,
          chunk_text: chunk,
          chunk_index: i,
          embedding,
        },
      ]);

      if (embedError) {
        logger.error(embedError, 'Failed to insert embedding');
        throw embedError;
      }

      logger.info({ chunk: i + 1, total: chunks.length }, 'Embedded chunk');
    } catch (err) {
      logger.error(err, 'Error processing chunk');
      // Continue with next chunk
    }
  }

  logger.info({ title: doc.title, chunks: chunks.length }, 'Document ingested');
}

async function main() {
  try {
    // Example documents (replace with actual corpus)
    const exampleDocs: Document[] = [
      {
        title: 'Reglamento UAR - Rugby 7s Infantil',
        source: 'reglamento_uar',
        category: 'reglamento',
        content: `
          El rugby 7s es una variante del rugby con 7 jugadores por equipo.
          El terreno de juego es similar al rugby 15s pero más pequeño.
          Los tries valen 5 puntos, las conversiones 2 puntos.
          El juego es más rápido y dinámico que el rugby 15s.
          Las reglas de fuera de juego y línea de ventaja se aplican normalmente.
          Los cambios ilimitados están permitidos en rugby 7s.
        `,
      },
      {
        title: 'Drill: Pase Rápido en U10',
        source: 'drills_club',
        category: 'ejercicios',
        content: `
          Objetivo: mejorar la velocidad y precisión del pase.
          Recursos: 4 conos, 1 balón por pareja.
          Formación: dos líneas de 3 metros de distancia.
          Ejecución: los jugadores pasan el balón alternadamente.
          Variante 1: aumentar la distancia a 5 metros.
          Variante 2: agregar movimiento lateral.
          Duración: 10 minutos.
        `,
      },
    ];

    for (const doc of exampleDocs) {
      await ingestDocument(doc);
    }

    logger.info('✓ All documents ingested');
  } catch (err) {
    logger.error(err, 'Ingest failed');
    process.exit(1);
  }
}

main();
