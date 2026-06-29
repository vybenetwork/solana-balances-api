/**
 * Remote logo URL resolution for wallet holdings (not Jupiter-first for pump.fun mints).
 */

import { fetchJupiterAsset } from './jupiter-token-fallback.js';
import { fetchPumpfunLogoUrl } from './pumpfun-price-fallback.js';

function isPumpFunMint(mint: string): boolean {
  return mint.trim().toLowerCase().endsWith('pump');
}

/**
 * Resolve a downloadable logo URL for a mint.
 * pump.fun mints: pump.fun image_uri → metadata JSON `image` (uxento, etc.) — skips Jupiter.
 * Other mints: Jupiter icon → pump.fun paths.
 */
export async function fetchRemoteLogoUrlForMint(mint: string): Promise<string | undefined> {
  const m = mint.trim();
  if (!m) return undefined;

  if (isPumpFunMint(m)) {
    return await fetchPumpfunLogoUrl(m);
  }

  try {
    const asset = await fetchJupiterAsset(m);
    const url = asset?.logoUrl?.trim();
    if (url) return url;
  } catch {
    /* fall through */
  }

  return await fetchPumpfunLogoUrl(m);
}
