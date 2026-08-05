// Backfill de whatsapp_bsuid para usuarios existentes, cruzando contra los
// contactos de Kapso. Correr primero sin --apply para revisar el dry-run.
// Ver docs/whatsapp-bsuid-migration.md.
import 'dotenv/config';
import { supabase } from '../src/db/client.js';

const KAPSO_API_KEY = process.env.KAPSO_API_KEY;

if (!KAPSO_API_KEY) {
  throw new Error('Missing KAPSO_API_KEY');
}

interface KapsoContact {
  wa_id: string | null;
  business_scoped_user_id: string;
}

async function fetchAllContacts(): Promise<Map<string, string>> {
  const byPhone = new Map<string, string>();
  let url: string | null = 'https://api.kapso.ai/platform/v1/whatsapp/contacts';

  while (url) {
    const res = await fetch(url, { headers: { 'X-API-Key': KAPSO_API_KEY! } });
    if (!res.ok) {
      throw new Error(`Kapso contacts fetch failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { data: KapsoContact[]; paging?: { next?: string } };
    for (const c of body.data) {
      if (c.wa_id) byPhone.set(c.wa_id.replace(/^\+/, ''), c.business_scoped_user_id);
    }
    url = body.paging?.next ?? null;
  }

  return byPhone;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const bsuidByPhone = await fetchAllContacts();

  const { data: users } = await supabase
    .from('users')
    .select('id, name, phone_number')
    .is('whatsapp_bsuid', null);

  const matches = (users ?? [])
    .map((u) => ({ ...u, bsuid: bsuidByPhone.get(u.phone_number.replace(/^\+/, '')) }))
    .filter((u): u is typeof u & { bsuid: string } => Boolean(u.bsuid));

  for (const u of matches) {
    console.log(`${apply ? 'UPDATE' : 'WOULD UPDATE'} ${u.name ?? u.phone_number} → ${u.bsuid}`);
    if (apply) {
      await supabase.from('users').update({ whatsapp_bsuid: u.bsuid }).eq('id', u.id);
    }
  }

  console.log(
    apply ? `Listo — ${matches.length} actualizados.` : 'Dry run — re-correr con --apply.',
  );
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
