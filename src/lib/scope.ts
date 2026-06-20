// Conservative heuristic: only blocks obviously non-rugby queries to save API calls.
// False negatives (valid query passes) → Claude handles via system prompt. ✓
// False positives (rugby query blocked) → coach gets wrong rejection. ✗ — must avoid.

const RUGBY_SIGNALS = [
  /\brugby\b/i,
  /\bscrum\b/i,
  /\btry\b/i,
  /\btackle\b/i,
  /\bdrill(s)?\b/i,
  /\bentrenamiento(s)?\b/i,
  /\bcategor[ií]a(s)?\b/i,
  /\bu-?\d{1,2}\b/i,
  /\binfantil(es)?\b/i,
  /\bjuvenil(es)?\b/i,
  /\blineout\b/i,
  /\btouche?\b/i,
  /\bcoach(es)?\b/i,
  /\bpartido(s)?\b/i,
  /\bjugador(es)?\b/i,
  /\bformaci[oó]n\b/i,
  /\breglamento\b/i,
  /\buar\b/i,
  /\bcancha\b/i,
  /\bmelé\b/i,
  /\bmaul\b/i,
  /\bruck\b/i,
  /\bconversi[oó]n\b/i,
];

const OFF_TOPIC_PATTERNS = [
  /\breceta(s)?\b/i,
  /\bcocina(r)?\b/i,
  /\bpel[ií]cula(s)?\b/i,
  /\bbitcoin\b/i,
  /\bcriptomoneda(s)?\b/i,
  /\bbolsa\s+de\s+valores\b/i,
  /\bacci[oó]n(es)?\s+burs[aá]til/i,
  /\bclima\s+(de\s+hoy|del?\s+d[ií]a)\b/i,
  /\bpron[oó]stico\s+del?\s+tiempo\b/i,
  /\bcovid\b/i,
  /\bvacuna(s)?\b/i,
  /\bfinalizar\s+factura\b/i,
];

export function isLikelyOutOfScope(query: string): boolean {
  if (RUGBY_SIGNALS.some((p) => p.test(query))) {
    return false;
  }
  return OFF_TOPIC_PATTERNS.some((p) => p.test(query));
}

export function getOutOfScopeResponse(): string {
  return 'Eso está fuera de mi cancha — yo soy bueno pensando lo que pasa en el campo. ¿Qué tenés entre manos para el próximo entrenamiento?';
}
