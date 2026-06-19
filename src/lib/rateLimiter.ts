const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }

  if (bucket.count >= MAX_REQUESTS) {
    return true;
  }

  bucket.count++;
  return false;
}
