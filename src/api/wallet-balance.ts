/**
 * Wallet token balances from Vybe; enriched via Jupiter → pump.fun → Vybe for missing meta/logos.
 */

import type { AxiosInstance } from 'axios';
import type { VybeToken, VybeTokenBalance, VybeWalletTokenBalanceResponse } from '../types/api.js';
import { withRetry } from './client.js';
import { getToken } from './tokens.js';
import { toVybeSwapMint } from './sol-mints.js';
import { fetchJupiterAsset, fetchJupiterQuotePrice } from './jupiter-token-fallback.js';
import { resolveTokenMeta } from './resolve-token-meta.js';
import { WALLET_TOKEN_BALANCE_LIMIT } from '../wallet-balance-limit.js';
import { isMintLikeLabel } from './token-label.js';
import { getCachedTokenMetaFromDisk, cacheTokenMetaFromVybe } from '../token-icon-cache.js';
import {
  hydrateWalletHoldingsFromDiskCache,
  isBadHoldingsLabel,
  preferLocalHoldingsLogo,
  clientHoldingsLogoUrl,
} from './hydrate-wallet-holdings.js';
import { cacheMintProgramLabelFallback } from './mint-program-label.js';
import { materializeItemLogosLocal, materializeTokenLogoLocal } from './materialize-token-logo.js';
import { isEnrichBlacklisted } from './enrich-fail-blacklist.js';

export { WALLET_TOKEN_BALANCE_LIMIT };

const NATIVE_SOL_MINT = '11111111111111111111111111111111';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

function isPumpFunMint(mint: string): boolean {
  return mint.trim().toLowerCase().endsWith('pump');
}

export { NATIVE_SOL_MINT, WSOL_MINT };

/** Default Jupiter/pump meta enrich cap — matches GUI “Missing Logo Repair” top N. */
export const TOP_LOGO_REPAIR_N = 10;
/** Max meta enrich per request (GUI input max). */
export const TOP_LOGO_REPAIR_N_MAX = 20;
/** Force-disable stream enrich when wallet has more holdings than this. */
export const ENRICH_FORCE_DISABLE_TOKEN_COUNT = 100;
/** Force-disable stream enrich when wallet has more dead holdings than this. */
export const ENRICH_FORCE_DISABLE_DEAD_COUNT = 50;

/** Parallel enrichment for RPC-only stubs (Vybe balance rows are hydrated at merge). */
export const WALLET_BALANCE_ENRICH_CONCURRENCY = 20;


/** Vybe GET /v4/wallets/{owner}/token-balance — sort top holdings by USD value. */
export const VYBE_WALLET_TOKEN_BALANCE_SORT_BY_DESC = 'valueUsd';
/** Vybe API max per request (see GET /v4/wallets/{owner}/token-balance). */
export const VYBE_WALLET_TOKEN_BALANCE_MAX_LIMIT = 10_000;
/** Unverified Vybe marks above this USD holding value when 7d price history is all zero. */
export const VYBE_SUSPICIOUS_VALUE_USD_MIN = 100;

/** True when Vybe encodes a 7d point as zero (e.g. "0.000000"). */
export function vybeTrendPriceIsZero(value: unknown): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n === 0;
}

export function vybeTokenBalanceHasZeroPriceHistory(row: VybeTokenBalance): boolean {
  const trend = row.priceUsd7dTrend;
  if (!Array.isArray(trend) || trend.length === 0) return false;
  return trend.every(vybeTrendPriceIsZero);
}

/** Vybe row has no usable spot price (null, empty, zero, or non-finite). */
export function vybeTokenBalanceHasMissingOrZeroPrice(row: VybeTokenBalance): boolean {
  const raw = row.priceUsd;
  if (raw == null || String(raw).trim() === '') return true;
  const priceUsd = Number(raw);
  return !Number.isFinite(priceUsd) || priceUsd <= 0;
}

/** valueUsd above min with all-zero priceUsd7dTrend (verified or not). */
export function vybeTokenBalanceMatchesZero7dHighValueMark(
  row: VybeTokenBalance,
  minValueUsd = VYBE_SUSPICIOUS_VALUE_USD_MIN,
): boolean {
  const valueUsd = Number(row.valueUsd);
  return (
    Number.isFinite(valueUsd) &&
    valueUsd > minValueUsd &&
    vybeTokenBalanceHasZeroPriceHistory(row)
  );
}

/** Unverified dust: exactly 1 token or 1.xxxxx (1 ≤ amount < 2). */
export function walletBalanceHasSuspiciousUnitAmount(amountUi: number): boolean {
  return Number.isFinite(amountUi) && amountUi >= 1 && amountUi < 2;
}

/** Unverified: missing/zero price, ~1 token amount, or high valueUsd + zero 7d — skip logo enrich. */
export function isVybeSuspiciousHighValueMark(
  row: VybeTokenBalance,
  amountUi?: number,
): boolean {
  if (row.verified === true) return false;
  if (vybeTokenBalanceHasMissingOrZeroPrice(row)) return true;
  if (amountUi != null && walletBalanceHasSuspiciousUnitAmount(amountUi)) return true;
  return vybeTokenBalanceMatchesZero7dHighValueMark(row);
}

