import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import mammoth from 'mammoth';
import OpenAI from 'openai';
import { supabase } from '../src/db/client.js';
import { logger } from '../src/lib/logger.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHUNK_SIZE = 500;
const OVERLAP = 50;
const CORPUS_DIR = path.join(__dirname, '../content/rugby-knowledge');

type Category = 'reglamento' | 'ejercicios' | 'manejo_grupal' | 'modalidades';

interface Document {
  title: string;
  source: string;
  category: Category;
  content: string;
}

function detectCategory(filename: string): Category {
  const lower = filename.toLowerCase();
  if (lower.includes('reglamento') || lower.includes('urba') || lower.includes('referato')) {
    return 'reglamento';
  }
  if (lower.includes('modelo') || lower.includes('juego') || lower.includes('modalidad')) {
    return 'modalidades';
  }
  if (lower.includes('drill') || lower.includes('ejercicio') || lower.includes('entrenamiento')) {
    return 'ejercicios';
  }
  return 'manejo_grupal';
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === '.txt' || ext === '.md') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  throw new Error(`Formato no soportado: ${ext}`);
}

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += CHUNK_SIZE - OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
    if (chunk.trim().length > 0) chunks.push(chunk);
  }

  return chunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  });
  return response.data[0].embedding;
}

async function alreadyIngested(title: string): Promise<boolean> {
  const { data } = await supabase
    .from('corpus_documents')
    .select('id')
    .eq('title', title)
    .limit(1)
    .single();
  return !!data;
}

async function ingestDocument(doc: Document): Promise<void> {
  if (await alreadyIngested(doc.title)) {
    logger.info({ title: doc.title }, 'Skipping — ya ingresado');
    return;
  }

  logger.info({ title: doc.title, category: doc.category }, 'Ingresando documento');

  const { data: docData, error: docError } = await supabase
    .from('corpus_documents')
    .insert([{ title: doc.title, source: doc.source, content: doc.content, category: doc.category }])
    .select()
    .single();

  if (docError) throw docError;

  const chunks = chunkText(doc.content);
  logger.info({ title: doc.title, chunks: chunks.length }, 'Chunks generados');

  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await generateEmbedding(chunks[i]);
      const { error } = await supabase.from('corpus_embeddings').insert([
        { document_id: docData.id, chunk_text: chunks[i], chunk_index: i, embedding },
      ]);
      if (error) throw error;
      logger.info({ chunk: i + 1, total: chunks.length }, 'Chunk embebido');
    } catch (err) {
      logger.error({ err, chunk: i }, 'Error embebiendo chunk — continuando');
    }
  }

  logger.info({ title: doc.title, chunks: chunks.length }, '✓ Documento ingresado');
}

async function main() {
  if (!fs.existsSync(CORPUS_DIR)) {
    logger.error({ dir: CORPUS_DIR }, 'Directorio de corpus no encontrado');
    process.exit(1);
  }

  const files = fs.readdirSync(CORPUS_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ['.pdf', '.docx', '.txt', '.md'].includes(ext);
  });

  if (files.length === 0) {
    logger.warn('No se encontraron archivos en el corpus');
    process.exit(0);
  }

  logger.info({ files: files.length }, 'Archivos encontrados');

  for (const file of files) {
    const filePath = path.join(CORPUS_DIR, file);
    const title = path.basename(file, path.extname(file));
    const category = detectCategory(file);

    try {
      const content = await extractText(filePath);
      if (!content.trim()) {
        logger.warn({ file }, 'Archivo vacío, saltando');
        continue;
      }
      await ingestDocument({ title, source: file, category, content });
    } catch (err) {
      logger.error({ err, file }, 'Error procesando archivo — continuando');
    }
  }

  logger.info('✓ Ingest completo');
}

main().catch((err) => {
  logger.error(err, 'Ingest failed');
  process.exit(1);
});
