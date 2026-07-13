/**
 * Hydrate wallet holdings rows from the shared on-disk token-meta / icon cache
 * (same store DeFi positions use via hydrate-defi-symbols).
 */

import {
  getCachedTokenMetaFromDisk,
  getCachedTokenIconWebPath,
  hasCachedTokenIcon,
  isLocalCachedIconUrl,
  type CachedTokenMeta,
} from '../token-icon-cache.js';
import { isMintLikeLabel } from './token-label.js';

export type HoldingsMetaFields = {
  mintAddress: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  enrichmentPending?: boolean;
  skipLogoEnrich?: boolean;
};

export function isBadHoldingsLabel(label: unknown, mint: string): boolean {
  const s = String(label ?? '').trim();
  if (!s) return true;
  if (s.includes('…') || s.includes('...')) return true;
  if (isMintLikeLabel(s, mint)) return true;
  // Common stub after mint-like Vybe labels are replaced with mint.slice(0, 6).
  if (mint && s === mint.slice(0, 6)) return true;
  const upper = s.toUpperCase();
  if (upper === 'SPL' || upper === 'TOKEN2022') return false;
  return false;
}

function metaToHoldingsPatch(
  meta: CachedTokenMeta,
): { symbol: string; name: string; logoUrl?: string } | null {
  const mint = String(meta.mint ?? '').trim();
  const symbol = String(meta.symbol ?? '').trim();
  if (!symbol || symbol.includes('…') || symbol.includes('...')) return null;
  const upper = symbol.toUpperCase();
  if (isMintLikeLabel(symbol, mint) && upper !== 'SPL' && upper !== 'TOKEN2022') {
    return null;
  }
  const name = String(meta.name ?? '').trim();
  const localLogo =
    (hasCachedTokenIcon(mint) ? getCachedTokenIconWebPath(mint) : undefined) ||
    (isLocalCachedIconUrl(meta.logoUrl) ? meta.logoUrl?.trim() : undefined);
  return {
    symbol,
    name: name && !isMintLikeLabel(name, mint) && !name.includes('…') && !name.includes('...')
      ? name
      : symbol,
    logoUrl: localLogo,
  };
}

/**
 * Prefer a file already on disk. If none, return the hint unchanged so callers can
 * download remotes server-side before stripping for the client.
 */
export function preferLocalHoldingsLogo(
  mint: string,
  logoUrl: string | null | undefined,
): string | null {
  const m = mint.trim();
  if (m && hasCachedTokenIcon(m)) {
    return getCachedTokenIconWebPath(m) ?? null;
  }
  const logo = logoUrl?.trim() || '';
  if (isLocalCachedIconUrl(logo)) return logo;
  return logo || null;
}

/** Client-safe logo: local paths only. */
export function clientHoldingsLogoUrl(
  mint: string,
  logoUrl: string | null | undefined,
): string | null {
  const m = mint.trim();
  if (m && hasCachedTokenIcon(m)) {
    return getCachedTokenIconWebPath(m) ?? null;
  }
  const logo = logoUrl?.trim() || '';
  return isLocalCachedIconUrl(logo) ? logo : null;
}

/**
 * Fill missing/bad symbol, name, and logo from disk before returning the initial
 * holdings list. Marks enrichmentPending when symbol/logo are still missing.
 */
export function hydrateWalletHoldingsFromDiskCache<T extends HoldingsMetaFields>(
  items: T[],
): { items: T[]; hydrated: number } {
  let hydrated = 0;
  const out = items.map((item) => {
    if (item.skipLogoEnrich) {
      return {
        ...item,
        logoUrl: preferLocalHoldingsLogo(item.mintAddress, item.logoUrl),
      };
    }
    const mint = item.mintAddress.trim();
    if (!mint) return item;

    const disk = getCachedTokenMetaFromDisk(mint);
    const patch = disk ? metaToHoldingsPatch(disk) : null;
    let next: T = item;
    let changed = false;

    const remoteHint = item.logoUrl?.trim() || null;
    if (patch) {
      const nextSymbol = isBadHoldingsLabel(item.symbol, mint) ? patch.symbol : item.symbol;
      const nextName =
        isBadHoldingsLabel(item.name, mint) || !String(item.name ?? '').trim()
          ? patch.name
          : item.name;
      const nextLogo =
        preferLocalHoldingsLogo(mint, item.logoUrl) ||
        preferLocalHoldingsLogo(mint, patch.logoUrl) ||
        null;
      if (nextSymbol !== item.symbol || nextName !== item.name || nextLogo !== item.logoUrl) {
        changed = true;
        next = { ...item, symbol: nextSymbol, name: nextName, logoUrl: nextLogo };
      }
    } else {
      const localLogo = preferLocalHoldingsLogo(mint, item.logoUrl);
      if (localLogo !== item.logoUrl) {
        changed = true;
        next = { ...item, logoUrl: localLogo };
      }
    }

    // Keep remote hint only for materialize step via enrichmentPending when stripped
    const stillBadSymbol = isBadHoldingsLabel(next.symbol, mint);
    const stillMissingLogo = !String(next.logoUrl ?? '').trim();
    const hadRemote = Boolean(remoteHint && !isLocalCachedIconUrl(remoteHint));
    const enrichmentPending =
      Boolean(next.enrichmentPending) || stillBadSymbol || stillMissingLogo || hadRemote;

    if (changed) hydrated += 1;
    if (enrichmentPending !== item.enrichmentPending || changed) {
      return { ...next, enrichmentPending };
    }
    return next;
  });

  return { items: out, hydrated };
}
