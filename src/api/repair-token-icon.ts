/**
 * Download and cache token logos (Jupiter skipped for pump.fun mints with bad icons).
 */

import {
  ensureTokenIconCached,
  getCachedTokenIconWebPath,
  hasCachedTokenIcon,
  readTokenMetaCache,
  removeTokenIconFiles,
  writeTokenMetaCache,
} from '../token-icon-cache.js';
import { fetchRemoteLogoUrlForMint } from './token-logo-fetch.js';

export interface RepairTokenIconOptions {
  /** Replace cached files even when a local icon already exists. */
  force?: boolean;
}

function isPumpFunMint(mint: string): boolean {
  return mint.trim().toLowerCase().endsWith('pump');
}

/** Fetch logo via pump.fun metadata (uxento `image`) / Jupiter and cache locally. */
export async function repairTokenIcon(
  mint: string,
  options: RepairTokenIconOptions = {},
): Promise<string | undefined> {
  const m = mint.trim();
  if (!m) return undefined;

  const force = options.force === true;
  const pumpMint = isPumpFunMint(m);

  if (force || pumpMint) {
    removeTokenIconFiles(m);
  } else if (hasCachedTokenIcon(m)) {
    return getCachedTokenIconWebPath(m) ?? undefined;
  }

  const existing = getCachedTokenIconWebPath(m);
  if (existing && !force && !pumpMint) return existing;

  const remoteUrl = await fetchRemoteLogoUrlForMint(m);
  if (!remoteUrl) {
    return getCachedTokenIconWebPath(m) ?? undefined;
  }

  const local = await ensureTokenIconCached(m, remoteUrl);
  if (!local) return getCachedTokenIconWebPath(m);

  const cache = readTokenMetaCache();
  const entry = cache[m];
  if (entry) {
    entry.logoUrl = local;
    writeTokenMetaCache(cache);
  }
  return local;
}
