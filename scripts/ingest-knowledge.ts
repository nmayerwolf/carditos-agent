import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { supabase } from '../src/db/client.js';
import { logger } from '../src/lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CORPUS_DIR = path.join(__dirname, '../content/rugby-knowledge');

type Category = 'reglamento' | 'ejercicios' | 'manejo_grupal' | 'modalidades';

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
    const parser = new PDFParse({ data: buffer });
    await parser.load();
    const result = await parser.getText();
    return result.text;
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

async function alreadyIngested(title: string): Promise<boolean> {
  const { data } = await supabase
    .from('corpus_documents')
    .select('id')
    .eq('title', title)
    .limit(1)
    .single();
  return !!data;
}

async function ingestDocument(
  title: string,
  source: string,
  category: Category,
  content: string,
): Promise<void> {
  if (await alreadyIngested(title)) {
    logger.info({ title }, 'Skipping — ya ingresado');
    return;
  }

  logger.info({ title, category }, 'Ingresando documento');

  const { error } = await supabase
    .from('corpus_documents')
    .insert([{ title, source, content, category }]);

  if (error) throw error;

  logger.info({ title }, '✓ Documento ingresado');
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
      await ingestDocument(title, file, category, content);
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
