/**
 * Debug branch: wallet holdings from GET /api/assets/:wallet only.
 * Logos are downloaded server-side into /cached/token-icons and served locally.
 */

import type { AxiosInstance } from 'axios';
import { WALLET_TOKEN_BALANCE_LIMIT } from '../wallet-balance-limit.js';
import { getOwnerAssets, normalizeAssetsMint } from './owner-assets.js';
import { materializeItemLogosLocal } from './materialize-token-logo.js';
import { NATIVE_SOL_MINT, WSOL_MINT } from './sol-mints.js';

export { WALLET_TOKEN_BALANCE_LIMIT };
export { NATIVE_SOL_MINT, WSOL_MINT };

/** Kept for API/UI compat — meta enrich is disabled; logo download is not. */
export const TOP_LOGO_REPAIR_N = 0;
export const TOP_LOGO_REPAIR_N_MAX = 0;
export const ENRICH_FORCE_DISABLE_TOKEN_COUNT = 100;
export const ENRICH_FORCE_DISABLE_DEAD_COUNT = 50;
export const WALLET_BALANCE_ENRICH_CONCURRENCY = 0;

export const VYBE_WALLET_TOKEN_BALANCE_SORT_BY_DESC = 'valueUsd';
export const VYBE_WALLET_TOKEN_BALANCE_MAX_LIMIT = 10_000;
export const VYBE_SUSPICIOUS_VALUE_USD_MIN = 100;

export interface WalletBalanceListItem {
  mintAddress: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  decimals: number;
  amountUi: number;
  amountExact: string;
  valueUsd: number;
  valueSol?: number;
  verified: boolean;
  priceSource?: 'Vybe' | 'Jupiter' | 'Pumpfun-API' | 'RPC';
  enrichmentPending?: boolean;
  skipLogoEnrich?: boolean;
  priceUsd?: number;
  price1d?: number;
  price7d?: number;
  priceChange1dPct?: number;
  priceChange7dPct?: number;
  category?: string | null;
  subcategory?: string | null;
  currentSupply?: number;
  marketCap?: number;
  tokenAmountVolume24h?: number;
  usdValueVolume24h?: number;
  updateTime?: number;
}

export type WalletBalanceStreamEvent =
  | { event: 'initial'; tokens: WalletBalanceListItem[] }
  | { event: 'update'; token: WalletBalanceListItem }
  | { event: 'done' };

function uiAmountToRawExact(amountUi: number, decimals: number): string {
  if (!(amountUi > 0) || !Number.isFinite(amountUi)) return '0';
  const d = Math.max(0, Math.floor(decimals));
  const fixed = amountUi.toFixed(Math.min(d, 12));
  const [wholePart, fracPart = ''] = fixed.split('.');
  const whole = BigInt(wholePart || '0');
  const frac = BigInt(fracPart.padEnd(d, '0').slice(0, d) || '0');
  return (whole * 10n ** BigInt(d) + frac).toString();
}

function remoteLogoHint(logo: string | null | undefined): string | null {
  const u = String(logo ?? '').trim();
  if (!u) return null;
  if (u.startsWith('https://') || u.startsWith('http://')) return u;
  return null;
}

export function isDeadWalletHolding(item: WalletBalanceListItem): boolean {
  const d1 = Number(item.priceChange1dPct);
  const d7 = Number(item.priceChange7dPct);
  return !Number.isFinite(d1) && !Number.isFinite(d7);
}

export function countDeadWalletHoldings(items: WalletBalanceListItem[]): number {
  return items.reduce((n, item) => n + (isDeadWalletHolding(item) ? 1 : 0), 0);
}

export function shouldForceDisableStreamEnrich(_items: WalletBalanceListItem[]): boolean {
  return true;
}

export interface MergedWalletBalances {
  items: WalletBalanceListItem[];
}

