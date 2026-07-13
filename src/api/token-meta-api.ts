/**
 * Shared token metadata types for GET /api/token/:mint.
 */

import {
  getCachedTokenMetaFromDisk,
  type CachedTokenMeta,
} from '../token-icon-cache.js';

export type PriceResolveSource = 'Vybe' | 'Jupiter' | 'Pumpfun-API' | 'RPC';

export function cachedMetaToApiResponse(
  meta: CachedTokenMeta | null | undefined,
  source?: PriceResolveSource,
): Record<string, unknown> {
  if (!meta) return {};
  const { fetchedAt: _fetchedAt, ...out } = meta;
  if (source) return { ...out, source };
  return out;
}

export function decimalsFromMetaCache(mint: string): number | undefined {
  const d = getCachedTokenMetaFromDisk(mint)?.decimals;
  return typeof d === 'number' && Number.isFinite(d) ? d : undefined;
}
