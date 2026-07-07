/**
 * Wallet token balances: Vybe + on-chain RPC merge, enriched via Jupiter → pump.fun → Vybe.
 */

import type { AxiosInstance } from 'axios';
import type { VybeToken, VybeTokenBalance, VybeWalletTokenBalanceResponse } from '../types/api.js';
import { withRetry } from './client.js';
import { getToken } from './tokens.js';
import { toVybeSwapMint } from './sol-mints.js';
import { fetchJupiterAsset, fetchJupiterQuotePrice } from './jupiter-token-fallback.js';
import { resolveTokenMeta } from './resolve-token-meta.js';
import { fetchRpcWalletBalances, RPC_NATIVE_SOL_MINT } from './wallet-rpc-balance.js';
import type { RpcMintBalance } from './wallet-rpc-balance.js';
import { WALLET_TOKEN_BALANCE_LIMIT } from '../wallet-balance-limit.js';
import { isMintLikeLabel } from './token-label.js';
import { getCachedTokenMetaFromDisk, cacheTokenMetaFromVybe } from '../token-icon-cache.js';

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

/** Parallel enrichment for RPC-only stubs (Vybe balance rows are hydrated at merge). */
export const WALLET_BALANCE_ENRICH_CONCURRENCY = 20;

/** Max RPC-only mints (not in Vybe list) to add and queue for meta enrich — top by on-chain amount. */
export const RPC_ONLY_ENRICH_LIMIT = TOP_LOGO_REPAIR_N;

/** Vybe GET /v4/wallets/{owner}/token-balance — sort top holdings by USD value. */
export const VYBE_WALLET_TOKEN_BALANCE_SORT_BY_DESC = 'valueUsd';
/** Vybe API max per request (see GET /v4/wallets/{owner}/token-balance). */
export const VYBE_WALLET_TOKEN_BALANCE_MAX_LIMIT = 10_000;
/** Exclude unverified Vybe marks at/above this price when 7d price history is all zero. */
export const VYBE_SUSPICIOUS_PRICE_USD_MIN = 0.00001;

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

/** priceUsd at/above min with all-zero priceUsd7dTrend (verified or not). */
export function vybeTokenBalanceMatchesZero7dHighValueMark(
  row: VybeTokenBalance,
  minPriceUsd = VYBE_SUSPICIOUS_PRICE_USD_MIN,
): boolean {
  const priceUsd = Number(row.priceUsd);
  return (
    Number.isFinite(priceUsd) &&
    priceUsd >= minPriceUsd &&
    vybeTokenBalanceHasZeroPriceHistory(row)
  );
}

/** Unverified Vybe marks with suspicious price + zero 7d — keep in list, skip missing-logo fetch/repair. */
export function isVybeSuspiciousHighValueMark(row: VybeTokenBalance): boolean {
  if (row.verified === true) return false;
  return vybeTokenBalanceMatchesZero7dHighValueMark(row);
}

