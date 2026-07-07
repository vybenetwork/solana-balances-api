/** Token details from GET /v4/tokens/{mintAddress} */
export interface VybeToken {
  mintAddress: string;
  symbol?: string;
  name?: string;
  decimal?: number;
  decimals?: number;
  logoUrl?: string;
  price?: number;
  price1d?: number;
  price7d?: number;
  updateTime?: number;
  priceUsd?: string;
  marketCap?: number;
  marketCapUsd?: string;
  verified?: boolean;
  category?: string | null;
  subcategory?: string | null;
  currentSupply?: number;
  tokenAmountVolume24h?: number | null;
  usdValueVolume24h?: number | null;
  [key: string]: unknown;
}

export interface VybeTokenBalance {
  mintAddress: string;
  amount: string;
  decimals: number;
  symbol?: string | null;
  name?: string | null;
  logoUrl?: string | null;
  priceUsd?: string;
  priceUsd1dChange?: string | null;
  priceUsd7dTrend?: string[] | null;
  valueUsd?: string;
  verified?: boolean;
  [key: string]: unknown;
}

/** Response from GET /v4/wallets/{ownerAddress}/token-balance */
export interface VybeWalletTokenBalanceResponse {
  ownerAddress: string;
  date: number;
  data: VybeTokenBalance[];
  totalTokenCount: number;
  totalTokenValueUsd: string;
  [key: string]: unknown;
}
