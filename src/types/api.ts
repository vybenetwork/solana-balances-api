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
  valueUsd1dChange?: string | null;
  verified?: boolean;
  category?: string | null;
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

/** Holding row from GET /api/v1/owners/:owner/portfolio */
export interface OwnerPortfolioHolding {
  /** Raw on-chain amount (base units). Preserved as string for large integers. */
  amount: string;
  mint: string;
  label?: string;
}

export interface OwnerPortfolioSolSummary {
  native_sol: number;
  staked_sol: number;
  total_sol_lamports: number;
  wrapped_sol: number;
}

/** Response from GET /api/v1/owners/:owner/portfolio */
export interface OwnerPortfolioResponse {
  owner: string;
  holdings: OwnerPortfolioHolding[];
  sol_summary: OwnerPortfolioSolSummary;
  token_count: number;
  query_time_us: number;
  [key: string]: unknown;
}