export function countVybeVerifiedZero7dHighValueMarks(
  rows: VybeTokenBalance[],
  minPriceUsd = VYBE_SUSPICIOUS_PRICE_USD_MIN,
): number {
  return rows.filter(
    (row) => row.verified === true && vybeTokenBalanceMatchesZero7dHighValueMark(row, minPriceUsd),
  ).length;
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
  priceSource?: 'Vybe' | 'Jupiter' | 'Pumpfun-API';
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

function rpcAmountUi(rpc: RpcMintBalance): number {
  return rawToUiAmount(rpc.amountRaw.toString(), rpc.decimals);
}

export interface RpcOnlyEnrichTarget {
  rpc: RpcMintBalance;
  displayMint: string;
  defaultSymbol?: string;
  defaultName?: string;
}

function stubWalletItemFromRpc(
  rpc: RpcMintBalance,
  options?: { displayMint?: string; defaultSymbol?: string; defaultName?: string },
): WalletBalanceListItem | null {
  if (rpc.amountRaw <= 0n) return null;
  const displayMint = (options?.displayMint ?? rpc.mintAddress).trim();
  const amountExact = rpc.amountRaw.toString();
  const decimals = rpc.decimals;
  const amountUi = rawToUiAmount(amountExact, decimals);
  if (!(amountUi > 0)) return null;
  const symbol = options?.defaultSymbol?.trim() || displayMint.slice(0, 6);
  const name = options?.defaultName?.trim() || symbol;
  return {
    mintAddress: displayMint,
    symbol,
    name,
    logoUrl: null,
    decimals,
    amountUi,
    amountExact,
    valueUsd: 0,
    verified: false,
    enrichmentPending: true,
  };
}

async function enrichRpcOnlyFromJupiter(
  displayMint: string,
  rpc: RpcMintBalance,
  state: {
    decimals: number;
    symbol: string;
    name: string;
    logoUrl: string | null;
    verified: boolean;
    valueUsd: number;
    valueSol?: number;
  },
): Promise<void> {
  const apiMint = toVybeSwapMint(displayMint);

  try {
    const asset = await fetchJupiterAsset(apiMint);
    if (asset) {
      if (asset.symbol) state.symbol = asset.symbol;
      if (asset.name) state.name = asset.name;
      if (asset.logoUrl && !isPumpFunMint(displayMint)) state.logoUrl = asset.logoUrl;
      if (asset.verified) state.verified = asset.verified;
      if (asset.decimals != null) state.decimals = asset.decimals;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[wallet-balance] Jupiter asset failed for ${apiMint.slice(0, 8)}…: ${msg}`);
  }

  try {
    const quote = await fetchJupiterQuotePrice(apiMint, state.decimals);
    if (quote) {
      const amountUi = rawToUiAmount(rpc.amountRaw.toString(), state.decimals);
      state.valueUsd = holdingValueUsd(quote.priceUsd, amountUi);
      state.valueSol = undefined;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[wallet-balance] Jupiter quote failed for ${apiMint.slice(0, 8)}…: ${msg}`);
  }
}

/** Enrich symbol/logo/price via resolveTokenMeta (Jupiter → pump.fun → Vybe). */
function attachPriceSource(item: WalletBalanceListItem): WalletBalanceListItem {
  if (item.priceSource) return item;
  const disk = getCachedTokenMetaFromDisk(item.mintAddress);
  if (disk?.priceSource) return { ...item, priceSource: disk.priceSource };
  if (item.valueUsd > 0) return { ...item, priceSource: 'Vybe' };
  return item;
}

function vybePrice1dFromBalanceRow(row: VybeTokenBalance, priceUsd?: number): number | undefined {
  const change1d = row.priceUsd1dChange != null ? Number(row.priceUsd1dChange) : NaN;
  if (priceUsd != null && Number.isFinite(change1d)) {
    const past = priceUsd - change1d;
    if (past > 0) return past;
  }
  const trend = row.priceUsd7dTrend;
  if (Array.isArray(trend) && trend.length >= 2) {
    const p = Number(trend[trend.length - 2]);
    if (Number.isFinite(p) && p > 0) return p;
  }
  return undefined;
}

function vybePrice7dFromBalanceRow(row: VybeTokenBalance): number | undefined {
  const trend = row.priceUsd7dTrend;
  if (!Array.isArray(trend) || trend.length === 0) return undefined;
  const p = Number(trend[0]);
  return Number.isFinite(p) && p > 0 ? p : undefined;
}

/** Map fields already present on Vybe wallet token-balance rows (no per-mint GET /v4/tokens). */
function vybeFieldsFromWalletBalanceRow(row: VybeTokenBalance): Partial<WalletBalanceListItem> {
  const priceUsdRaw = Number(row.priceUsd);
  const priceUsd =
    Number.isFinite(priceUsdRaw) && priceUsdRaw > 0 ? priceUsdRaw : undefined;
  const price1d = vybePrice1dFromBalanceRow(row, priceUsd);
  const price7d = vybePrice7dFromBalanceRow(row);
  return {
    priceUsd,
    price1d,
    price7d,
    priceChange1dPct: priceChangePct(priceUsd, price1d),
    priceChange7dPct: priceChangePct(priceUsd, price7d),
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
  const hasLogo = Boolean(item.logoUrl?.trim());
  const hasUsd =
    (Number.isFinite(item.valueUsd) && item.valueUsd > 0) ||
    (item.valueSol != null && item.valueSol > 0);
  if (hasLogo && hasUsd && !item.enrichmentPending) return attachPriceSource(item);
  if (item.skipLogoEnrich) return attachPriceSource(item);

  if (stats) stats.metaLookup += 1;
  const resolved = await resolveTokenMeta(http, item.mintAddress, { skipVybe: true });
  if (!resolved) {
    return { ...item, enrichmentPending: false };
  }

  const { meta } = resolved;
  let valueUsd = item.valueUsd;
  let valueSol = item.valueSol;
  if (!hasUsd && typeof meta.price === 'number' && meta.price > 0) {
    valueUsd = holdingValueUsd(meta.price, item.amountUi);
    valueSol = undefined;
  }

  return attachPriceSource({
    ...item,
    symbol: meta.symbol?.trim() || item.symbol,
    name: meta.name?.trim() || item.name,
    logoUrl: meta.logoUrl?.trim() || item.logoUrl,
    decimals: meta.decimals ?? item.decimals,
    verified: meta.isVerified ?? item.verified,
    valueUsd,
    valueSol,
    priceSource: meta.priceSource ?? resolved.source,
    enrichmentPending: false,
  });
}

export async function enrichRpcOnlyWalletItem(
  http: AxiosInstance,
  target: RpcOnlyEnrichTarget,
): Promise<WalletBalanceListItem | null> {
  const { rpc, displayMint, defaultSymbol, defaultName } = target;
  const stub = stubWalletItemFromRpc(rpc, {
    displayMint,
    defaultSymbol,
    defaultName,
  });
  if (!stub) return null;
  return enrichWalletItemMeta(http, stub);
}

async function enrichRpcOnlyTargets(
  http: AxiosInstance,
  items: WalletBalanceListItem[],
  targets: RpcOnlyEnrichTarget[],
  label: string,
): Promise<WalletBalanceListItem[]> {
  if (targets.length === 0) return items;
  const enrichStart = Date.now();
  const enriched: WalletBalanceListItem[] = [];
  let next = 0;
  const workers = Math.min(WALLET_BALANCE_ENRICH_CONCURRENCY, targets.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const idx = next++;
        if (idx >= targets.length) break;
        const item = await enrichRpcOnlyWalletItem(http, targets[idx]!);
        if (item) enriched.push(item);
      }
    }),
  );
  const enrichedByMint = new Map(enriched.map((item) => [item.mintAddress, item]));
  console.info(
    `[wallet-balance] ${label} rpc-only enrich done in ${Date.now() - enrichStart}ms — enriched=${enriched.length}/${targets.length}`,
  );
  return items.map((item) => enrichedByMint.get(item.mintAddress) ?? item);
}

