/**
 * Download remote token logos onto the server and return local /cached paths only.
 */

import {
  ensureTokenIconCached,
  getCachedTokenIconWebPath,
  hasCachedTokenIcon,
  isLocalCachedIconUrl,
  readTokenMetaCache,
  writeTokenMetaCache,
} from '../token-icon-cache.js';
import { repairTokenIcon } from './repair-token-icon.js';

function persistLocalLogoOnMeta(mint: string, localPath: string): void {
  const cache = readTokenMetaCache();
  const entry = cache[mint];
  if (!entry) return;
  if (entry.logoUrl === localPath) return;
  entry.logoUrl = localPath;
  writeTokenMetaCache(cache);
}

export type MaterializeLogoOptions = {
  /** When no remote hint, probe Jupiter/pump via repairTokenIcon (slower). Default false. */
  allowRepair?: boolean;
};

/**
 * Ensure the mint has a locally served icon. Downloads `remoteOrLocal` when it is a
 * remote URL. Optionally falls back to Jupiter/pump repair.
 * Always returns a local path or null — never a remote CDN URL.
 */
export async function materializeTokenLogoLocal(
  mint: string,
  remoteOrLocal?: string | null,
  options: MaterializeLogoOptions = {},
): Promise<string | null> {
  const m = mint.trim();
  if (!m) return null;

  if (hasCachedTokenIcon(m)) {
    const existing = getCachedTokenIconWebPath(m) ?? null;
    if (existing) {
      persistLocalLogoOnMeta(m, existing);
      return existing;
    }
  }

  const hint = String(remoteOrLocal ?? '').trim();
  if (isLocalCachedIconUrl(hint)) return hint;

  if (hint) {
    const local = await ensureTokenIconCached(m, hint);
    if (local) {
      persistLocalLogoOnMeta(m, local);
      return local;
    }
  }

  if (options.allowRepair === true) {
    const repaired = await repairTokenIcon(m);
    if (repaired && isLocalCachedIconUrl(repaired)) {
      persistLocalLogoOnMeta(m, repaired);
      return repaired;
    }
    if (repaired && hasCachedTokenIcon(m)) {
      return getCachedTokenIconWebPath(m) ?? null;
    }
  }

  return null;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

export type LogoMaterializeItem = {
  mintAddress: string;
  logoUrl: string | null;
  valueUsd?: number;
  skipLogoEnrich?: boolean;
};

/**
 * Download logos for the highest-value items that still need a local icon.
 * Strips any remaining remote URLs so clients never load external CDNs.
 */
export async function materializeItemLogosLocal<T extends LogoMaterializeItem>(
  items: T[],
  options?: {
    limit?: number;
    concurrency?: number;
    allowRepair?: boolean;
    onResolved?: (item: T) => void | Promise<void>;
  },
): Promise<T[]> {
  const limit = Math.max(0, options?.limit ?? 20);
  const concurrency = Math.max(1, options?.concurrency ?? 8);
  const allowRepair = options?.allowRepair === true;

  const ranked = [...items]
    .filter((item) => !item.skipLogoEnrich)
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

  const needDownload = ranked
    .filter((item) => {
      if (hasCachedTokenIcon(item.mintAddress)) return false;
      const logo = item.logoUrl?.trim() || '';
      if (isLocalCachedIconUrl(logo)) return false;
      // With repair: include missing logos; without: only remote URL hints.
      return allowRepair || Boolean(logo);
    })
    .slice(0, limit);

  const localByMint = new Map<string, string | null>();
  await mapPool(needDownload, concurrency, async (item) => {
    const local = await materializeTokenLogoLocal(item.mintAddress, item.logoUrl, { allowRepair });
    localByMint.set(item.mintAddress, local);
    if (local) {
      const next = { ...item, logoUrl: local };
      await options?.onResolved?.(next);
    }
    return local;
  });

  return items.map((item) => {
    if (item.skipLogoEnrich) {
      return { ...item, logoUrl: isLocalCachedIconUrl(item.logoUrl) ? item.logoUrl : null };
    }
    if (hasCachedTokenIcon(item.mintAddress)) {
      const local = getCachedTokenIconWebPath(item.mintAddress) ?? localByMint.get(item.mintAddress) ?? null;
      return { ...item, logoUrl: local };
    }
    if (localByMint.has(item.mintAddress)) {
      return { ...item, logoUrl: localByMint.get(item.mintAddress) ?? null };
    }
    const logo = item.logoUrl?.trim() || null;
    return { ...item, logoUrl: isLocalCachedIconUrl(logo) ? logo : null };
  });
}

/** Stream-friendly helper for POST /api/tokens/materialize-logos. */
export async function materializeLogoHintsSequential(
  hints: Array<{ mint: string; logoUrl?: string | null }>,
  onResolved?: (token: { mint: string; logoUrl: string }) => void | Promise<void>,
  options?: { allowRepair?: boolean; concurrency?: number; limit?: number },
): Promise<Array<{ mint: string; logoUrl: string }>> {
  const allowRepair = options?.allowRepair !== false;
  const concurrency = Math.max(1, options?.concurrency ?? 8);
  const limit = Math.max(0, options?.limit ?? 40);
  const seen = new Set<string>();
  const queue: Array<{ mint: string; logoUrl: string | null }> = [];
  for (const raw of hints) {
    const mint = String(raw?.mint ?? '').trim();
    if (!mint || seen.has(mint)) continue;
    seen.add(mint);
    queue.push({ mint, logoUrl: raw?.logoUrl?.trim() || null });
    if (queue.length >= limit) break;
  }

  const out: Array<{ mint: string; logoUrl: string }> = [];
  await mapPool(queue, concurrency, async (item) => {
    const local = await materializeTokenLogoLocal(item.mint, item.logoUrl, { allowRepair });
    if (!local) return null;
    const token = { mint: item.mint, logoUrl: local };
    out.push(token);
    await onResolved?.(token);
    return token;
  });
  return out;
}
