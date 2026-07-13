/**
 * Uso: npx tsx scripts/upload-video.ts <ruta-archivo> "<título>" "<descripción>" "tag1,tag2,tag3"
 *
 * Ejemplo:
 *   npx tsx scripts/upload-video.ts content/rugby-knowledge/tackle.mp4 "Tackle en pareja" "Ejercicio de tackle 1vs1" "tackle,defensa,m10,m12"
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const BUCKET = 'Videos';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const [, , filePath, title, description, tagsRaw] = process.argv;

  if (!filePath || !title) {
    console.error('Uso: npx tsx scripts/upload-video.ts <archivo> "<título>" "<descripción>" "tag1,tag2"');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  const originalName = path.basename(filePath);
  // Supabase Storage rechaza acentos y otros caracteres no-ASCII en la key.
  const fileName = originalName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.+_ -]/g, '');
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const CONTENT_TYPES: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
  };
  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    console.error(`Extensión no soportada: ${ext}`);
    process.exit(1);
  }

  console.log(`Subiendo ${fileName} al bucket "${BUCKET}"...`);

  const fileBuffer = fs.readFileSync(filePath);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Error al subir el archivo:', uploadError.message);
    process.exit(1);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  const publicUrl = urlData.publicUrl;

  console.log(`✓ Subido. URL pública: ${publicUrl}`);

  const { data: videoRecord, error: insertError } = await supabase
    .from('corpus_videos')
    .insert([{ title, description: description || null, tags, url: publicUrl }])
    .select('id')
    .single();

  if (insertError) {
    console.error('Error al registrar en BD:', insertError.message);
    process.exit(1);
  }

  console.log(`✓ Registrado en corpus_videos con ID: ${videoRecord.id}`);
  console.log(`  Título: ${title}`);
  console.log(`  Tags: ${tags.join(', ') || '(ninguno)'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