async function fetchRpcWalletBalancesSafe(
  ownerAddress: string,
): Promise<{
  rpcByMint: Map<string, RpcMintBalance>;
  rpcOk: boolean;
}> {
  try {
    const rpcByMint = await fetchRpcWalletBalances(ownerAddress);
    return { rpcByMint, rpcOk: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[wallet-balance] RPC balance fetch failed, using Vybe amounts only: ${msg}`);
    return { rpcByMint: new Map(), rpcOk: false };
  }
}

function resolveAmountFromRpc(
  mintAddress: string,
  vybeDecimals: number,
  vybeAmount: string,
  rpcByMint: Map<string, RpcMintBalance>,
  rpcOk: boolean,
): { amountUi: number; amountExact: string; decimals: number } | null {
  const rpc =
    rpcByMint.get(mintAddress) ??
    (mintAddress === NATIVE_SOL_MINT ? rpcByMint.get(RPC_NATIVE_SOL_MINT) : undefined);

  if (rpcOk) {
    const decimals =
      rpc != null
        ? vybeDecimals >= 0
          ? vybeDecimals
          : rpc.decimals
        : vybeDecimals;
    if (!Number.isFinite(decimals) || decimals < 0) return null;
    const amountRaw = rpc?.amountRaw ?? 0n;
    const amountExact = amountRaw.toString();
    const amountUi = rawToUiAmount(amountExact, decimals);
    if (!(amountUi > 0)) return null;
    return { amountExact, amountUi, decimals };
  }

  if (rpc && rpc.amountRaw > 0n) {
    const decimals = vybeDecimals >= 0 ? vybeDecimals : rpc.decimals;
    const amountExact = rpc.amountRaw.toString();
    return {
      amountExact,
      amountUi: rawToUiAmount(amountExact, decimals),
      decimals,
    };
  }
  const vybeDec = vybeDecimals;
  if (!Number.isFinite(vybeDec) || vybeDec < 0) return null;
  const amountUi = balanceAmountToUi(vybeAmount, vybeDec);
  if (!(amountUi > 0)) return null;
  return {
    amountUi,
    amountExact: balanceAmountToRaw(vybeAmount, vybeDec).toString(),
    decimals: vybeDec,
  };
}

export interface MergedWalletBalances {
  items: WalletBalanceListItem[];
  rpcOnlyToEnrich: RpcOnlyEnrichTarget[];
}

export async function mergeWalletBalancesFromRpcAndVybe(
  http: AxiosInstance,
  ownerAddress: string,
  limit = WALLET_TOKEN_BALANCE_LIMIT,
): Promise<MergedWalletBalances> {
  const label = ownerAddress.trim().slice(0, 8);
  const mergeStart = Date.now();
  let vybeMs = 0;
  let rpcMs = 0;

  const vybeStarted = Date.now();
  const vybePromise = getWalletTokenBalance(http, {
    ownerAddress,
    includeNoPriceBalance: true,
    sortByDesc: VYBE_WALLET_TOKEN_BALANCE_SORT_BY_DESC,
    limit: Math.min(limit, VYBE_WALLET_TOKEN_BALANCE_MAX_LIMIT),
  })
    .then((result) => {
      vybeMs = Date.now() - vybeStarted;
      return result;
    })
    .catch((err: unknown) => {
      vybeMs = Date.now() - vybeStarted;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[wallet-balance] Vybe token list failed, using RPC-only: ${msg}`);
      return null;
    });

  const rpcStarted = Date.now();
  const rpcPromise = fetchRpcWalletBalancesSafe(ownerAddress).then((result) => {
    rpcMs = Date.now() - rpcStarted;
    return result;
  });

  const [balanceResult, { rpcByMint, rpcOk }] = await Promise.all([vybePromise, rpcPromise]);

  const balance = balanceResult ?? { data: [] };

  if (rpcOk) {
    console.info(
      `[wallet-balance] ${label} fetch vybe=${vybeMs}ms rpc=${rpcMs}ms vybeRows=${balance.data.length} rpcMints=${rpcByMint.size}`,
    );
  } else {
    console.info(
      `[wallet-balance] ${label} fetch vybe=${vybeMs}ms rpc=${rpcMs}ms (rpc failed) vybeRows=${balance.data.length}`,
    );
  }

  const verifiedZero7dHighValueCount = countVybeVerifiedZero7dHighValueMarks(balance.data);
  if (verifiedZero7dHighValueCount > 0) {
    console.info(
      `[wallet-balance] ${verifiedZero7dHighValueCount} verified token(s) with priceUsd >= $${VYBE_SUSPICIOUS_PRICE_USD_MIN} and zero 7d trend — kept (unverified-only filter)`,
    );
  }

  const skipLogoEnrichCount = balance.data.filter((row) => isVybeSuspiciousHighValueMark(row)).length;
  if (skipLogoEnrichCount > 0) {
    console.info(
      `[wallet-balance] ${skipLogoEnrichCount} unverified token(s) with priceUsd >= $${VYBE_SUSPICIOUS_PRICE_USD_MIN} and zero 7d trend — skip logo enrich`,
    );
  }

  const items = balance.data
    .map((row) => {
      const skipLogoEnrich = isVybeSuspiciousHighValueMark(row);
      const vybeDecimals = Number(row.decimals);
      const mintAddress = row.mintAddress.trim();
      const amounts = resolveAmountFromRpc(
        mintAddress,
        vybeDecimals,
        row.amount,
        rpcByMint,
        rpcOk,
      );
      if (!amounts) return null;
      const rawSymbol = row.symbol?.trim() ?? '';
      const rawName = row.name?.trim() ?? '';
      const symbol =
        rawSymbol && !isMintLikeLabel(rawSymbol, mintAddress)
          ? rawSymbol
          : mintAddress.slice(0, 6);
      const name =
        rawName && !isMintLikeLabel(rawName, mintAddress) ? rawName : symbol;
      let valueUsd = Number(row.valueUsd);
      if (rpcOk) {
        const priceUsd = Number(row.priceUsd);
        if (Number.isFinite(priceUsd) && priceUsd > 0) {
          valueUsd = holdingValueUsd(priceUsd, amounts.amountUi);
        } else if (!Number.isFinite(valueUsd)) {
          valueUsd = 0;
        }
      } else if (!Number.isFinite(valueUsd)) {
        valueUsd = 0;
      }
      const enrichmentPending =
        !skipLogoEnrich &&
        (valueUsd <= 0 ||
          !row.logoUrl?.trim() ||
          isMintLikeLabel(symbol, mintAddress));
      const item: WalletBalanceListItem = {
        mintAddress,
        symbol,
        name,
        logoUrl: row.logoUrl?.trim() || null,
        decimals: amounts.decimals,
        amountUi: amounts.amountUi,
        amountExact: amounts.amountExact,
        valueUsd,
        verified: row.verified === true,
        enrichmentPending,
        skipLogoEnrich: skipLogoEnrich || undefined,
        ...vybeFieldsFromWalletBalanceRow(row),
      };
      return item;
    })
    .filter((row): row is WalletBalanceListItem => row !== null);

  const seen = new Set(items.map((i) => i.mintAddress));
  const rpcOnlyToEnrich: RpcOnlyEnrichTarget[] = [];
  const rpcOnlyCandidates: RpcOnlyEnrichTarget[] = [];

  const nativeRpc = rpcByMint.get(RPC_NATIVE_SOL_MINT);
  if (nativeRpc && nativeRpc.amountRaw > 0n && !seen.has(NATIVE_SOL_MINT)) {
    rpcOnlyCandidates.push({
      rpc: nativeRpc,
      displayMint: NATIVE_SOL_MINT,
      defaultSymbol: 'SOL',
      defaultName: 'Solana',
    });
  }

  for (const rpc of rpcByMint.values()) {
    if (seen.has(rpc.mintAddress) || rpc.mintAddress === RPC_NATIVE_SOL_MINT) continue;
    if (rpc.amountRaw <= 0n) continue;
    rpcOnlyCandidates.push({ rpc, displayMint: rpc.mintAddress });
  }

  rpcOnlyCandidates.sort((a, b) => rpcAmountUi(b.rpc) - rpcAmountUi(a.rpc));
  const rpcOnlyTop = rpcOnlyCandidates.slice(0, RPC_ONLY_ENRICH_LIMIT);
  const skippedRpcOnly = rpcOnlyCandidates.length - rpcOnlyTop.length;
  if (rpcOnlyTop.length > 0 || skippedRpcOnly > 0) {
    console.info(
      `[wallet-balance] ${label} rpc-only queue: ${rpcOnlyTop.length} top-by-amount (skipped ${skippedRpcOnly} not in Vybe, limit ${RPC_ONLY_ENRICH_LIMIT})`,
    );
  }

  for (const target of rpcOnlyTop) {
    rpcOnlyToEnrich.push(target);
    const stub = stubWalletItemFromRpc(target.rpc, {
      displayMint: target.displayMint,
      defaultSymbol: target.defaultSymbol,
      defaultName: target.defaultName,
    });
    if (stub && !seen.has(stub.mintAddress)) {
      items.push(stub);
      seen.add(stub.mintAddress);
    }
  }

  const resultItems = sortWalletBalanceItems(items).slice(0, limit);
  logMergeResult(label, mergeStart, balance.data.length, skipLogoEnrichCount, resultItems.length);

  return {
    items: resultItems,
    rpcOnlyToEnrich,
  };
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