export function countVybeVerifiedZero7dHighValueMarks(
  rows: VybeTokenBalance[],
  minValueUsd = VYBE_SUSPICIOUS_VALUE_USD_MIN,
): number {
  return rows.filter(
    (row) => row.verified === true && vybeTokenBalanceMatchesZero7dHighValueMark(row, minValueUsd),
  ).length;
}

/** Mirrors public/app.js shouldMaskSuspiciousValueUsd — strip bogus USD marks from API. */
export function shouldMaskSuspiciousWalletUsdFields(item: WalletBalanceListItem): boolean {
  if (item.skipLogoEnrich !== true) return false;
  if (walletItemHasMissingOrZeroPrice(item)) return true;
  if (walletBalanceHasSuspiciousUnitAmount(item.amountUi)) return true;
  return Number.isFinite(item.valueUsd) && item.valueUsd > VYBE_SUSPICIOUS_VALUE_USD_MIN;
}

export function walletItemHasMissingOrZeroPrice(item: WalletBalanceListItem): boolean {
  const raw = item.priceUsd;
  if (raw == null) return true;
  const n = Number(raw);
  return !Number.isFinite(n) || n <= 0;
}

export function maskSuspiciousWalletBalanceItem(item: WalletBalanceListItem): WalletBalanceListItem {
  const logoUrl = clientHoldingsLogoUrl(item.mintAddress, item.logoUrl);
  const withLocalLogo = logoUrl === item.logoUrl ? item : { ...item, logoUrl };
  if (!shouldMaskSuspiciousWalletUsdFields(withLocalLogo)) return withLocalLogo;
  return {
    ...withLocalLogo,
    valueUsd: 0,
    valueSol: undefined,
    priceUsd: undefined,
    price1d: undefined,
    price7d: undefined,
    priceChange1dPct: undefined,
    priceChange7dPct: undefined,
    priceSource: undefined,
  };
}

function maskSuspiciousWalletBalanceList(items: WalletBalanceListItem[]): WalletBalanceListItem[] {
  return items.map(maskSuspiciousWalletBalanceItem);
}

export interface GetWalletTokenBalanceParams {
  ownerAddress: string;
  mintAddresses?: string[];
  includeNoPriceBalance?: boolean;
  sortByDesc?: string;
  sortByAsc?: string;
  limit?: number;
  page?: number;
}

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
  /** Skip Jupiter/pump logo repair — suspicious unverified Vybe mark. */
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

export async function getWalletTokenBalance(
  http: AxiosInstance,
  params: GetWalletTokenBalanceParams,
): Promise<VybeWalletTokenBalanceResponse> {
  const ownerAddress = params.ownerAddress.trim();
  if (!ownerAddress) throw new Error('Wallet address required');

  return withRetry(async () => {
    const query: Record<string, string | number | boolean | string[] | undefined> = {
      includeNoPriceBalance: params.includeNoPriceBalance ?? true,
      vybeTokenFilter: false,
    };
    if (params.mintAddresses?.length) query.mintAddresses = params.mintAddresses;
    if (params.sortByAsc) query.sortByAsc = params.sortByAsc;
    else query.sortByDesc = params.sortByDesc ?? VYBE_WALLET_TOKEN_BALANCE_SORT_BY_DESC;
    if (params.limit != null && params.limit >= 0) query.limit = params.limit;
    if (params.page != null && params.page >= 0) query.page = params.page;

    const { data } = await http.get<VybeWalletTokenBalanceResponse>(
      `/v4/wallets/${encodeURIComponent(ownerAddress)}/token-balance`,
      {
        params: query,
        paramsSerializer: {
          indexes: null,
        },
      },
    );
    return data;
  });
}

function rawToUiAmount(raw: string, decimals: number): number {
  const n = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const frac = n % base;
  if (frac === 0n) return Number(whole);
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return Number(`${whole}.${fracStr}`);
}

function uiAmountToRaw(amountUi: number, decimals: number): bigint {
  const fixed = amountUi.toFixed(Math.min(decimals, 12));
  const [wholePart, fracPart = ''] = fixed.split('.');
  const whole = BigInt(wholePart || '0');
  const frac = BigInt(fracPart.padEnd(decimals, '0').slice(0, decimals) || '0');
  return whole * 10n ** BigInt(decimals) + frac;
}

function balanceAmountToUi(amount: string, decimals: number): number {
  const trimmed = amount.trim();
  if (!trimmed) return 0;
  if (/[.eE]/.test(trimmed)) {
    const ui = Number(trimmed);
    return Number.isFinite(ui) ? ui : 0;
  }
  return rawToUiAmount(trimmed, decimals);
}

function balanceAmountToRaw(amount: string, decimals: number): bigint {
  return uiAmountToRaw(balanceAmountToUi(amount, decimals), decimals);
}

