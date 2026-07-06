/**
 * Vybe wallet PnL proxies: /v4/wallets/top-traders and /v4/wallets/{owner}/pnl
 */

import type { AxiosInstance } from 'axios';
import { withRetry } from './client.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VybeTopTradersResponse = { data?: any[]; [key: string]: unknown };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VybeWalletPnlResponse = { summary?: any; tokenMetrics?: any[]; [key: string]: unknown };

export interface GetTopTradersOptions {
  mintAddress?: string;
  ilikeFilter?: string;
  label?: string;
  resolution?: string;
  sortByAsc?: string;
  sortByDesc?: string;
  limit?: number;
  page?: number;
}

export interface GetWalletPnlOptions {
  resolution?: string;
  mintAddress?: string;
  sortByAsc?: string;
  sortByDesc?: string;
  limit?: number;
  page?: number;
}

export async function getTopTraders(
  http: AxiosInstance,
  options: GetTopTradersOptions = {},
): Promise<VybeTopTradersResponse> {
  const {
    mintAddress,
    ilikeFilter,
    label,
    resolution = '7d',
    sortByAsc,
    sortByDesc = 'realizedPnlUsd',
    limit = 1000,
    page,
  } = options;
  return withRetry(async () => {
    const params: Record<string, string | number> = { resolution, limit };
    if (sortByAsc) params.sortByAsc = sortByAsc;
    else params.sortByDesc = sortByDesc;
    if (mintAddress) params.mintAddress = mintAddress;
    if (ilikeFilter) params.ilikeFilter = ilikeFilter;
    if (label) params.label = label;
    if (page != null) params.page = page;
    const { data } = await http.get<VybeTopTradersResponse>('/v4/wallets/top-traders', { params });
    return data;
  });
}

export async function getWalletPnl(
  http: AxiosInstance,
  ownerAddress: string,
  options: GetWalletPnlOptions = {},
): Promise<VybeWalletPnlResponse> {
  const {
    resolution = '7d',
    mintAddress,
    sortByAsc,
    sortByDesc = 'realizedPnlUsd',
    limit = 1000,
    page = 0,
  } = options;
  return withRetry(async () => {
    const params: Record<string, string | number> = { resolution, limit, page };
    if (mintAddress) params.mintAddress = mintAddress;
    if (sortByAsc) params.sortByAsc = sortByAsc;
    else params.sortByDesc = sortByDesc;
    const { data } = await http.get<VybeWalletPnlResponse>(
      `/v4/wallets/${encodeURIComponent(ownerAddress)}/pnl`,
      { params },
    );
    return data;
  });
}
