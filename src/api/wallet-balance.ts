/**
 * Wallet token balances: Vybe + on-chain RPC merge, enriched via Jupiter → pump.fun → Vybe.
 */

import type { AxiosInstance } from 'axios';
import type { VybeToken, VybeWalletTokenBalanceResponse } from '../types/api.js';
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

/** Top holdings by USD value queued for logo backfill on the client. */
export const TOP_LOGO_REPAIR_N = 20;

export const RPC_ONLY_ENRICH_LIMIT = WALLET_TOKEN_BALANCE_LIMIT;

export interface GetWalletTokenBalanceParams {
  ownerAddress: string;
  mintAddresses?: string[];
  includeNoPriceBalance?: boolean;
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
    const { data } = await http.get<VybeWalletTokenBalanceResponse>(
      `/v4/wallets/${encodeURIComponent(ownerAddress)}/token-balance`,
      {
        params: {
          mintAddresses: params.mintAddresses,
          includeNoPriceBalance: params.includeNoPriceBalance ?? true,
          vybeTokenFilter: false,
        },
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
): Promise<WalletBalanceListItem> {
  const metaEnriched = needsEnrichment(item)
    ? await enrichWalletItemMeta(http, item)
    : attachPriceSource(item);
  return attachVybeTokenDetails(http, metaEnriched);
}

async function enrichWalletItemMeta(
  http: AxiosInstance,
  item: WalletBalanceListItem,
): Promise<WalletBalanceListItem> {
  const hasLogo = Boolean(item.logoUrl?.trim());
  const hasUsd =
    (Number.isFinite(item.valueUsd) && item.valueUsd > 0) ||
    (item.valueSol != null && item.valueSol > 0);
  if (hasLogo && hasUsd && !item.enrichmentPending) return attachPriceSource(item);

  const resolved = await resolveTokenMeta(http, item.mintAddress);
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
  const [balanceResult, { rpcByMint, rpcOk }] = await Promise.all([
    getWalletTokenBalance(http, {
      ownerAddress,
      includeNoPriceBalance: true,
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[wallet-balance] Vybe token list failed, using RPC-only: ${msg}`);
      return null;
    }),
    fetchRpcWalletBalancesSafe(ownerAddress),
  ]);

  if (rpcOk) {
    console.info(`[wallet-balance] RPC scan ok — ${rpcByMint.size} mint(s) with on-chain balance`);
  }

  const balance = balanceResult ?? { data: [] };

  const items = balance.data
    .map((row) => {
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
        valueUsd <= 0 ||
        !row.logoUrl?.trim() ||
        isMintLikeLabel(symbol, mintAddress);
      const priceSource =
        valueUsd > 0 && Number.isFinite(Number(row.priceUsd)) && Number(row.priceUsd) > 0
          ? 'Vybe'
          : undefined;
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
        priceSource,
      };
      return item;
    })
    .filter((row): row is WalletBalanceListItem => row !== null);

  const seen = new Set(items.map((i) => i.mintAddress));
  const rpcOnlyToEnrich: RpcOnlyEnrichTarget[] = [];

  const nativeRpc = rpcByMint.get(RPC_NATIVE_SOL_MINT);
  if (nativeRpc && nativeRpc.amountRaw > 0n && !seen.has(NATIVE_SOL_MINT)) {
    rpcOnlyToEnrich.push({
      rpc: nativeRpc,
      displayMint: NATIVE_SOL_MINT,
      defaultSymbol: 'SOL',
      defaultName: 'Solana',
    });
    const stub = stubWalletItemFromRpc(nativeRpc, {
      displayMint: NATIVE_SOL_MINT,
      defaultSymbol: 'SOL',
      defaultName: 'Solana',
    });
    if (stub) {
      items.push(stub);
      seen.add(NATIVE_SOL_MINT);
    }
  }

  const rpcOnlyCandidates: RpcMintBalance[] = [];
  for (const rpc of rpcByMint.values()) {
    if (seen.has(rpc.mintAddress) || rpc.mintAddress === RPC_NATIVE_SOL_MINT) continue;
    if (rpc.amountRaw <= 0n) continue;
    rpcOnlyCandidates.push(rpc);
  }
  rpcOnlyCandidates.sort((a, b) => rpcAmountUi(b) - rpcAmountUi(a));
  const rpcOnlyTop = rpcOnlyCandidates.slice(0, Math.min(limit, RPC_ONLY_ENRICH_LIMIT));

  for (const rpc of rpcOnlyTop) {
    rpcOnlyToEnrich.push({ rpc, displayMint: rpc.mintAddress });
    const stub = stubWalletItemFromRpc(rpc);
    if (stub && !seen.has(stub.mintAddress)) {
      items.push(stub);
      seen.add(stub.mintAddress);
    }
  }

  return {
    items: sortWalletBalanceItems(items).slice(0, limit),
    rpcOnlyToEnrich,
  };
}

function needsEnrichment(item: WalletBalanceListItem): boolean {
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
  options?: { enrich?: boolean },
): Promise<void> {
  const enrich = options?.enrich !== false;
  const { items } = await mergeWalletBalancesFromRpcAndVybe(http, ownerAddress, limit);
  if (isCancelled?.()) return;
  emit({ event: 'initial', tokens: items });

  if (enrich) {
    const enrichedItems: WalletBalanceListItem[] = [];
    for (const item of items) {
      if (isCancelled?.()) return;
      const enriched = await enrichWalletItemFull(http, item);
      enrichedItems.push(enriched);
      if (isCancelled?.()) return;
      emit({ event: 'update', token: enriched });
    }
  }

  if (!isCancelled?.()) emit({ event: 'done' });
}

export async function listWalletTokenBalances(
  http: AxiosInstance,
  ownerAddress: string,
  limit = WALLET_TOKEN_BALANCE_LIMIT,
  options?: { enrich?: boolean },
): Promise<WalletBalanceListItem[]> {
  const enrich = options?.enrich === true;
  const { items } = await mergeWalletBalancesFromRpcAndVybe(http, ownerAddress, limit);
  const sliced = items.slice(0, limit);
  if (!enrich) return sliced;

  const out: WalletBalanceListItem[] = [];
  for (const item of sliced) {
    out.push(await enrichWalletItemFull(http, item));
  }
  return sortWalletBalanceItems(out);
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