function holdingValueUsd(priceUsd: number, amountUi: number): number {
  if (!(priceUsd > 0) || !(amountUi > 0)) return 0;
  const value = priceUsd * amountUi;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function walletBalanceSortValue(item: WalletBalanceListItem): number {
  if (item.valueUsd > 0) return item.valueUsd;
  if (item.valueSol != null && item.valueSol > 0) return item.valueSol;
  return 0;
}

function sortWalletBalanceItems(items: WalletBalanceListItem[]): WalletBalanceListItem[] {
  return [...items].sort(
    (a, b) => walletBalanceSortValue(b) - walletBalanceSortValue(a) || b.amountUi - a.amountUi,
  );
}

/** Enrich symbol/logo/price via resolveTokenMeta (Jupiter → pump.fun → Vybe). */
function attachPriceSource(item: WalletBalanceListItem): WalletBalanceListItem {
  if (item.priceSource) return item;
  const disk = getCachedTokenMetaFromDisk(item.mintAddress);
  if (disk?.priceSource) return { ...item, priceSource: disk.priceSource };
  if (item.valueUsd > 0) return { ...item, priceSource: 'Vybe' };
  return item;
}

function vybeTrendPricePositive(raw: unknown): number | undefined {
  const p = Number(raw);
  return Number.isFinite(p) && p > 0 ? p : undefined;
}

/** First positive price walking from startIdx toward older (step -1) or newer (step +1) samples. */
function vybeTrendPositivePrice(
  trend: string[] | null | undefined,
  startIdx: number,
  step: -1 | 1,
): number | undefined {
  if (!Array.isArray(trend) || trend.length === 0) return undefined;
  for (let i = startIdx; i >= 0 && i < trend.length; i += step) {
    const p = vybeTrendPricePositive(trend[i]);
    if (p != null) return p;
  }
  return undefined;
}

function vybePrice1dFromBalanceRow(row: VybeTokenBalance, priceUsd?: number): number | undefined {
  if (priceUsd != null && Number.isFinite(priceUsd)) {
    const change1d = row.priceUsd1dChange != null ? Number(row.priceUsd1dChange) : NaN;
    if (Number.isFinite(change1d)) {
      const past = priceUsd - change1d;
      if (past > 0) return past;
    }
  }
  const trend = row.priceUsd7dTrend;
  if (Array.isArray(trend) && trend.length > 0) {
    return vybeTrendPricePositive(trend[0]);
  }
  return undefined;
}

function vybePrice7dFromBalanceRow(row: VybeTokenBalance, priceUsd?: number): number | undefined {
  const trend = row.priceUsd7dTrend;
  if (!Array.isArray(trend) || trend.length === 0) return undefined;
  const oldestIdx = trend.length - 1;
  const oldest = vybeTrendPricePositive(trend[oldestIdx]);
  if (oldest != null) return oldest;
  if (priceUsd == null || !Number.isFinite(priceUsd)) {
    return vybeTrendPositivePrice(trend, oldestIdx, -1);
  }
  for (let i = oldestIdx; i >= 0; i--) {
    const p = vybeTrendPricePositive(trend[i]);
    if (p != null && p !== priceUsd) return p;
  }
  return undefined;
}

function priceChange7dPctFromVybeRow(row: VybeTokenBalance, priceUsd?: number): number | undefined {
  const price7d = vybePrice7dFromBalanceRow(row, priceUsd);
  return clampTinyPriceChangePct(priceChangePct(priceUsd, price7d));
}

/** 1d % from priceUsd1dChange or priceUsd7dTrend[0]. Zero-baseline moves clamp to ±0.01. */
function priceChange1dPctFromVybeRow(row: VybeTokenBalance, priceUsd?: number): number | undefined {
  if (priceUsd == null || !Number.isFinite(priceUsd) || priceUsd <= 0) return undefined;
  const changeRaw = row.priceUsd1dChange;
  if (changeRaw != null && String(changeRaw).trim() !== '') {
    const change1d = Number(changeRaw);
    if (Number.isFinite(change1d)) {
      const past = priceUsd - change1d;
      if (past > 0) {
        const pct = priceChangePct(priceUsd, past);
        return clampTinyPriceChangePct(pct);
      }
      if (change1d > 0) return 0.01;
      if (change1d < 0) return -0.01;
    }
  }
  return clampTinyPriceChangePct(
    priceChangePct(priceUsd, vybePrice1dFromBalanceRow(row, priceUsd)),
  );
}

function clampTinyPriceChangePct(pct: number | undefined): number | undefined {
  if (pct == null || !Number.isFinite(pct) || pct === 0) return pct;
  if (pct > 0 && pct < 0.01) return 0.01;
  if (pct < 0 && pct > -0.01) return -0.01;
  return pct;
}

/** Map fields already present on Vybe wallet token-balance rows (no per-mint GET /v4/tokens). */
function vybeFieldsFromWalletBalanceRow(row: VybeTokenBalance): Partial<WalletBalanceListItem> {
  const priceUsdRaw = Number(row.priceUsd);
  const priceUsd =
    Number.isFinite(priceUsdRaw) && priceUsdRaw > 0 ? priceUsdRaw : undefined;
  const price1d = vybePrice1dFromBalanceRow(row, priceUsd);
  const price7d = vybePrice7dFromBalanceRow(row, priceUsd);
  return {
    priceUsd,
    price1d,
    price7d,
    priceChange1dPct: priceChange1dPctFromVybeRow(row, priceUsd),
    priceChange7dPct: priceChange7dPctFromVybeRow(row, priceUsd),
    category: typeof row.category === 'string' ? row.category.trim() || null : null,
    priceSource: priceUsd != null ? 'Vybe' : undefined,
  };
}

function walletItemHasVybeBalanceDetails(item: WalletBalanceListItem): boolean {
  return typeof item.priceUsd === 'number' && Number.isFinite(item.priceUsd) && item.priceUsd > 0;
}

export interface WalletBalanceEnrichStats {
  vybeHydrated: number;
  metaLookup: number;
  vybeTokenGet: number;
}

async function enrichWalletItemsConcurrently(
  http: AxiosInstance,
  items: WalletBalanceListItem[],
  stats?: WalletBalanceEnrichStats,
): Promise<WalletBalanceListItem[]> {
  if (items.length === 0) return [];
  const out = new Array<WalletBalanceListItem>(items.length);
  let next = 0;
  const workers = Math.min(WALLET_BALANCE_ENRICH_CONCURRENCY, items.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const idx = next++;
        if (idx >= items.length) break;
        out[idx] = await enrichWalletItemFull(http, items[idx]!, stats);
      }
    }),
  );
  return out;
}