async function enrichWalletBalanceList(
  http: AxiosInstance,
  items: WalletBalanceListItem[],
  enrichLimit: number,
  label: string,
): Promise<WalletBalanceListItem[]> {
  const sorted = sortWalletBalanceItems(items);
  if (enrichLimit <= 0) return sorted;

  const eligible = sorted.filter((item) => !item.skipLogoEnrich);
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
  if (item.enrichmentPending) return true;
  const hasUsd =
    (Number.isFinite(item.valueUsd) && item.valueUsd > 0) ||
    (item.valueSol != null && item.valueSol > 0);
  const hasLogo = Boolean(item.logoUrl?.trim());
  return !hasUsd || !hasLogo;
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
  const enrichLimit = resolveMetaEnrichLimit(options?.enrichLimit, enrich);
  const label = ownerAddress.trim().slice(0, 8);
  const { items, rpcOnlyToEnrich } = await mergeWalletBalancesFromRpcAndVybe(http, ownerAddress, limit);
  if (isCancelled?.()) return;
  emit({ event: 'initial', tokens: items });

  if (enrichLimit > 0 || rpcOnlyToEnrich.length > 0) {
    let working = items;
    if (enrichLimit > 0) {
      const metaEnrichMints = new Set(
        sortWalletBalanceItems(items)
          .filter((item) => !item.skipLogoEnrich)
          .slice(0, enrichLimit)
          .map((item) => item.mintAddress),
      );
      working = await enrichWalletBalanceList(http, items, enrichLimit, label);
      for (const item of working) {
        if (isCancelled?.()) return;
        if (metaEnrichMints.has(item.mintAddress)) {
          emit({ event: 'update', token: item });
        }
      }
    }
    if (rpcOnlyToEnrich.length > 0) {
      const rpcMints = new Set(rpcOnlyToEnrich.map((target) => target.displayMint));
      working = await enrichRpcOnlyTargets(http, working, rpcOnlyToEnrich, label);
      for (const item of working) {
        if (isCancelled?.()) return;
        if (rpcMints.has(item.mintAddress)) {
          emit({ event: 'update', token: item });
        }
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
  const enrichLimit = resolveMetaEnrichLimit(options?.enrichLimit, enrich);
  const label = ownerAddress.trim().slice(0, 8);
  const { items, rpcOnlyToEnrich } = await mergeWalletBalancesFromRpcAndVybe(http, ownerAddress, limit);
  let result = items.slice(0, limit);
  if (!enrich) return result;

  result = await enrichWalletBalanceList(http, result, enrichLimit, label);
  if (rpcOnlyToEnrich.length > 0) {
    result = await enrichRpcOnlyTargets(http, result, rpcOnlyToEnrich, label);
  }
  return sortWalletBalanceItems(result).slice(0, limit);
}

export async function getWalletSolBalanceUi(
  http: AxiosInstance,
  ownerAddress: string,
): Promise<number> {
  const [{ rpcByMint, rpcOk }, balance] = await Promise.all([
    fetchRpcWalletBalancesSafe(ownerAddress),
    getWalletTokenBalance(http, {
      ownerAddress,
      includeNoPriceBalance: true,
    }),
  ]);
  let totalRaw = 0n;
  if (rpcOk) {
    const native = rpcByMint.get(RPC_NATIVE_SOL_MINT);
    const wsol = rpcByMint.get(WSOL_MINT);
    if (native) totalRaw += native.amountRaw;
    if (wsol) totalRaw += wsol.amountRaw;
    return rawToUiAmount(totalRaw.toString(), 9);
  }
  const native = rpcByMint.get(RPC_NATIVE_SOL_MINT);
  const wsol = rpcByMint.get(WSOL_MINT);
  if (native) totalRaw += native.amountRaw;
  if (wsol) totalRaw += wsol.amountRaw;
  if (totalRaw <= 0n) {
    for (const row of balance.data) {
      const mint = row.mintAddress.trim();
      if (mint !== NATIVE_SOL_MINT && mint !== WSOL_MINT) continue;
      const decimals = Number(row.decimals);
      if (!Number.isFinite(decimals) || decimals < 0) continue;
      totalRaw += balanceAmountToRaw(row.amount, decimals);
    }
  }
  return rawToUiAmount(totalRaw.toString(), 9);
}