/** Map assets API holdings → UI rows, with logos cached on this server. */
export async function fetchWalletBalancesFromVybe(
  _http: AxiosInstance | undefined,
  ownerAddress: string,
  limit = WALLET_TOKEN_BALANCE_LIMIT,
): Promise<MergedWalletBalances> {
  const label = ownerAddress.trim().slice(0, 8);
  const started = Date.now();

  const assets = await getOwnerAssets(ownerAddress);
  console.info(
    `[wallet-balance] ${label} assets=${Date.now() - started}ms ` +
      `holdings=${assets.holdings.length} token_count=${assets.token_count} ` +
      `with_value=${assets.tokens_with_value} total_usd=${assets.total_usd} ` +
      `query_ms=${assets.query_time_ms ?? '?'} has_more=${assets.has_more === true}`,
  );

  const items: WalletBalanceListItem[] = [];
  for (const row of assets.holdings) {
    const mintAddress = normalizeAssetsMint(row.mint);
    if (!mintAddress) continue;
    const decimals =
      Number.isFinite(row.decimals) && row.decimals >= 0
        ? Math.floor(row.decimals)
        : mintAddress === NATIVE_SOL_MINT || mintAddress === WSOL_MINT
          ? 9
          : 0;
    const amountUi = Number(row.amount);
    if (!(amountUi > 0) || !Number.isFinite(amountUi)) continue;

    const isNativeSol = mintAddress === NATIVE_SOL_MINT;
    const symbol =
      row.symbol?.trim() ||
      (typeof row.label === 'string' && row.label.trim() ? row.label.trim() : '') ||
      (isNativeSol ? 'SOL' : mintAddress.slice(0, 6));
    const name = row.name?.trim() || (isNativeSol ? 'Native SOL' : symbol);
    const priceUsd = Number(row.price);
    const valueUsd = Number(row.value_usd);
    const valueSol = Number(row.value_sol);

    items.push({
      mintAddress,
      symbol,
      name,
      // Keep remote hint for server download — not for the browser.
      logoUrl: remoteLogoHint(row.logo),
      decimals,
      amountUi,
      amountExact: uiAmountToRawExact(amountUi, decimals),
      valueUsd: Number.isFinite(valueUsd) && valueUsd > 0 ? valueUsd : 0,
      valueSol: Number.isFinite(valueSol) && valueSol > 0 ? valueSol : undefined,
      verified: isNativeSol,
      enrichmentPending: false,
      priceUsd: Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : undefined,
      priceSource: Number.isFinite(priceUsd) && priceUsd > 0 ? 'Vybe' : undefined,
    });
  }

  items.sort(
    (a, b) =>
      b.valueUsd - a.valueUsd ||
      b.amountUi - a.amountUi ||
      a.mintAddress.localeCompare(b.mintAddress),
  );

  const sliced = items.slice(0, limit);

  const logoStarted = Date.now();
  const withLocalLogos = await materializeItemLogosLocal(sliced, {
    limit: sliced.length,
    concurrency: 12,
    allowRepair: false,
  });
  const localCount = withLocalLogos.filter((t) =>
    Boolean(t.logoUrl?.startsWith('/cached/') || t.logoUrl?.startsWith('/data/')),
  ).length;
  console.info(
    `[wallet-balance] ${label} logos materialized ${localCount}/${withLocalLogos.length} ` +
      `in ${Date.now() - logoStarted}ms (served from /cached/token-icons)`,
  );
  console.info(
    `[wallet-balance] ${label} mapped ${withLocalLogos.length}/${items.length} item(s) in ${Date.now() - started}ms`,
  );
  return { items: withLocalLogos };
}

export async function streamWalletTokenBalances(
  http: AxiosInstance | undefined,
  ownerAddress: string,
  limit: number,
  emit: (event: WalletBalanceStreamEvent) => void,
  isCancelled?: () => boolean,
  _options?: { enrich?: boolean; enrichLimit?: number },
): Promise<void> {
  const { items } = await fetchWalletBalancesFromVybe(http, ownerAddress, limit);
  if (isCancelled?.()) return;
  emit({ event: 'initial', tokens: items });
  await new Promise<void>((resolve) => setImmediate(resolve));
  if (!isCancelled?.()) emit({ event: 'done' });
}

export async function listWalletTokenBalances(
  http: AxiosInstance | undefined,
  ownerAddress: string,
  limit = WALLET_TOKEN_BALANCE_LIMIT,
  _options?: { enrich?: boolean; enrichLimit?: number },
): Promise<WalletBalanceListItem[]> {
  const { items } = await fetchWalletBalancesFromVybe(http, ownerAddress, limit);
  return items;
}

export async function getWalletSolBalanceUi(
  _http: AxiosInstance | undefined,
  ownerAddress: string,
): Promise<number> {
  const assets = await getOwnerAssets(ownerAddress);
  const native = assets.holdings.find(
    (h) => normalizeAssetsMint(h.mint) === NATIVE_SOL_MINT || h.label === 'Native SOL',
  );
  if (native && Number.isFinite(native.amount)) return native.amount;
  return Number.isFinite(assets.total_sol) ? assets.total_sol : 0;
}