function priceChangePct(current?: number, past?: number): number | undefined {
  if (
    typeof current !== 'number' ||
    typeof past !== 'number' ||
    !Number.isFinite(current) ||
    !Number.isFinite(past) ||
    past <= 0
  ) {
    return undefined;
  }
  return ((current - past) / past) * 100;
}

function vybeFieldsFromMeta(meta: {
  price?: number;
  price1d?: number;
  price7d?: number;
  priceUpdateTime?: number;
  isVerified?: boolean;
  category?: string;
  subcategory?: string;
  currentSupply?: number;
  marketCapUsd?: number;
  tokenAmountVolume24h?: number;
  usdValueVolume24h?: number;
}): Partial<WalletBalanceListItem> {
  const priceUsd = typeof meta.price === 'number' ? meta.price : undefined;
  const price1d = typeof meta.price1d === 'number' ? meta.price1d : undefined;
  const price7d = typeof meta.price7d === 'number' ? meta.price7d : undefined;
  return {
    priceUsd,
    price1d,
    price7d,
    priceChange1dPct: priceChangePct(priceUsd, price1d),
    priceChange7dPct: priceChangePct(priceUsd, price7d),
    category: meta.category?.trim() || null,
    subcategory: meta.subcategory?.trim() || null,
    currentSupply:
      typeof meta.currentSupply === 'number' && Number.isFinite(meta.currentSupply)
        ? meta.currentSupply
        : undefined,
    marketCap:
      typeof meta.marketCapUsd === 'number' && Number.isFinite(meta.marketCapUsd)
        ? meta.marketCapUsd
        : undefined,
    tokenAmountVolume24h:
      typeof meta.tokenAmountVolume24h === 'number' && Number.isFinite(meta.tokenAmountVolume24h)
        ? meta.tokenAmountVolume24h
        : undefined,
    usdValueVolume24h:
      typeof meta.usdValueVolume24h === 'number' && Number.isFinite(meta.usdValueVolume24h)
        ? meta.usdValueVolume24h
        : undefined,
    updateTime:
      typeof meta.priceUpdateTime === 'number' && Number.isFinite(meta.priceUpdateTime)
        ? meta.priceUpdateTime
        : undefined,
    verified: meta.isVerified === true,
  };
}

function vybeFieldsFromToken(token: VybeToken): Partial<WalletBalanceListItem> {
  const priceUsd = typeof token.price === 'number' ? token.price : undefined;
  const price1d = typeof token.price1d === 'number' ? token.price1d : undefined;
  const price7d = typeof token.price7d === 'number' ? token.price7d : undefined;
  return {
    priceUsd,
    price1d,
    price7d,
    priceChange1dPct: priceChangePct(priceUsd, price1d),
    priceChange7dPct: priceChangePct(priceUsd, price7d),
    category: typeof token.category === 'string' ? token.category.trim() || null : null,
    subcategory: typeof token.subcategory === 'string' ? token.subcategory.trim() || null : null,
    currentSupply:
      typeof token.currentSupply === 'number' && Number.isFinite(token.currentSupply)
        ? token.currentSupply
        : undefined,
    marketCap:
      typeof token.marketCap === 'number' && Number.isFinite(token.marketCap)
        ? token.marketCap
        : undefined,
    tokenAmountVolume24h:
      typeof token.tokenAmountVolume24h === 'number' && Number.isFinite(token.tokenAmountVolume24h)
        ? token.tokenAmountVolume24h
        : undefined,
    usdValueVolume24h:
      typeof token.usdValueVolume24h === 'number' && Number.isFinite(token.usdValueVolume24h)
        ? token.usdValueVolume24h
        : undefined,
    updateTime:
      typeof token.updateTime === 'number' && Number.isFinite(token.updateTime)
        ? token.updateTime
        : undefined,
    verified: token.verified === true,
  };
}

function mergeVybeFields(
  item: WalletBalanceListItem,
  fields: Partial<WalletBalanceListItem>,
): WalletBalanceListItem {
  return {
    ...item,
    ...fields,
    verified: fields.verified === true || item.verified,
    category: fields.category ?? item.category ?? null,
    subcategory: fields.subcategory ?? item.subcategory ?? null,
  };
}

function metaHasVybeTaxonomy(meta: ReturnType<typeof getCachedTokenMetaFromDisk>): boolean {
  if (!meta) return false;
  return Boolean(
    meta.category?.trim() ||
      meta.subcategory?.trim() ||
      (typeof meta.price1d === 'number' && Number.isFinite(meta.price1d)),
  );
}

async function attachVybeTokenDetails(
  http: AxiosInstance,
  item: WalletBalanceListItem,
): Promise<WalletBalanceListItem> {
  const disk = getCachedTokenMetaFromDisk(item.mintAddress);
  if (metaHasVybeTaxonomy(disk)) {
    return mergeVybeFields(item, vybeFieldsFromMeta(disk!));
  }

  try {
    const token = await getToken(http, item.mintAddress);
    await cacheTokenMetaFromVybe(item.mintAddress, {
      ...token,
      decimals:
        typeof token.decimal === 'number'
          ? token.decimal
          : typeof token.decimals === 'number'
            ? token.decimals
            : item.decimals,
      priceUpdateTime: token.updateTime,
      priceSource: 'Vybe',
    });
    const refreshed = getCachedTokenMetaFromDisk(item.mintAddress);
    if (refreshed) return mergeVybeFields(item, vybeFieldsFromMeta(refreshed));
    return mergeVybeFields(item, vybeFieldsFromToken(token));
  } catch {
    if (disk) return mergeVybeFields(item, vybeFieldsFromMeta(disk));
    return item;
  }
}

async function enrichWalletItemFull(
  http: AxiosInstance,
  item: WalletBalanceListItem,
  stats?: WalletBalanceEnrichStats,
): Promise<WalletBalanceListItem> {
  if (walletItemHasVybeBalanceDetails(item) && !needsEnrichment(item)) {
    if (stats) stats.vybeHydrated += 1;
    return attachPriceSource(item);
  }
  const metaEnriched = needsEnrichment(item)
    ? await enrichWalletItemMeta(http, item, stats)
    : attachPriceSource(item);
  if (walletItemHasVybeBalanceDetails(metaEnriched)) {
    if (stats) stats.vybeHydrated += 1;
    return metaEnriched;
  }
  if (stats) stats.vybeTokenGet += 1;
  return attachVybeTokenDetails(http, metaEnriched);
}

async function enrichWalletItemMeta(
  http: AxiosInstance,
  item: WalletBalanceListItem,
  stats?: WalletBalanceEnrichStats,
): Promise<WalletBalanceListItem> {
  const diskFirst = hydrateWalletHoldingsFromDiskCache([item]).items[0] ?? item;
  const hasLogo = Boolean(diskFirst.logoUrl?.trim());
  const hasUsd =
    (Number.isFinite(diskFirst.valueUsd) && diskFirst.valueUsd > 0) ||
    (diskFirst.valueSol != null && diskFirst.valueSol > 0);
  const badSymbol = isBadHoldingsLabel(diskFirst.symbol, diskFirst.mintAddress);
  if (hasLogo && hasUsd && !badSymbol && !diskFirst.enrichmentPending) {
    return attachPriceSource(diskFirst);
  }
  if (diskFirst.skipLogoEnrich) return attachPriceSource(diskFirst);

  if (stats) stats.metaLookup += 1;
  const resolveOpts = badSymbol ? { preferVybe: true as const } : { skipVybe: true as const };
  let resolved = await resolveTokenMeta(http, diskFirst.mintAddress, resolveOpts);

  if (!resolved || isBadHoldingsLabel(resolved.meta.symbol, diskFirst.mintAddress)) {
    try {
      const asset = await fetchJupiterAsset(toVybeSwapMint(diskFirst.mintAddress));
      const symbol = asset?.symbol?.trim() || '';
      if (symbol && !isMintLikeLabel(symbol, diskFirst.mintAddress)) {
        const meta = await cacheTokenMetaFromVybe(diskFirst.mintAddress, {
          mintAddress: diskFirst.mintAddress,
          symbol,
          name: asset?.name?.trim() || symbol,
          decimals: asset?.decimals ?? diskFirst.decimals,
          logoUrl: asset?.logoUrl || undefined,
          verified: asset?.verified === true,
          isVerified: asset?.verified === true,
          priceFetchedAt: Date.now(),
          priceSource: 'Jupiter',
        });
        resolved = { meta, source: 'Jupiter' };
      }
    } catch {
      /* continue to program label */
    }
  }

  if (!resolved || isBadHoldingsLabel(resolved.meta.symbol, diskFirst.mintAddress)) {
    const fallback = await cacheMintProgramLabelFallback(diskFirst.mintAddress);
    if (fallback) {
      resolved = { meta: fallback, source: 'RPC' };
    }
  }

  if (!resolved) {
    return {
      ...diskFirst,
      logoUrl: preferLocalHoldingsLogo(diskFirst.mintAddress, diskFirst.logoUrl),
      enrichmentPending: false,
    };
  }

  const { meta } = resolved;
  let valueUsd = diskFirst.valueUsd;
  let valueSol = diskFirst.valueSol;
  if (!hasUsd && typeof meta.price === 'number' && meta.price > 0) {
    valueUsd = holdingValueUsd(meta.price, diskFirst.amountUi);
    valueSol = undefined;
  }

  const nextSymbol =
    meta.symbol?.trim() && !isBadHoldingsLabel(meta.symbol, diskFirst.mintAddress)
      ? meta.symbol.trim()
      : diskFirst.symbol;
  const nextName =
    meta.name?.trim() && !isBadHoldingsLabel(meta.name, diskFirst.mintAddress)
      ? meta.name.trim()
      : diskFirst.name;

  return attachPriceSource(
    mergeVybeFields(
      {
        ...diskFirst,
        symbol: nextSymbol,
        name: nextName,
        logoUrl:
          clientHoldingsLogoUrl(
            diskFirst.mintAddress,
            preferLocalHoldingsLogo(diskFirst.mintAddress, meta.logoUrl) ||
              preferLocalHoldingsLogo(diskFirst.mintAddress, diskFirst.logoUrl) ||
              meta.logoUrl?.trim() ||
              diskFirst.logoUrl,
          ) ||
          (await materializeTokenLogoLocal(
            diskFirst.mintAddress,
            meta.logoUrl?.trim() || diskFirst.logoUrl,
          )),
        decimals: meta.decimals ?? diskFirst.decimals,
        verified: meta.isVerified ?? diskFirst.verified,
        valueUsd,
        valueSol,
        priceSource: meta.priceSource ?? resolved.source,
        enrichmentPending: false,
      },
      vybeFieldsFromMeta(meta),
    ),
  );
}

export interface MergedWalletBalances {
  items: WalletBalanceListItem[];
}

export async function fetchWalletBalancesFromVybe(
  http: AxiosInstance,
  ownerAddress: string,
  limit = WALLET_TOKEN_BALANCE_LIMIT,
): Promise<MergedWalletBalances> {
  const label = ownerAddress.trim().slice(0, 8);
  const mergeStart = Date.now();
  const vybeStarted = Date.now();

  let balanceData: VybeTokenBalance[] = [];
  try {
    const balance = await getWalletTokenBalance(http, {
      ownerAddress,
      includeNoPriceBalance: true,
      sortByDesc: VYBE_WALLET_TOKEN_BALANCE_SORT_BY_DESC,
      limit: Math.min(limit, VYBE_WALLET_TOKEN_BALANCE_MAX_LIMIT),
    });
    balanceData = Array.isArray(balance.data) ? balance.data : [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[wallet-balance] Vybe token list failed: ${msg}`);
    balanceData = [];
  }
  console.info(
    `[wallet-balance] ${label} fetch vybe=${Date.now() - vybeStarted}ms vybeRows=${balanceData.length}`,
  );

  const verifiedZero7dHighValueCount = countVybeVerifiedZero7dHighValueMarks(balanceData);
  if (verifiedZero7dHighValueCount > 0) {
    console.info(
      `[wallet-balance] ${verifiedZero7dHighValueCount} verified token(s) with valueUsd > $${VYBE_SUSPICIOUS_VALUE_USD_MIN} and zero 7d trend — kept (unverified-only filter)`,
    );
  }

  const skipLogoEnrichCount = balanceData.filter((row) => isVybeSuspiciousHighValueMark(row)).length;
  if (skipLogoEnrichCount > 0) {
    console.info(
      `[wallet-balance] ${skipLogoEnrichCount} unverified token(s) with missing/zero price, ~1 token amount, or valueUsd > $${VYBE_SUSPICIOUS_VALUE_USD_MIN} + zero 7d — skip logo enrich`,
    );
  }

  const items = balanceData
    .map((row) => {
      const decimals = Number(row.decimals);
      const mintAddress = row.mintAddress.trim();
      if (!Number.isFinite(decimals) || decimals < 0) return null;
      const amountUi = balanceAmountToUi(row.amount, decimals);
      if (!(amountUi > 0)) return null;
      const amountExact = balanceAmountToRaw(row.amount, decimals).toString();
      const skipLogoEnrich = isVybeSuspiciousHighValueMark(row, amountUi);
      const rawSymbol = row.symbol?.trim() ?? '';
      const rawName = row.name?.trim() ?? '';
      const rawSymbolBad = isBadHoldingsLabel(rawSymbol, mintAddress);
      const rawNameBad = isBadHoldingsLabel(rawName, mintAddress);
      const symbol = !rawSymbolBad ? rawSymbol : mintAddress.slice(0, 6);
      const name = !rawNameBad ? rawName : symbol;
      let valueUsd = Number(row.valueUsd);
      if (!Number.isFinite(valueUsd)) valueUsd = 0;
      const enrichmentPending =
        !skipLogoEnrich &&
        (valueUsd <= 0 ||
          !row.logoUrl?.trim() ||
          rawSymbolBad ||
          isBadHoldingsLabel(symbol, mintAddress));
      // Keep remote logo hints here for materializeItemLogosLocal. Mask to
      // client-safe local paths only on stream/API emit (maskSuspicious*).
      const item: WalletBalanceListItem = {
        mintAddress,
        symbol,
        name,
        logoUrl: preferLocalHoldingsLogo(mintAddress, row.logoUrl?.trim() || null),
        decimals,
        amountUi,
        amountExact,
        valueUsd,
        verified: row.verified === true,
        enrichmentPending,
        skipLogoEnrich: skipLogoEnrich || undefined,
        ...vybeFieldsFromWalletBalanceRow(row),
      };
      return item;
    })
    .filter((row): row is WalletBalanceListItem => row !== null);

  const resultItems = sortWalletBalanceItems(items).slice(0, limit);
  const { items: hydratedItems, hydrated } = hydrateWalletHoldingsFromDiskCache(resultItems);
  if (hydrated > 0) {
    console.info(`[wallet-balance] ${label} disk-hydrate applied to ${hydrated} holding(s)`);
  }
  logMergeResult(label, mergeStart, balanceData.length, skipLogoEnrichCount, hydratedItems.length);

  return { items: hydratedItems };
}


function logMergeResult(
  label: string,
  mergeStart: number,
  balanceRowCount: number,
  excludedSuspiciousCount: number,
  itemCount: number,
): void {
  console.info(
    `[wallet-balance] ${label} merge done in ${Date.now() - mergeStart}ms — vybeRows=${balanceRowCount} skipLogoEnrich=${excludedSuspiciousCount} items=${itemCount}`,
  );
}

function resolveMetaEnrichLimit(raw: number | null | undefined, enrichEnabled: boolean): number {
  if (!enrichEnabled) return 0;
  if (raw == null || !Number.isFinite(raw)) return TOP_LOGO_REPAIR_N;
  const n = Math.floor(raw);
  if (n <= 0) return 0;
  return Math.min(n, TOP_LOGO_REPAIR_N_MAX);
}

/** Same “dead” rule as the holdings pie: no usable 1d and no usable 7d change %. */
export function isDeadWalletHolding(item: WalletBalanceListItem): boolean {
  const d1 = Number(item.priceChange1dPct);
  const d7 = Number(item.priceChange7dPct);
  const has1d = Number.isFinite(d1);
  const has7d = Number.isFinite(d7);
  return !has1d && !has7d;
}

export function countDeadWalletHoldings(items: WalletBalanceListItem[]): number {
  return items.reduce((n, item) => n + (isDeadWalletHolding(item) ? 1 : 0), 0);
}

/** Large / mostly-dead wallets: skip Jupiter/pump.fun stream enrich entirely. */
export function shouldForceDisableStreamEnrich(items: WalletBalanceListItem[]): boolean {
  if (items.length > ENRICH_FORCE_DISABLE_TOKEN_COUNT) return true;
  return countDeadWalletHoldings(items) > ENRICH_FORCE_DISABLE_DEAD_COUNT;
}

/**
 * Enrich only rows that pass filters:
 * not suspicious skipLogoEnrich, not dead, not enrich-blacklisted, still needs meta/logo.
 */
function isEligibleForStreamEnrich(item: WalletBalanceListItem): boolean {
  if (item.skipLogoEnrich) return false;
  if (isDeadWalletHolding(item)) return false;
  return needsEnrichment(item);
}

async function enrichWalletBalanceList(
  http: AxiosInstance,
  items: WalletBalanceListItem[],
  enrichLimit: number,
  label: string,
): Promise<WalletBalanceListItem[]> {
  const sorted = sortWalletBalanceItems(items);
  if (enrichLimit <= 0) return sorted;

  const eligible = sorted.filter(isEligibleForStreamEnrich);
  const toEnrich = eligible.slice(0, enrichLimit);
  const enrichStart = Date.now();
  const stats: WalletBalanceEnrichStats = { vybeHydrated: 0, metaLookup: 0, vybeTokenGet: 0 };
  const enrichedTop = await enrichWalletItemsConcurrently(http, toEnrich, stats);
  const enrichedByMint = new Map(enrichedTop.map((item) => [item.mintAddress, item]));
  console.info(
    `[wallet-balance] ${label} enrich done in ${Date.now() - enrichStart}ms — metaEnrich=${toEnrich.length}/${eligible.length} eligible vybeHydrated=${stats.vybeHydrated} metaLookup=${stats.metaLookup} vybeTokenGet=${stats.vybeTokenGet}`,
  );
  return sorted.map((item) => enrichedByMint.get(item.mintAddress) ?? item);
}

function needsEnrichment(item: WalletBalanceListItem): boolean {
  if (item.skipLogoEnrich) return false;
  if (isEnrichBlacklisted(item.mintAddress)) return false;
  if (item.enrichmentPending) return true;
  if (isBadHoldingsLabel(item.symbol, item.mintAddress)) return true;
  const hasUsd =
    (Number.isFinite(item.valueUsd) && item.valueUsd > 0) ||
    (item.valueSol != null && item.valueSol > 0);
  const hasLocalLogo = Boolean(clientHoldingsLogoUrl(item.mintAddress, item.logoUrl));
  return !hasUsd || !hasLocalLogo;
}

/** Stream balances: initial merge, then per-token enrichment updates. */
export async function streamWalletTokenBalances(
  http: AxiosInstance,
  ownerAddress: string,
  limit: number,
  emit: (event: WalletBalanceStreamEvent) => void,
  isCancelled?: () => boolean,
  options?: { enrich?: boolean; enrichLimit?: number },
): Promise<void> {
  const enrich = options?.enrich !== false;
  let enrichLimit = resolveMetaEnrichLimit(options?.enrichLimit, enrich);
  const label = ownerAddress.trim().slice(0, 8);
  const { items } = await fetchWalletBalancesFromVybe(http, ownerAddress, limit);
  if (isCancelled?.()) return;

  if (enrichLimit > 0 && shouldForceDisableStreamEnrich(items)) {
    const dead = countDeadWalletHoldings(items);
    console.info(
      `[wallet-balance] ${label} force-disable enrich — tokens=${items.length} dead=${dead} (limits >${ENRICH_FORCE_DISABLE_TOKEN_COUNT} tokens or >${ENRICH_FORCE_DISABLE_DEAD_COUNT} dead)`,
    );
    enrichLimit = 0;
  }

  emit({ event: 'initial', tokens: maskSuspiciousWalletBalanceList(items) });
  // Yield so the initial NDJSON frame can flush before slow enrich / logo download.
  await new Promise<void>((resolve) => setImmediate(resolve));

  let working = items;
  // After initial: download Vybe remote logos to disk for top N even when meta
  // enrich is force-disabled (repair=Jupiter/pump only when enrich is on).
  const logoLimit = Math.max(enrichLimit, TOP_LOGO_REPAIR_N_MAX);
  if (logoLimit > 0) {
    const logoStart = Date.now();
    const allowRepair = enrichLimit > 0;
    working = await materializeItemLogosLocal(working, {
      limit: logoLimit,
      concurrency: 8,
      allowRepair,
      onResolved: async (item) => {
        if (isCancelled?.()) return;
        emit({ event: 'update', token: maskSuspiciousWalletBalanceItem(item) });
      },
    });
    console.info(
      `[wallet-balance] ${label} logo-materialize done in ${Date.now() - logoStart}ms (cap ${logoLimit}, repair=${allowRepair})`,
    );
  }

  if (enrichLimit > 0) {
    const metaEnrichMints = new Set(
      sortWalletBalanceItems(working)
        .filter(isEligibleForStreamEnrich)
        .slice(0, enrichLimit)
        .map((item) => item.mintAddress),
    );
    working = await enrichWalletBalanceList(http, working, enrichLimit, label);
    for (const item of working) {
      if (isCancelled?.()) return;
      if (metaEnrichMints.has(item.mintAddress)) {
        emit({ event: 'update', token: maskSuspiciousWalletBalanceItem(item) });
      }
    }
  }

  if (!isCancelled?.()) emit({ event: 'done' });
}

export async function listWalletTokenBalances(
  http: AxiosInstance,
  ownerAddress: string,
  limit = WALLET_TOKEN_BALANCE_LIMIT,
  options?: { enrich?: boolean; enrichLimit?: number },
): Promise<WalletBalanceListItem[]> {
  const enrich = options?.enrich === true;
  let enrichLimit = resolveMetaEnrichLimit(options?.enrichLimit, enrich);
  const label = ownerAddress.trim().slice(0, 8);
  const { items } = await fetchWalletBalancesFromVybe(http, ownerAddress, limit);
  let result = items.slice(0, limit);
  if (enrichLimit > 0 && shouldForceDisableStreamEnrich(result)) {
    enrichLimit = 0;
  }
  if (!enrich) return maskSuspiciousWalletBalanceList(result);

  result = await materializeItemLogosLocal(result, {
    limit: Math.max(enrichLimit, TOP_LOGO_REPAIR_N_MAX),
    concurrency: 8,
    allowRepair: false,
  });
  result = await enrichWalletBalanceList(http, result, enrichLimit, label);
  return maskSuspiciousWalletBalanceList(sortWalletBalanceItems(result).slice(0, limit));
}

export async function getWalletSolBalanceUi(
  http: AxiosInstance,
  ownerAddress: string,
): Promise<number> {
  const balance = await getWalletTokenBalance(http, {
    ownerAddress,
    includeNoPriceBalance: true,
  });
  let totalRaw = 0n;
  for (const row of balance.data) {
    const mint = row.mintAddress.trim();
    if (mint !== NATIVE_SOL_MINT && mint !== WSOL_MINT) continue;
    const decimals = Number(row.decimals);
    if (!Number.isFinite(decimals) || decimals < 0) continue;
    totalRaw += balanceAmountToRaw(row.amount, decimals);
  }
  return rawToUiAmount(totalRaw.toString(), 9);
}
