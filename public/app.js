'use strict';

const PRICE_CHANGE_PIE_HEX = ['#4ade80', '#60a5fa', '#f87171', '#fb923c'];
const PRICE_CHANGE_PIE_TITLES = ['Profitable', 'Breaking even', 'Losing value', 'Dead'];
const PRICE_CHANGE_PIE_KEYS = ['profitable', 'breaking_even', 'losing', 'dead'];
const NATIVE_SOL_MINT = '11111111111111111111111111111111';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const STABLECOIN_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB',
  '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
  'JEFFSQ3s8T3wKsvp4tnRAsUBW7Cqgnf8ukBZC4C8XBm1',
  'Dn4noZ5jgGfkntzcQSUZ8czkreiZ1ForXYoV2H8Dm7S1',
  '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT',
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',
  'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM',
  'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6',
  'DEkqHyPN7GMRJ5cArtQFAWefqbZb33Hyf6s5iCwjEonT',
]);
const STABLE_SYMBOLS = new Set(['USD', 'USDC', 'USDT', 'PYUSD', 'USD1', 'USDE', 'USDH', 'UXD', 'USDY']);
const TIER_LEGEND_SVG_VOLUME =
  '<svg class="token-tier-metric__svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 12h4v8H3v-8zm7-4h4v12h-4V8zm7 6h4v6h-4v-6z"/></svg>';
const SOLSCAN_TOKEN = 'https://solscan.io/token/';
const VYBE_PRICE_SOURCE_ICON =
  '<img class="holders-price-source__icon holders-price-source__icon--vybe" src="/favicon.svg" alt="" width="14" height="14" decoding="async"/>';
const JUPITER_PRICE_SOURCE_ICON =
  '<img class="holders-price-source__icon holders-price-source__icon--jupiter" src="/images/jupiter-logo.png" alt="" width="14" height="14" decoding="async"/>';
const PUMPFUN_PRICE_SOURCE_ICON =
  '<img class="holders-price-source__icon holders-price-source__icon--pump" src="/images/pump-logo.png" alt="" width="14" height="14" decoding="async"/>';
const HOLDERS_EXTERNAL_LINK_SVG =
  '<svg class="holders-mint-link__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>';

const walletInput = document.getElementById('wallet');
const limitSelect = document.getElementById('limit');
const topLogoRepairEnabledInput = document.getElementById('topLogoRepairEnabled');
const topLogoRepairNInput = document.getElementById('topLogoRepairN');
const fetchAllBtn = document.getElementById('fetchAll');
const loadingIndicator = document.getElementById('loadingIndicator');
const walletSummaryLabel = document.getElementById('walletSummaryLabel');
const walletLastUpdatedValue = document.getElementById('walletLastUpdatedValue');
const walletSummaryStats = document.getElementById('walletSummaryStats');
const walletStatsSection = document.getElementById('walletStatsSection');
const walletStatsSectionTitle = document.getElementById('walletStatsSectionTitle');
const holdingsStatsContent = document.getElementById('holdingsStatsContent');
const holdingsStatsMeta = document.getElementById('holdingsStatsMeta');
const pnlStatsContent = document.getElementById('pnlStatsContent');
const walletStatsViewSwitch = document.getElementById('walletStatsViewSwitch');
const portfolioPie = document.getElementById('portfolioPie');
const portfolioLegend = document.getElementById('portfolioLegend');
const portfolioPieTitle = document.getElementById('portfolioPieTitle');
const portfolioPieLede = document.getElementById('portfolioPieLede');
const portfolioPieInsight = document.getElementById('portfolioPieInsight');
const holdingsUsdBars = document.getElementById('holdingsUsdBars');
const holdersLoading = document.getElementById('holdersLoading');
const walletSummaryLoading = document.getElementById('walletSummaryLoading');
const holdingsStatsLoading = document.getElementById('holdingsStatsLoading');
const holdersError = document.getElementById('holdersError');
const holdersMeta = document.getElementById('holdersMeta');
const holdersSummaryCount = document.getElementById('holdersSummaryCount');
const holdersSummaryProfitable = document.getElementById('holdersSummaryProfitable');
const holdersSummaryBreakingEven = document.getElementById('holdersSummaryBreakingEven');
const holdersSummaryLosing = document.getElementById('holdersSummaryLosing');
const holdersSummaryDead = document.getElementById('holdersSummaryDead');
const holdersSummaryVerified = document.getElementById('holdersSummaryVerified');
const holdersSummaryCategorised = document.getElementById('holdersSummaryCategorised');
const holdersSummaryCategorisedTip = document.getElementById('holdersSummaryCategorisedTip');
const holdersBody = document.getElementById('holdersBody');
const holdersSectionTitle = document.getElementById('holdersSectionTitle');
const holdersTableViewSwitch = document.getElementById('holdersTableViewSwitch');
const holdersTableViewSwitchLabel = document.getElementById('holdersTableViewSwitchLabel');
const walletStatsViewSwitchLabel = document.getElementById('walletStatsViewSwitchLabel');
const holdersTableWrap = document.getElementById('holdersTableWrap');
const walletPnlTableWrap = document.getElementById('walletPnlTableWrap');
const holdersSummaryGrid = document.getElementById('holdersSummary');
const errorSection = document.getElementById('errorSection');
const errorText = document.getElementById('errorText');

let lastTokens = [];
const TOKEN_LOGO_PLACEHOLDER = '/token-placeholder.png';
const LOGO_SETTINGS_DEFAULTS = {
  topLogoRepairN: { min: 1, max: 20, fallback: 10 },
};
/** Client img load timeout — longer for same-origin proxy (IPFS gateway fetches). */
const LOGO_IMG_TIMEOUT_MS = 30_000;
/** Match server: force-off Stream Logo Enrich for huge / mostly-dead wallets. */
const ENRICH_FORCE_DISABLE_TOKEN_COUNT = 100;
const ENRICH_FORCE_DISABLE_DEAD_COUNT = 50;
let streamEnrichForceDisabled = false;
let streamEnrichUserPreferred = true;
const logoLoadingMints = new Set();
const logoRepairInFlight = new Set();
const logoFailedMints = new Set();
const logoRepairAttemptedMints = new Set();
const logoPendingRepairMints = new Set();
const logoImageLoadedMints = new Set();
const logoImgTimeouts = new Map();
const VYBE_LOGO_LOAD_STAGGER_MS = 20;
/** Matches server skipLogoEnrich filter — hide bogus USD above this in the GUI. */
const SUSPICIOUS_MASK_VALUE_USD_MIN = 100;
const vybeOriginLogoMints = new Set();
const vybeLogoLoadQueue = [];
const vybeLogoLoadQueuedMints = new Set();
const logoSrcAssignedMints = new Set();
let vybeLogoLoadQueueScheduled = false;
let tokenLogoObserver = null;

function tokenHasMissingOrZeroPrice(token) {
  const raw = token?.priceUsd;
  if (raw == null || raw === '') return true;
  const n = Number(raw);
  return !Number.isFinite(n) || n <= 0;
}

/** Unverified dust: exactly 1 token or 1.xxxxx (1 ≤ amount < 2). */
function tokenHasSuspiciousUnitAmount(token) {
  const n = toNum(token?.amountUi);
  return Number.isFinite(n) && n >= 1 && n < 2;
}

function shouldMaskSuspiciousValueUsd(_token) {
  // TEMP (debug branch): disable suspicious price/value masking entirely.
  return false;
}

function effectiveValueUsd(token) {
  if (shouldMaskSuspiciousValueUsd(token)) return 0;
  const v = toNum(token.valueUsd);
  return v > 0 ? v : 0;
}

function applySuspiciousValueUsdMask(tokens) {
  // TEMP (debug branch): no-op — keep assets API prices/values as returned.
  void tokens;
}

function getTokenLogoScrollRoot() {
  return document.getElementById('holdersTableWrap');
}

function disconnectTokenLogoObserver() {
  tokenLogoObserver?.disconnect();
  tokenLogoObserver = null;
}

function activateTokenLogoImg(img) {
  const mint = img.dataset.logoMint;
  const url = img.dataset.logoUrl?.trim();
  if (!mint || !url) return;
  if (logoImageLoadedMints.has(mint) || logoFailedMints.has(mint)) return;
  if (logoSrcAssignedMints.has(mint)) return;

  if (img.dataset.vybeLogo === '1') {
    enqueueVybeLogoImageLoad(mint, url);
    return;
  }
  img.src = url;
  logoSrcAssignedMints.add(mint);
  armLogoLoadTimeout(mint);
}

function observeTokenLogosInTable() {
  disconnectTokenLogoObserver();
  const root = getTokenLogoScrollRoot();
  if (!root || !holdersBody || typeof IntersectionObserver !== 'function') return;

  tokenLogoObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const img = entry.target;
        if (!(img instanceof HTMLImageElement)) continue;
        tokenLogoObserver?.unobserve(img);
        activateTokenLogoImg(img);
      }
    },
    { root, rootMargin: '120px 0px', threshold: 0.01 },
  );

  for (const img of holdersBody.querySelectorAll('img.token-logo[data-logo-url]')) {
    const mint = img.dataset.logoMint;
    if (!mint) continue;
    if (logoImageLoadedMints.has(mint) || logoFailedMints.has(mint)) continue;
    if (logoSrcAssignedMints.has(mint)) continue;
    tokenLogoObserver.observe(img);
  }
}

function clampLogoSetting(value, bounds) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return bounds.fallback;
  return Math.min(bounds.max, Math.max(bounds.min, n));
}

function getTopLogoRepairN() {
  if (!topLogoRepairEnabledInput?.checked) return 0;
  return clampLogoSetting(topLogoRepairNInput?.value, LOGO_SETTINGS_DEFAULTS.topLogoRepairN);
}

function getLogoImgTimeoutMs() {
  return LOGO_IMG_TIMEOUT_MS;
}

function syncTopLogoRepairFieldState() {
  if (!topLogoRepairNInput || !topLogoRepairEnabledInput) return;
  topLogoRepairEnabledInput.disabled = streamEnrichForceDisabled;
  topLogoRepairNInput.disabled = streamEnrichForceDisabled || !topLogoRepairEnabledInput.checked;
  const label = document.getElementById('topLogoRepairSwitchLabel');
  if (label) {
    label.title = streamEnrichForceDisabled
      ? `Forced off: wallet has >${ENRICH_FORCE_DISABLE_TOKEN_COUNT} tokens or >${ENRICH_FORCE_DISABLE_DEAD_COUNT} dead tokens`
      : 'During the balance stream, enrich top N filter-eligible holdings missing USD/logo (skips dead & suspicious)';
    label.classList.toggle('is-force-disabled', streamEnrichForceDisabled);
  }
}

function countDeadHoldingsClient(tokens) {
  return (Array.isArray(tokens) ? tokens : []).reduce((n, t) => {
    const has1d = hasValidPriceChangePct(t?.priceChange1dPct);
    const has7d = hasValidPriceChangePct(t?.priceChange7dPct);
    return n + (!has1d && !has7d ? 1 : 0);
  }, 0);
}

function shouldForceDisableStreamEnrichClient(tokens) {
  const list = Array.isArray(tokens) ? tokens : [];
  if (list.length > ENRICH_FORCE_DISABLE_TOKEN_COUNT) return true;
  return countDeadHoldingsClient(list) > ENRICH_FORCE_DISABLE_DEAD_COUNT;
}

/** Force Stream Logo Enrich off for oversized / mostly-dead wallets (mirrors server). */
function applyStreamEnrichForceDisable(tokens) {
  const force = shouldForceDisableStreamEnrichClient(tokens);
  if (force && !streamEnrichForceDisabled) {
    streamEnrichUserPreferred = topLogoRepairEnabledInput?.checked !== false;
  }
  if (force) {
    if (topLogoRepairEnabledInput) topLogoRepairEnabledInput.checked = false;
  } else if (streamEnrichForceDisabled && topLogoRepairEnabledInput) {
    topLogoRepairEnabledInput.checked = streamEnrichUserPreferred;
  }
  streamEnrichForceDisabled = force;
  syncTopLogoRepairFieldState();
}

function clampLogoSettingInput(input, bounds) {
  if (!input) return;
  input.value = String(clampLogoSetting(input.value, bounds));
}

function initLogoRepairSettings() {
  syncTopLogoRepairFieldState();
  topLogoRepairEnabledInput?.addEventListener('change', syncTopLogoRepairFieldState);
  topLogoRepairNInput?.addEventListener('change', () =>
    clampLogoSettingInput(topLogoRepairNInput, LOGO_SETTINGS_DEFAULTS.topLogoRepairN),
  );
}

function escapeHtmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(s) {
  return escapeHtmlText(s).replace(/'/g, '&#39;');
}

function truncateAddress(addr) {
  const a = (addr || '').trim();
  if (a.length <= 13) return a;
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function mintColumnLabel(addr) {
  const a = String(addr || '').trim();
  if (!a) return '';
  return a.slice(0, 5);
}

function toNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/** 0 decimals unless |value| < 1 (then 2). Tiny non-zero values clamp to ±0.01. */
function formatRoundedValue(num) {
  const n = Number(num);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return '0';
  if (n > 0 && n < 0.01) return '0.01';
  if (n < 0 && n > -0.01) return '-0.01';
  const abs = Math.abs(n);
  if (abs < 1) return n.toFixed(2);
  return String(Math.round(n));
}

function formatPctSmart(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return '0%';
  return `${formatRoundedValue(num)}%`;
}

function formatUsd(n) {
  const num = toNum(n);
  if (num === 0) return '$0';
  const formatted = formatRoundedValue(num);
  if (Math.abs(num) >= 1) {
    return `$${Number(formatted).toLocaleString()}`;
  }
  return `$${formatted}`;
}

/**
 * USD compact: k / M / B / T above `compactAbove` (default 999.99).
 * No decimals only when the scaled unit is > 99.99 (e.g. $100k, $150M);
 * otherwise keep up to 2 decimals ($58.58k, $1.25M).
 */
function formatUsdCompact(n, { compactAbove = 999.99 } = {}) {
  const num = toNum(n);
  if (!Number.isFinite(num)) return '—';
  if (num === 0) return '$0';
  const abs = Math.abs(num);
  const sign = num < 0 ? '−' : '';
  if (abs <= compactAbove) return formatUsd(num);

  let scaled;
  let suffix;
  if (abs >= 1e12) {
    scaled = abs / 1e12;
    suffix = 'T';
  } else if (abs >= 1e9) {
    scaled = abs / 1e9;
    suffix = 'B';
  } else if (abs >= 1e6) {
    scaled = abs / 1e6;
    suffix = 'M';
  } else {
    scaled = abs / 1e3;
    suffix = 'k';
  }

  if (scaled > 99.99) {
    return `${sign}$${Math.round(scaled).toLocaleString(undefined, { maximumFractionDigits: 0 })}${suffix}`;
  }
  const body = scaled.toFixed(2).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  return `${sign}$${body}${suffix}`;
}

/** Holdings table Value (USD) — compact k/M/B after $9999. */
function formatHoldingUsdValue(n) {
  const num = toNum(n);
  if (!Number.isFinite(num) || num <= 0) return '—';
  return formatUsdCompact(num, { compactAbove: 9999 });
}

/** Holdings Amount compact unit: always 2 decimals through 99.99K/M/B; whole above that. */
function formatAmountCompactScaled(scaled) {
  if (!(scaled > 0)) return '0';
  if (scaled > 99.99) {
    return Math.round(scaled).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return scaled.toFixed(2);
}

function formatAmount(n, symbol) {
  const num = toNum(n);
  const sym = symbol?.trim() ? ` ${symbol.trim()}` : '';
  if (num >= 1e9) return `${formatAmountCompactScaled(num / 1e9)}B${sym}`;
  if (num >= 1e6) return `${formatAmountCompactScaled(num / 1e6)}M${sym}`;
  if (num >= 1e3) return `${formatAmountCompactScaled(num / 1e3)}K${sym}`;
  if (num >= 1) return `${formatRoundedValue(num)}${sym}`;
  if (num > 0) return `${formatRoundedValue(num)}${sym}`;
  return `0${sym}`;
}

function displayTokenSymbol(symbol) {
  const sym = (symbol || '').trim();
  if (!sym) return '—';
  const base = sym.toUpperCase() === 'WSOL' ? 'SOL' : sym;
  return base.length > 8 ? base.slice(0, 8) : base;
}

function isStableToken(mint, symbol) {
  const m = (mint || '').trim();
  if (m && STABLECOIN_MINTS.has(m)) return true;
  const sym = displayTokenSymbol(symbol).toUpperCase();
  return STABLE_SYMBOLS.has(sym);
}

function isSolToken(mint, symbol) {
  const m = (mint || '').trim();
  if (m === NATIVE_SOL_MINT || m === WSOL_MINT) return true;
  return displayTokenSymbol(symbol) === 'SOL';
}

function wrapHoldingAmountHtml(amountText, mint, symbol) {
  const raw = (amountText || '').trim();
  if (!raw || raw === '—') return '—';
  const sym = displayTokenSymbol(symbol);
  const label = sym && sym !== '—' ? `${raw} ${sym}` : raw;
  if (isStableToken(mint, symbol)) {
    return `<span class="holders-amount-cell amount-usdc">${escapeHtmlText(label)}</span>`;
  }
  if (isSolToken(mint, symbol)) {
    return `<span class="holders-amount-cell amount-sol">${escapeHtmlText(label)}</span>`;
  }
  if (!sym || sym === '—') {
    return `<span class="holders-amount-cell amount-other-value">${escapeHtmlText(raw)}</span>`;
  }
  return `<span class="holders-amount-cell"><span class="amount-other-value">${escapeHtmlText(raw)}</span> <span class="amount-other-symbol">${escapeHtmlText(sym)}</span></span>`;
}

function formatHoldingAmountCellHtml(t) {
  return wrapHoldingAmountHtml(formatAmount(t.amountUi, ''), t.mintAddress, t.symbol);
}

function formatCompactNum(n) {
  const num = toNum(n);
  if (!Number.isFinite(num) || num === 0) return '0';
  if (num >= 1e12) return `${formatRoundedValue(num / 1e12)}T`;
  if (num >= 1e9) return `${formatRoundedValue(num / 1e9)}B`;
  if (num >= 1e6) return `${formatRoundedValue(num / 1e6)}M`;
  if (num >= 1e3) return `${formatRoundedValue(num / 1e3)}K`;
  if (num >= 1) return formatRoundedValue(num);
  return formatRoundedValue(num);
}

/** Significant digits after the first non-zero decimal for micro prices (matches DeFi table). */
const HOLDINGS_MICRO_SIGNIFICANT_DIGITS = 3;

/**
 * Format abs < 1 from the first non-zero decimal digit.
 * e.g. 0.001318 → "0.00132", 0.0031 → "0.0031"
 */
function formatFromFirstNonZero(abs, significantDigits = HOLDINGS_MICRO_SIGNIFICANT_DIGITS) {
  if (!Number.isFinite(abs) || abs <= 0) return null;
  const frac = abs.toFixed(20).split('.')[1] || '';
  let firstNonZeroIdx = 0;
  while (firstNonZeroIdx < frac.length && frac[firstNonZeroIdx] === '0') firstNonZeroIdx += 1;
  if (firstNonZeroIdx >= frac.length) return '0';
  const decimals = Math.min(firstNonZeroIdx + significantDigits, 20);
  return abs.toFixed(decimals).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
}

/** Compact micro notation: 0.000006297 → { zeroRun: 5, mantissa: "630" } when 3+ leading zeros. */
function parseLeadingZeroCompact(abs) {
  if (!Number.isFinite(abs) || abs <= 0 || abs >= 0.001) return null;
  const s = abs.toFixed(24).replace(/\.?0+$/, '');
  const m = s.match(/^0\.(\d+)$/);
  if (!m) return null;
  const frac = m[1] ?? '';
  let zeroRun = 0;
  while (zeroRun < frac.length && frac[zeroRun] === '0') zeroRun += 1;
  if (zeroRun < 3 || zeroRun >= frac.length) return null;
  const mantissa = frac.slice(zeroRun, zeroRun + HOLDINGS_MICRO_SIGNIFICANT_DIGITS);
  if (!mantissa) return null;
  return { zeroRun, mantissa };
}

/** HTML: 0.0<sup>5</sup>630 — same notation as DeFi price column. */
function formatLeadingZeroCompactHtml(abs) {
  const parsed = parseLeadingZeroCompact(abs);
  if (!parsed) return null;
  const { zeroRun, mantissa } = parsed;
  return `0.0<sup class="holders-price-zero-run">${zeroRun}</sup>${escapeHtmlText(mantissa)}`;
}

/** Holdings Price (USD) cell HTML — DeFi-style micro notation for many leading zeros. */
function formatHoldingsPriceUsdHtml(n) {
  const num = toNum(n);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num > 99.99) {
    return `$${escapeHtmlText(Math.round(num).toLocaleString(undefined, { maximumFractionDigits: 0 }))}`;
  }
  if (num > 9.999) {
    return `$${escapeHtmlText(
      num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    )}`;
  }
  if (num >= 0.01) {
    const rounded = Math.round(num * 100) / 100;
    return `$${escapeHtmlText(
      rounded.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
      }),
    )}`;
  }
  const compactHtml = formatLeadingZeroCompactHtml(num);
  if (compactHtml) return `$${compactHtml}`;
  const fromFirst = formatFromFirstNonZero(num);
  return fromFirst ? `$${escapeHtmlText(fromFirst)}` : null;
}

function formatPctChangeWithArrow(pct) {
  const num = Number(pct);
  if (!Number.isFinite(num)) return '—';
  const arrow = num >= 0 ? '↑' : '↓';
  const abs = Math.abs(num);
  if (abs === 0) return `${arrow}0%`;
  return `${arrow}${formatRoundedValue(abs)}%`;
}

function portfolioPieInlineStyle(pct) {
  const num = Number(pct);
  if (!Number.isFinite(num) || num <= 0) return 'background:#3f3f46';
  const clamped = Math.min(num, 100);
  const sliceDeg = Math.max((clamped / 100) * 360, 6);
  return `background:conic-gradient(#22c55e 0deg ${sliceDeg}deg,#3f3f46 ${sliceDeg}deg 360deg)`;
}

function formatPortfolioPctColumnHtml(pct, hasValue) {
  if (!hasValue) return '—';
  const pieStyle = portfolioPieInlineStyle(pct);
  return `<div class="holders-portfolio-pct"><span class="holders-portfolio-pie" style="${pieStyle}" aria-hidden="true"></span><span class="holders-portfolio-pct-value">${escapeHtmlText(formatPctSmart(pct))}</span></div>`;
}

function hasValidPriceChangePct(pct) {
  return pct != null && Number.isFinite(Number(pct));
}

function formatPriceChangeChipHtml(label, pct) {
  if (!hasValidPriceChangePct(pct)) return '';
  const num = Number(pct);
  const cls = changeChipTierClass(num);
  return `<span class="swap-pair-chg ${cls}">${escapeHtmlText(label)} ${formatPctChangeWithArrow(num)}</span>`;
}

function changeChipTierClass(pct) {
  const num = Number(pct);
  if (num > 1) return 'swap-pair-chg--up';
  if (num < -0.5) return 'swap-pair-chg--down';
  return 'swap-pair-chg--breaking-even';
}

function formatMissingChangeChipHtml(label, inheritPct = null) {
  const placeholder = label === '7d:' ? '----' : '---';
  if (label === '7d:' && hasValidPriceChangePct(inheritPct)) {
    const cls = `${changeChipTierClass(Number(inheritPct))} swap-pair-chg--faded`;
    return `<span class="swap-pair-chg ${cls}">${escapeHtmlText(label)} ${placeholder}</span>`;
  }
  const cls = label === '7d:' ? 'swap-pair-chg--missing-7d' : 'swap-pair-chg--missing';
  return `<span class="swap-pair-chg ${cls}">${escapeHtmlText(label)} ${placeholder}</span>`;
}

function formatZeroChangeChipHtml(label, inheritPct = null) {
  if (hasValidPriceChangePct(inheritPct)) {
    const cls = `${changeChipTierClass(Number(inheritPct))} swap-pair-chg--faded`;
    return `<span class="swap-pair-chg ${cls}">${escapeHtmlText(label)} 0%</span>`;
  }
  return `<span class="swap-pair-chg swap-pair-chg--dead">${escapeHtmlText(label)} 0%</span>`;
}

function compareHoldersTableRows(a, b) {
  return toNum(effectiveValueUsd(b)) - toNum(effectiveValueUsd(a));
}

function formatChangeColumnHtml(t) {
  const has1d = hasValidPriceChangePct(t.priceChange1dPct);
  const has7d = hasValidPriceChangePct(t.priceChange7dPct);

  if (!has1d && !has7d) {
    return `<div class="holders-price-changes">${formatMissingChangeChipHtml('1d:')}${formatMissingChangeChipHtml('7d:')}</div>`;
  }

  const chips = [
    has1d ? formatPriceChangeChipHtml('1d:', t.priceChange1dPct) : formatMissingChangeChipHtml('1d:', has7d ? t.priceChange7dPct : null),
    has7d ? formatPriceChangeChipHtml('7d:', t.priceChange7dPct) : formatMissingChangeChipHtml('7d:', has1d ? t.priceChange1dPct : null),
  ];

  return `<div class="holders-price-changes">${chips.join('')}</div>`;
}

function formatPriceColumnHtml(t) {
  const html = formatHoldingsPriceUsdHtml(t.priceUsd);
  if (!html) return '—';
  return `<span class="holders-table-price">${html}</span>`;
}

const USD_MAGNITUDE_BAR_COLORS = {
  red: '#ef4444',
  orange: '#fb923c',
  yellow: '#facc15',
  lightGreen: '#86efac',
  green: '#22c55e',
};

const USD_MAGNITUDE_BAR_LABELS = ['$0–$10k', '$10k–$100k', '$100k–$500k', '$500k–$1M', '$1M+'];

function usdMagnitudeBarCount(usd) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n < 10_000) return 1;
  if (n < 100_000) return 2;
  if (n < 500_000) return 3;
  if (n < 1_000_000) return 4;
  return 5;
}

function usdMagnitudeBarTierMeta(bars) {
  if (bars <= 1) {
    return { tierClass: 'holders-usd-tier--red', color: USD_MAGNITUDE_BAR_COLORS.red, label: USD_MAGNITUDE_BAR_LABELS[0] };
  }
  if (bars === 2) {
    return { tierClass: 'holders-usd-tier--orange', color: USD_MAGNITUDE_BAR_COLORS.orange, label: USD_MAGNITUDE_BAR_LABELS[1] };
  }
  if (bars === 3) {
    return { tierClass: 'holders-usd-tier--yellow', color: USD_MAGNITUDE_BAR_COLORS.yellow, label: USD_MAGNITUDE_BAR_LABELS[2] };
  }
  if (bars === 4) {
    return { tierClass: 'holders-usd-tier--light-green', color: USD_MAGNITUDE_BAR_COLORS.lightGreen, label: USD_MAGNITUDE_BAR_LABELS[3] };
  }
  return { tierClass: 'holders-usd-tier--green', color: USD_MAGNITUDE_BAR_COLORS.green, label: USD_MAGNITUDE_BAR_LABELS[4] };
}

function renderUsdMagnitudeBars(bars, labelPrefix) {
  if (bars < 1 || bars > 5) return '';
  const { color, label } = usdMagnitudeBarTierMeta(bars);
  const tierLabel = `${labelPrefix} ${label}`;
  const barHtml = Array.from({ length: 5 }, (_, i) => {
    const active = i < bars;
    const style = active ? ` style="background:${color}"` : '';
    return `<span class="trade-volume-bar${active ? ' trade-volume-bar--active' : ''}"${style}></span>`;
  }).join('');
  return `<span class="trade-volume-bars" aria-label="${escapeHtmlAttr(tierLabel)}" title="${escapeHtmlAttr(tierLabel)}">${barHtml}</span>`;
}

function wrapHoldersCellWithBars(mainHtml, barsHtml) {
  if (!mainHtml || mainHtml === '—') return mainHtml || '—';
  if (!barsHtml) return mainHtml;
  return `<span class="trades-cell-with-volume"><span class="trades-cell-with-volume__bars">${barsHtml}</span><span class="trades-cell-with-volume__main">${mainHtml}</span></span>`;
}

function formatUsdMagnitudeCellHtml(rawValue, formattedText, labelPrefix) {
  const bars = usdMagnitudeBarCount(rawValue);
  if (formattedText === '—' || bars === 0) return '—';
  const { tierClass } = usdMagnitudeBarTierMeta(bars);
  const main = `<span class="holders-usd-tier ${tierClass}">${escapeHtmlText(formattedText)}</span>`;
  const barsHtml = renderUsdMagnitudeBars(bars, labelPrefix);
  return wrapHoldersCellWithBars(main, barsHtml);
}

/** Holdings Value (USD) bars — same thresholds/colors as DeFi positions Value column. */
function holdingsValueBarCount(usd) {
  const n = Number(usd);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 1;
  if (n < 0.01) return 1;
  if (n < 0.1) return 1;
  if (n < 1) return 1;
  if (n < 10) return 2;
  if (n < 100) return 3;
  if (n < 1000) return 4;
  return 5;
}

function holdingsValueBarTierMeta(usd) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n < 0) {
    return {
      tierClass: 'holders-usd-tier--red',
      color: USD_MAGNITUDE_BAR_COLORS.red,
      label: 'negative',
    };
  }
  if (n < 0.01) {
    return {
      tierClass: 'holders-usd-tier--orange',
      color: USD_MAGNITUDE_BAR_COLORS.orange,
      label: '$0–$0.01',
    };
  }
  if (n < 0.1) {
    return {
      tierClass: 'holders-usd-tier--yellow',
      color: USD_MAGNITUDE_BAR_COLORS.yellow,
      label: '$0.01–$0.10',
    };
  }
  if (n < 1) {
    return {
      tierClass: 'holders-usd-tier--light-green',
      color: USD_MAGNITUDE_BAR_COLORS.lightGreen,
      label: '$0.10–$1',
    };
  }
  if (n < 10) {
    return {
      tierClass: 'holders-usd-tier--green',
      color: USD_MAGNITUDE_BAR_COLORS.green,
      label: '$1–$10',
    };
  }
  if (n < 100) {
    return {
      tierClass: 'holders-usd-tier--green',
      color: USD_MAGNITUDE_BAR_COLORS.green,
      label: '$10–$100',
    };
  }
  if (n < 1000) {
    return {
      tierClass: 'holders-usd-tier--green',
      color: USD_MAGNITUDE_BAR_COLORS.green,
      label: '$100–$1,000',
    };
  }
  return {
    tierClass: 'holders-usd-tier--green',
    color: USD_MAGNITUDE_BAR_COLORS.green,
    label: '$1,000+',
  };
}

function renderHoldingsValueBars(usd) {
  const bars = holdingsValueBarCount(usd);
  if (bars < 1 || bars > 5) return '';
  const { color, label } = holdingsValueBarTierMeta(usd);
  const tierLabel = `Value ${label}`;
  const barHtml = Array.from({ length: 5 }, (_, i) => {
    const active = i < bars;
    const style = active ? ` style="background:${color}"` : '';
    return `<span class="trade-volume-bar${active ? ' trade-volume-bar--active' : ''}"${style}></span>`;
  }).join('');
  return `<span class="trade-volume-bars" aria-label="${escapeHtmlAttr(tierLabel)}" title="${escapeHtmlAttr(tierLabel)}">${barHtml}</span>`;
}

function holdingsUsdBandSampleUsd(bandIndex) {
  const samples = [0.005, 0.05, 0.5, 5, 50, 500, 5000, 15000];
  return samples[bandIndex] ?? 15000;
}

function formatMarketCapSupplyColumnHtml(t) {
  if (t.marketCap == null) return '—';
  const formatted = formatUsdCompact(t.marketCap);
  return formatUsdMagnitudeCellHtml(t.marketCap, formatted, 'Market cap');
}

function formatUsdVolColumnHtml(t) {
  if (t.usdValueVolume24h == null) return '—';
  const formatted = formatUsdCompact(t.usdValueVolume24h);
  return formatUsdMagnitudeCellHtml(t.usdValueVolume24h, formatted, 'USD volume');
}

function formatCategoryTooltip(category, subcategory) {
  const cat = (category || '').trim();
  const sub = (subcategory || '').trim();
  if (!cat && !sub) return '';
  if (cat && sub) return `${cat} (${sub})`;
  return cat || sub;
}

function tokenBadgeHtml(className, tipText, svgMarkup) {
  const tip = escapeHtmlText(tipText);
  return `<span class="token-badge ${className} token-badge--has-tip" tabindex="0" aria-label="${escapeHtmlAttr(tipText)}"><svg class="token-badge__svg" viewBox="0 0 16 16" aria-hidden="true">${svgMarkup}</svg><span class="token-badge-tip" role="tooltip">${tip}</span></span>`;
}

const HOLDERS_BADGE_SVGS = {
  verified:
    '<rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="#16a34a" stroke="#4ade80" stroke-width="1"/><path d="M4.5 8.2 6.8 10.5 11.5 5.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  info:
    '<rect x="2" y="2" width="12" height="12" rx="2" fill="#2563eb"/><path d="M8 7.2V11" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="5.1" r="0.85" fill="#fff"/>',
  dead:
    '<path d="M8 2.2 14.2 13.8H1.8L8 2.2Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 6.1V9.4" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/><circle cx="8" cy="11.4" r="0.75" fill="currentColor"/>',
};

function tokenSymbolBadgesHtml(t) {
  const parts = [];
  if (t.verified) {
    parts.push(tokenBadgeHtml('token-badge--verified', 'Verified', HOLDERS_BADGE_SVGS.verified));
  }
  const catTip = formatCategoryTooltip(t.category, t.subcategory);
  if (catTip) {
    parts.push(tokenBadgeHtml('token-badge--info', catTip, HOLDERS_BADGE_SVGS.info));
  }
  if (parts.length === 0) return '';
  return `<span class="token-symbol-badges">${parts.join('')}</span>`;
}

function aggregateWalletTaxonomy(tokens) {
  const categories = new Map();
  const subcategories = new Map();
  let labeledCount = 0;
  for (const t of tokens) {
    const cat = (t.category || '').trim();
    const sub = (t.subcategory || '').trim();
    const v = effectiveValueUsd(t);
    if (cat) {
      labeledCount += 1;
      const cur = categories.get(cat) ?? { count: 0, usd: 0 };
      cur.count += 1;
      cur.usd += v;
      categories.set(cat, cur);
    }
    if (sub) {
      const cur = subcategories.get(sub) ?? { count: 0, usd: 0 };
      cur.count += 1;
      cur.usd += v;
      subcategories.set(sub, cur);
    }
  }
  const topEntry = (map) => {
    const sorted = [...map.entries()].sort((a, b) => b[1].usd - a[1].usd || b[1].count - a[1].count);
    return sorted[0];
  };
  const topCat = topEntry(categories);
  const topSub = topEntry(subcategories);
  return {
    uniqueCategories: categories.size,
    uniqueSubcategories: subcategories.size,
    labeledCount,
    topCategory: topCat ? { name: topCat[0], count: topCat[1].count, usd: topCat[1].usd } : null,
    topSubcategory: topSub ? { name: topSub[0], count: topSub[1].count, usd: topSub[1].usd } : null,
    topCategoryLine: topCat
      ? `${topCat[0]} · ${topCat[1].count} ${formatTokenCountWord(topCat[1].count)} · ${formatUsd(topCat[1].usd)}`
      : '—',
    topSubcategoryLine: topSub
      ? `${topSub[0]} · ${topSub[1].count} ${formatTokenCountWord(topSub[1].count)} · ${formatUsd(topSub[1].usd)}`
      : '—',
  };
}

function formatTopTaxonomyStatHtml(entry) {
  if (!entry) return escapeHtmlText('—');
  const tokenWord = formatTokenCountWord(entry.count);
  const meta = `${entry.count.toLocaleString()} ${tokenWord} · ${formatUsd(entry.usd)}`;
  return `<span class="token-stat-top-taxonomy-name">${escapeHtmlText(entry.name)}</span><span class="token-stat-top-taxonomy-meta">${escapeHtmlText(meta)}</span>`;
}

function formatOverviewTokenCountHtml(count) {
  if (count == null) return escapeHtmlText('—');
  const n = Number(count);
  if (!Number.isFinite(n)) return escapeHtmlText('—');
  const word = n === 1 ? 'Token' : 'Tokens';
  return `${escapeHtmlText(n.toLocaleString())} <span class="token-stat-count-suffix">${escapeHtmlText(word)}</span>`;
}

function formatTokenCountWord(count) {
  return Number(count) === 1 ? 'token' : 'tokens';
}

function formatOverviewCountSuffixHtml(count, suffix) {
  if (count == null) return escapeHtmlText('—');
  const n = Number(count);
  if (!Number.isFinite(n)) return escapeHtmlText('—');
  return `${escapeHtmlText(n.toLocaleString())} <span class="token-stat-count-suffix">${escapeHtmlText(suffix)}</span>`;
}

function isLocalCachedLogoUrl(url) {
  if (Array.isArray(url)) return false;
  const u = String(url || '').trim();
  if (!u || u.includes(',')) return false;
  return (
    u.startsWith('/cached/token-icons/') ||
    u.startsWith('/data/token-icons/') ||
    u.startsWith('/api/proxy-logo?')
  );
}

function iconUrl(item) {
  const raw = item?.logoUrl;
  const u = Array.isArray(raw)
    ? window.VybeMintMetaCache?.normalizeLogoUrl?.(raw) || ''
    : String(raw || '').trim();
  if (!u) return '';
  // Local cache + same-origin proxy (ipfs.io 403s when loaded directly in the browser).
  if (isLocalCachedLogoUrl(u)) return u;
  if (u.startsWith('https://') || u.startsWith('http://')) return u;
  return '';
}

function clearLogoLoadTimeout(mint) {
  const id = logoImgTimeouts.get(mint);
  if (id != null) {
    clearTimeout(id);
    logoImgTimeouts.delete(mint);
  }
}

function clearAllLogoLoadTimeouts() {
  for (const id of logoImgTimeouts.values()) clearTimeout(id);
  logoImgTimeouts.clear();
}

function resetVybeLogoLoadQueue() {
  disconnectTokenLogoObserver();
  vybeOriginLogoMints.clear();
  vybeLogoLoadQueue.length = 0;
  vybeLogoLoadQueuedMints.clear();
  vybeLogoLoadQueueScheduled = false;
  logoSrcAssignedMints.clear();
}

function recordVybeOriginLogos(tokens) {
  vybeOriginLogoMints.clear();
  for (const t of tokens) {
    const u = String(t.logoUrl || '').trim();
    // Only stagger local /cached logos. Remote http(s) logos load immediately with
    // referrerpolicy=no-referrer (CDN hotlink guards blank them otherwise).
    if (u && isLocalCachedLogoUrl(u)) vybeOriginLogoMints.add(t.mintAddress);
  }
}

function enqueueVybeLogoImageLoad(mint, url) {
  if (!vybeOriginLogoMints.has(mint)) return;
  if (logoImageLoadedMints.has(mint) || logoFailedMints.has(mint)) return;
  if (logoSrcAssignedMints.has(mint)) return;
  if (vybeLogoLoadQueuedMints.has(mint)) return;
  vybeLogoLoadQueuedMints.add(mint);
  vybeLogoLoadQueue.push({ mint, url });
  scheduleVybeLogoLoadQueue();
}

function scheduleVybeLogoLoadQueue() {
  if (vybeLogoLoadQueueScheduled) return;
  vybeLogoLoadQueueScheduled = true;
  pumpVybeLogoLoadQueue();
}

function pumpVybeLogoLoadQueue() {
  if (vybeLogoLoadQueue.length === 0) {
    vybeLogoLoadQueueScheduled = false;
    return;
  }
  const { mint, url } = vybeLogoLoadQueue.shift();
  vybeLogoLoadQueuedMints.delete(mint);
  const img = holdersBody?.querySelector(
    `img.token-logo[data-logo-mint="${CSS.escape(mint)}"]`,
  );
  if (img && !logoImageLoadedMints.has(mint) && !logoFailedMints.has(mint)) {
    img.src = url;
    logoSrcAssignedMints.add(mint);
    armLogoLoadTimeout(mint);
  }
  setTimeout(pumpVybeLogoLoadQueue, VYBE_LOGO_LOAD_STAGGER_MS);
}

function failTokenLogo(mint) {
  clearLogoLoadTimeout(mint);
  const alreadyFailed = logoFailedMints.has(mint);
  logoFailedMints.add(mint);
  logoLoadingMints.delete(mint);
  logoPendingRepairMints.delete(mint);
  logoSrcAssignedMints.delete(mint);

  // Stale /cached paths after a server cache wipe must not keep retrying.
  const row = lastTokens.find((t) => t.mintAddress === mint);
  if (row && isLocalCachedLogoUrl(row.logoUrl)) {
    row.logoUrl = null;
  }
  window.VybeMintMetaCache?.forgetLogo?.(mint);

  if (!alreadyFailed) updateTableAfterLogoChange();
}

function armLogoLoadTimeout(mint) {
  clearLogoLoadTimeout(mint);
  const id = setTimeout(() => handleLogoLoadTimeout(mint), getLogoImgTimeoutMs());
  logoImgTimeouts.set(mint, id);
}

function tokenSkipsLogoRepair(mint) {
  const row = lastTokens.find((t) => t.mintAddress === mint);
  return row?.skipLogoEnrich === true;
}

function handleLogoLoadTimeout(mint) {
  logoImgTimeouts.delete(mint);
  if (logoFailedMints.has(mint) || logoImageLoadedMints.has(mint)) return;
  const row = lastTokens.find((t) => t.mintAddress === mint);
  const logo = String(row?.logoUrl || '').trim();
  // Remote / proxy logos: do NOT permanent-fail on timeout.
  // Our old path marked dozens failed while CDN/proxy requests were still in flight.
  if (
    logo.startsWith('http://') ||
    logo.startsWith('https://') ||
    logo.startsWith('/api/proxy-logo?')
  ) {
    return;
  }
  failTokenLogo(mint);
}

function handleTokenIconLoad(mint, imgEl) {
  clearLogoLoadTimeout(mint);
  logoImageLoadedMints.add(mint);
  if (imgEl) {
    imgEl.classList.remove('token-logo--img-loading');
    imgEl.style.opacity = '1';
  }
}

function handleTokenIconError(mint, imgEl) {
  clearLogoLoadTimeout(mint);
  logoImageLoadedMints.delete(mint);
  const row = lastTokens.find((t) => t.mintAddress === mint);
  const logo = String(row?.logoUrl || '').trim();
  const remote =
    logo.startsWith('http://') ||
    logo.startsWith('https://') ||
    logo.startsWith('/api/proxy-logo?');
  if (remote) {
    // Don't permanent-fail / re-render the whole table on one bad CDN.
    if (imgEl?.parentElement) {
      imgEl.parentElement.innerHTML = tokenLogoPlaceholderHtml();
    } else if (imgEl) {
      imgEl.remove();
    }
    return;
  }
  if (imgEl) {
    imgEl.classList.add('token-logo--img-loading');
    imgEl.style.opacity = '0';
  }
  failTokenLogo(mint);
}

function tokenLogoPlaceholderHtml() {
  return `<img class="token-logo token-logo--placeholder" src="${TOKEN_LOGO_PLACEHOLDER}" alt="" aria-hidden="true">`;
}

function tokenLogoEmptySlotHtml() {
  return `<span class="token-logo-slot token-logo-slot--pending" aria-hidden="true"></span>`;
}

function tokenLogoRepairPending(mint) {
  return (
    logoPendingRepairMints.has(mint) || logoLoadingMints.has(mint) || logoRepairInFlight.has(mint)
  );
}

function tokenIconHtml(t) {
  const mint = t.mintAddress;
  const icon = iconUrl(t);
  // After a 404/timeout, keep the placeholder until a stream update brings a fresh local URL.
  if (logoFailedMints.has(mint)) {
    return `<span class="token-logo-slot">${tokenLogoPlaceholderHtml()}</span>`;
  }
  const mintAttr = escapeHtmlAttr(mint);

  if (!icon) {
    if (t.skipLogoEnrich || tokenSkipsLogoRepair(mint)) {
      return `<span class="token-logo-slot">${tokenLogoPlaceholderHtml()}</span>`;
    }
    if (tokenLogoRepairPending(mint)) return tokenLogoEmptySlotHtml();
    return `<span class="token-logo-slot">${tokenLogoPlaceholderHtml()}</span>`;
  }

  const loaded = logoImageLoadedMints.has(mint);
  // Plain <img src> for remote/proxy logos — no opacity:0 / timeout kill loop.
  const directSrc =
    icon.startsWith('/api/proxy-logo?') ||
    icon.startsWith('https://') ||
    icon.startsWith('http://');
  if (directSrc) {
    if (!logoSrcAssignedMints.has(mint)) logoSrcAssignedMints.add(mint);
    return `<span class="token-logo-slot"><img class="token-logo" data-logo-mint="${mintAttr}" data-logo-url="${escapeHtmlAttr(icon)}" src="${escapeHtmlAttr(icon)}" referrerpolicy="no-referrer" alt="" loading="lazy" onload="window.__walletBalancesIconLoad?.('${mintAttr}', this)" onerror="window.__walletBalancesIconError?.('${mintAttr}', this)"></span>`;
  }

  const inFlight = logoSrcAssignedMints.has(mint) && !loaded && !logoFailedMints.has(mint);
  const vybeLogo = vybeOriginLogoMints.has(mint) ? ' data-vybe-logo="1"' : '';
  let inner = '';
  if (loaded || inFlight) {
    inner += `<img class="token-logo${loaded ? '' : ' token-logo--img-loading'}" data-logo-mint="${mintAttr}" data-logo-url="${escapeHtmlAttr(icon)}"${vybeLogo} src="${escapeHtmlAttr(icon)}" alt="" style="${loaded ? 'opacity:1' : 'opacity:0'}" onload="window.__walletBalancesIconLoad?.('${mintAttr}', this)" onerror="window.__walletBalancesIconError?.('${mintAttr}', this)">`;
    if (inFlight && !loaded) armLogoLoadTimeout(mint);
  } else {
    inner += `<img class="token-logo token-logo--img-loading" data-logo-mint="${mintAttr}" data-logo-url="${escapeHtmlAttr(icon)}"${vybeLogo} alt="" style="opacity:0" onload="window.__walletBalancesIconLoad?.('${mintAttr}', this)" onerror="window.__walletBalancesIconError?.('${mintAttr}', this)">`;
  }
  const slotClass = loaded ? 'token-logo-slot' : 'token-logo-slot token-logo-slot--pending';
  return `<span class="${slotClass}">${inner}</span>`;
}

function updateTableAfterLogoChange() {
  const totalUsd = lastTokens.reduce((s, row) => s + effectiveValueUsd(row), 0);
  renderTable(lastTokens, totalUsd);
}

async function fetchRepairedLogo(_mint, _force) {
  // Client per-mint /logo repair removed — stream enrich materializes logos server-side.
  return null;
}

function applyClientMintMeta(token) {
  if (!token || typeof token !== 'object') return token;
  window.VybeMintMetaCache?.hydrateToken?.(token);
  return token;
}

function rememberClientMintMeta(token) {
  window.VybeMintMetaCache?.rememberToken?.(token);
}

async function repairTokenLogo(_mint, _options = {}) {
  // No-op: do not call GET /api/token/:mint/logo after the holdings stream.
  return;
}

function prepareTopLogoRepairQueue(_tokens) {
  return [];
}

function queueTopLogoRepairs(_tokens) {
  /* no client /logo repair */
}

function setSupplyLegendGrid(el, sliceCount) {
  el.classList.remove('token-supply-legend--cols2', 'token-supply-legend--cols3', 'token-supply-legend--cols6');
  if (sliceCount <= 3) el.classList.add('token-supply-legend--cols3');
  else if (sliceCount === 4) el.classList.add('token-supply-legend--cols2');
  else el.classList.add('token-supply-legend--cols6');
}

function renderTierCard(args) {
  const t = escapeHtmlText(args.title);
  const iconHtml =
    args.pieRankKey && typeof holdersPieRankIconSvg === 'function'
      ? `<span class="token-tier-card__title-icon holders-summary-label-icon holders-summary-label-icon--${args.pieRankKey}" aria-hidden="true">${holdersPieRankIconSvg(args.pieRankKey, 'token-tier-card__title-icon__svg')}</span>`
      : '';
  const placeholderClass = args.placeholder ? ' token-tier-card--placeholder' : '';
  return `<div class="token-supply-legend-item token-supply-legend-item--tier-dashboard">
    <article class="token-tier-card${placeholderClass}" style="--tier-accent:${args.accent};--tier-swatch:${args.swatchColor}">
      <h4 class="token-tier-card__title">${iconHtml}<span class="token-tier-card__title-text">${t}</span></h4>
      <ul class="token-tier-card__metrics">
        <li class="token-tier-metric">
          <span class="token-tier-metric__ico token-tier-metric__ico--share-swatch" style="--tier-swatch:${args.swatchColor}" aria-hidden="true"></span>
          <div class="token-tier-metric__body"><span class="token-tier-metric__slice-pct">${formatPctSmart(args.slicePct)}</span><span class="token-tier-metric__muted">${escapeHtmlText(args.shareLabel ?? ' of portfolio')}</span></div>
        </li>
        <li class="token-tier-metric">
          <span class="token-tier-metric__ico token-tier-metric__ico--usd" aria-hidden="true">$</span>
          <div class="token-tier-metric__body"><span class="token-tier-metric__accent-usd">${args.usdLine}</span></div>
        </li>
        <li class="token-tier-metric">
          <span class="token-tier-metric__ico token-tier-metric__ico--volume" aria-hidden="true">${TIER_LEGEND_SVG_VOLUME}</span>
          <div class="token-tier-metric__body"><span class="token-tier-metric__accent-volume">${escapeHtmlText(args.amountLine)}</span></div>
        </li>
      </ul>
    </article>
  </div>`;
}

function renderTierCardPlaceholder(title, accent, swatch, pieRankKey) {
  return renderTierCard({
    title,
    pieRankKey,
    accent,
    swatchColor: swatch,
    slicePct: 0,
    shareLabel: ' of tokens',
    usdLine: '—',
    amountLine: '—',
    placeholder: true,
  });
}

const WALLET_SECTION_ICONS = {
  overview:
    '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/></svg>',
  portfolio:
    '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  holdings:
    '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
};

const WALLET_STAT_ROW_ICONS = {
  mint:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  category:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  verified:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  decimals:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h8M8 18h5"/></svg>',
  priceUsd:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  marketCap:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  price1d:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  price7d:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  supply:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
  tokenVol24h:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  usdVol24h:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  topPnlCohortVol:
    '<svg class="token-stat-row-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
};

/**
 * Portfolio Value cards: k / M / B / T after $9999, always 2 decimals when compact.
 */
function formatPortfolioStatUsd(n) {
  const num = toNum(n);
  if (!Number.isFinite(num)) return '—';
  if (num === 0) return '$0';
  const abs = Math.abs(num);
  const sign = num < 0 ? '−' : '';
  if (abs <= 9999) return formatUsd(num);

  let scaled;
  let suffix;
  if (abs >= 1e12) {
    scaled = abs / 1e12;
    suffix = 'T';
  } else if (abs >= 1e9) {
    scaled = abs / 1e9;
    suffix = 'B';
  } else if (abs >= 1e6) {
    scaled = abs / 1e6;
    suffix = 'M';
  } else {
    scaled = abs / 1e3;
    suffix = 'k';
  }
  return `${sign}$${scaled.toFixed(2)}${suffix}`;
}

function walletStatUsdHtml(value) {
  if (value == null) return escapeHtmlText('—');
  return `<span class="token-stat-usd-value">${escapeHtmlText(formatPortfolioStatUsd(value))}</span>`;
}

function walletStatUsdWithTotalHtml(value) {
  if (value == null) return escapeHtmlText('—');
  const n = Number(value);
  if (!Number.isFinite(n)) return escapeHtmlText('—');
  return `<span class="token-stat-usd-value">${escapeHtmlText(formatPortfolioStatUsd(n))}</span> <span class="token-stat-count-suffix">Total</span>`;
}

function walletStatRowHtml(row) {
  const icon = WALLET_STAT_ROW_ICONS[row.key];
  const aria = escapeHtmlAttr(row.label);
  return `<div class="token-stat-row token-stat-row--${row.key}" role="group" aria-label="${aria}">
    <div class="token-stat-row-icon" aria-hidden="true">${icon}</div>
    <div class="token-stat-row-body">
      <span class="token-stat-row-label">${escapeHtmlText(row.label)}</span>
      <span class="token-stat-row-value">${row.valueHtml}</span>
    </div>
  </div>`;
}

function walletStatSectionHtml(section) {
  const renderRowsBlock = (rows, rowsLayout) => {
    const markup = rows.map((r) => walletStatRowHtml(r)).join('');
    const rowsClass =
      rowsLayout === '2col' ? 'token-stat-rows token-stat-rows--2col' : 'token-stat-rows';
    return `<div class="${rowsClass}">${markup}</div>`;
  };

  const rowsMarkup = section.rowGroups?.length
    ? section.rowGroups.map((group) => renderRowsBlock(group.rows, group.rowsLayout)).join('')
    : renderRowsBlock(section.rows, section.rowsLayout);

  const rowsWrapperClass = section.rowGroups?.length ? 'token-stat-rows-stack' : '';

  return `<section class="token-stats-group token-stats-group--${section.theme}">
    <h3 class="token-stats-group-title">${section.icon}<span>${escapeHtmlText(section.title)}</span></h3>
    <div class="${rowsWrapperClass}">${rowsMarkup}</div>
  </section>`;
}

function buildWalletSummarySections(data) {
  const overview = {
    icon: WALLET_SECTION_ICONS.overview,
    title: 'Overview',
    theme: 'overview',
    rowGroups: [
      {
        rows: [
          {
            key: 'category',
            label: 'Total Holdings Loaded',
            valueHtml: formatOverviewTokenCountHtml(data.tokensCount),
          },
        ],
      },
      {
        rowsLayout: '2col',
        rows: [
          {
            key: 'verified',
            label: 'Verified',
            valueHtml: formatOverviewTokenCountHtml(data.verified),
          },
          {
            key: 'price1d',
            label: 'Unverified',
            valueHtml: formatOverviewTokenCountHtml(data.unverified),
          },
        ],
      },
    ],
  };
  const portfolio = {
    icon: WALLET_SECTION_ICONS.portfolio,
    title: 'Portfolio Value',
    theme: 'price',
    rowsLayout: '2col',
    rows: [
      { key: 'priceUsd', label: 'Estimated USD', valueHtml: walletStatUsdWithTotalHtml(data.totalUsd) },
      { key: 'marketCap', label: 'Verified USD', valueHtml: walletStatUsdWithTotalHtml(data.verifiedUsd) },
      { key: 'price1d', label: 'Unverified USD', valueHtml: walletStatUsdWithTotalHtml(data.unverifiedUsd) },
      {
        key: 'price7d',
        label: 'Unpriced USD',
        valueHtml: walletStatUsdWithTotalHtml(data.unpricedUsd),
      },
    ],
  };
  const taxonomy = {
    icon: WALLET_SECTION_ICONS.holdings,
    title: 'Categories & Labels',
    theme: 'supply',
    rowGroups: [
      {
        rowsLayout: '2col',
        rows: [
          {
            key: 'supply',
            label: 'Total categories',
            valueHtml: formatOverviewCountSuffixHtml(data.uniqueCategories, 'Categories'),
          },
          {
            key: 'usdVol24h',
            label: 'Total subcategories',
            valueHtml: formatOverviewCountSuffixHtml(data.uniqueSubcategories, 'Subcategories'),
          },
        ],
      },
      {
        rowsLayout: '2col',
        rows: [
          {
            key: 'tokenVol24h',
            label: 'Top category',
            valueHtml: formatTopTaxonomyStatHtml(data.topCategory),
          },
          {
            key: 'topPnlCohortVol',
            label: 'Top subcategory',
            valueHtml: formatTopTaxonomyStatHtml(data.topSubcategory),
          },
        ],
      },
    ],
  };
  return `<div class="token-stats-row token-stats-row--split-overview"><div class="token-stats-col token-stats-col--overview">${walletStatSectionHtml(overview)}</div><div class="token-stats-col token-stats-col--pair"><div class="token-stats-pair-grid">${walletStatSectionHtml(portfolio)}${walletStatSectionHtml(taxonomy)}</div></div></div>`;
}

function buildWalletSummaryPlaceholderHtml() {
  return buildWalletSummarySections({
    wallet: '—',
    tokensCount: null,
    priced: null,
    verified: null,
    unverified: null,
    totalUsd: null,
    verifiedUsd: null,
    unverifiedUsd: null,
    unpricedCount: null,
    unpricedUsd: null,
    uniqueCategories: null,
    uniqueSubcategories: null,
    topCategory: null,
    topSubcategory: null,
  });
}

function formatWalletUpdateTime() {
  return new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function setSectionViewSwitchersLocked(locked) {
  for (const label of [holdersTableViewSwitchLabel, walletStatsViewSwitchLabel]) {
    if (!label) continue;
    label.classList.toggle('trades-fetch-switch--locked', locked);
    label.setAttribute('aria-disabled', locked ? 'true' : 'false');
  }
  if (holdersTableViewSwitch) holdersTableViewSwitch.disabled = locked;
  if (walletStatsViewSwitch) walletStatsViewSwitch.disabled = locked;
}

function setWalletBalancesLoading(isLoading) {
  for (const el of [loadingIndicator, holdersLoading, walletSummaryLoading, holdingsStatsLoading]) {
    if (!el) continue;
    el.hidden = !isLoading;
    el.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
  }
  setSectionViewSwitchersLocked(isLoading);
}

function renderWalletSummaryPlaceholder() {
  walletSummaryLabel.textContent = '—';
  walletLastUpdatedValue.textContent = '—';
  walletSummaryStats.innerHTML = buildWalletSummaryPlaceholderHtml();
  updateHoldersSummaryStrip([]);
}

function walletUsdBands() {
  return [
    { label: '$0.01', contains: (v) => v > 0 && v < 0.01 },
    { label: '$0.01-$0.10', contains: (v) => v >= 0.01 && v < 0.1 },
    { label: '$0.10-$1', contains: (v) => v >= 0.1 && v < 1 },
    { label: '$1-$10', contains: (v) => v >= 1 && v < 10 },
    { label: '$10-$100', contains: (v) => v >= 10 && v < 100 },
    { label: '$100-$1,000', contains: (v) => v >= 100 && v < 1000 },
    { label: '$1,000-$10,000', contains: (v) => v >= 1000 && v < 10000 },
    { label: '$10,000+', contains: (v) => v >= 10000 },
  ];
}

function formatHoldingValueUsdCellHtml(valueUsd) {
  const v = toNum(valueUsd);
  if (!Number.isFinite(v) || v <= 0) return '—';
  const { tierClass } = holdingsValueBarTierMeta(v);
  const text = formatHoldingUsdValue(v);
  const main = `<span class="holders-usd-tier ${tierClass}">${escapeHtmlText(text)}</span>`;
  return wrapHoldersCellWithBars(main, renderHoldingsValueBars(v));
}

function formatBandTotalUsd(n) {
  const num = toNum(n);
  if (!Number.isFinite(num) || num <= 0) return '$0';
  // Full through $9999; then k/M/B with always 2 decimals ($10.00k, $1.36M).
  return formatPortfolioStatUsd(num);
}

function renderUsdBarRow(d, i, count, total, maxC, sumUsd) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const w = Math.min(100, (count / maxC) * 100);
  const sampleUsd = holdingsUsdBandSampleUsd(i);
  const { color } = holdingsValueBarTierMeta(sampleUsd);
  const safe = escapeHtmlText(d.label);
  const icon = renderHoldingsValueBars(sampleUsd);
  const pctLabel = formatPctSmart(pct);
  const tokenMeta =
    count > 0
      ? `<span class="holders-value-usd" style="color:${escapeHtmlAttr(color)}">${count.toLocaleString()} ${formatTokenCountWord(count)} (Total: ${escapeHtmlText(formatBandTotalUsd(sumUsd))})</span> `
      : '';
  return `<div class="holders-hbar-row">
    <span class="holders-hbar-name" style="color:${escapeHtmlAttr(color)}" title="${safe}">${icon}${safe}</span>
    <div class="holders-hbar-track"><div class="holders-hbar-fill" style="width:${w}%;background:${color}"></div></div>
    <span class="holders-hbar-meta">${tokenMeta}${pctLabel}</span>
  </div>`;
}

function renderUsdBarsPlaceholderHtml() {
  const defs = walletUsdBands();
  return defs.map((d, i) => renderUsdBarRow(d, i, 0, 0, 1, 0)).join('');
}

function renderUsdBars(tokens) {
  const defs = walletUsdBands();
  const counts = defs.map(() => 0);
  const sums = defs.map(() => 0);
  let pricedCount = 0;
  for (const t of tokens) {
    const v = effectiveValueUsd(t);
    const idx = defs.findIndex((d) => d.contains(v));
    if (idx >= 0) {
      counts[idx] += 1;
      sums[idx] += v;
      pricedCount += 1;
    }
  }
  const maxC = Math.max(1, ...counts);
  const total = pricedCount || 1;
  holdingsUsdBars.innerHTML = defs
    .map((d, i) => renderUsdBarRow(d, i, counts[i], total, maxC, sums[i]))
    .join('');
}

const PIE_BREAK_EVEN_MIN = -0.5;
const PIE_BREAK_EVEN_MAX = 1;
const PIE_LOSING_MAX = -0.5;

function isPieBreakingEvenPct(pct) {
  return pct >= PIE_BREAK_EVEN_MIN && pct <= PIE_BREAK_EVEN_MAX;
}

function isPieLosingPct(pct) {
  return pct < PIE_LOSING_MAX;
}

function classifyTokenPieChange(t) {
  const has1d = hasValidPriceChangePct(t.priceChange1dPct);
  const has7d = hasValidPriceChangePct(t.priceChange7dPct);
  if (!has1d && !has7d) return 'dead';

  const d1 = has1d ? Number(t.priceChange1dPct) : null;
  const d7 = has7d ? Number(t.priceChange7dPct) : null;

  if ((d1 != null && d1 >= 1) || (d7 != null && d7 > 1)) return 'profitable';

  const losing1d = d1 != null && isPieLosingPct(d1);
  const losing7d = d7 != null && isPieLosingPct(d7);
  if (d1 != null && d7 != null && losing1d && losing7d) return 'losing';
  if ((d1 != null && d7 == null && losing1d) || (d7 != null && d1 == null && losing7d)) return 'losing';

  if ((d1 != null && isPieBreakingEvenPct(d1)) || (d7 != null && isPieBreakingEvenPct(d7))) return 'breaking_even';

  if (losing1d || losing7d) return 'losing';

  return 'breaking_even';
}

const HOLDERS_PIE_RANK_ICONS = {
  profitable:
    '<path d="M2.5 11.5 6.5 7.5 9 10 13.5 4.5" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 4.5H13.5V7.5" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>',
  breaking_even:
    '<path d="M2.5 8h11" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/><path d="M5.5 6.15h5M5.5 9.85h5" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.55"/>',
  losing:
    '<path d="M2.5 4.5 6.5 8.5 9 6 13.5 11.5" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 11.5H13.5V8.5" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>',
  dead: HOLDERS_BADGE_SVGS.dead,
};

const HOLDERS_PIE_RANK_LABELS = {
  profitable: 'Profitable',
  breaking_even: 'Breaking even',
  losing: 'Losing value',
  dead: 'Dead token',
};

function holdersPieRankIconSvg(key, className = 'holders-pie-rank-icon__svg') {
  const paths = HOLDERS_PIE_RANK_ICONS[key] || '';
  return `<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true">${paths}</svg>`;
}

function holdersBadgeIconSvg(key, className = 'holders-summary-label-badge__svg') {
  const paths = HOLDERS_BADGE_SVGS[key] || '';
  return `<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true">${paths}</svg>`;
}

function holdersRankBadgeHtml(key) {
  const label = HOLDERS_PIE_RANK_LABELS[key] || key;
  return `<span class="holders-rank-badge holders-rank-badge--${key}" title="${escapeHtmlAttr(label)}" aria-label="${escapeHtmlAttr(label)}">${holdersPieRankIconSvg(key, 'holders-rank-badge__svg')}</span>`;
}

function hydrateHoldersSummaryLabelIcons() {
  document.querySelectorAll('[data-holders-pie-rank]').forEach((el) => {
    const key = el.dataset.holdersPieRank;
    if (!key || !HOLDERS_PIE_RANK_ICONS[key]) return;
    el.innerHTML = holdersPieRankIconSvg(key, 'holders-summary-label-icon__svg');
    el.classList.add('holders-summary-label-icon', `holders-summary-label-icon--${key}`);
  });
  document.querySelectorAll('[data-holders-badge]').forEach((el) => {
    const key = el.dataset.holdersBadge;
    if (!key || !HOLDERS_BADGE_SVGS[key]) return;
    const svgClass = el.closest('.token-badge') ? 'token-badge__svg' : 'holders-summary-label-badge__svg';
    el.outerHTML = holdersBadgeIconSvg(key, svgClass);
  });
}

function priceChange24hBuckets(tokens) {
  const buckets = {
    profitable: { usd: 0, count: 0 },
    breaking_even: { usd: 0, count: 0 },
    losing: { usd: 0, count: 0 },
    dead: { usd: 0, count: 0 },
  };
  for (const t of tokens) {
    const cat = classifyTokenPieChange(t);
    buckets[cat].count += 1;
    buckets[cat].usd += effectiveValueUsd(t);
  }
  const order = ['profitable', 'breaking_even', 'losing', 'dead'];
  const totalCount = tokens.length || 1;
  return {
    order,
    slices: order.map((k) => (buckets[k].count / totalCount) * 100),
    usd: order.map((k) => buckets[k].usd),
    counts: order.map((k) => buckets[k].count),
    buckets,
  };
}

function buildPriceChangePieInsight(bucket, totalTokens) {
  if (totalTokens === 0) return 'No holdings loaded.';
  const labels = {
    profitable: 'profitable',
    breaking_even: 'breaking even',
    losing: 'losing value',
    dead: 'dead with no price change data',
  };
  let topKey = bucket.order[0];
  for (const key of bucket.order) {
    if (bucket.buckets[key].count > bucket.buckets[topKey].count) topKey = key;
  }
  const topIdx = bucket.order.indexOf(topKey);
  return `${formatPctSmart(bucket.slices[topIdx])} of tokens are ${labels[topKey]}.`;
}

function setWalletStatsView(mode) {
  const showHoldings = mode === 'holdings';
  if (walletStatsViewSwitch) walletStatsViewSwitch.checked = !showHoldings;
  if (holdingsStatsContent) holdingsStatsContent.hidden = !showHoldings;
  if (pnlStatsContent) pnlStatsContent.hidden = showHoldings;
  if (walletStatsSectionTitle) {
    walletStatsSectionTitle.textContent = showHoldings ? 'Holdings Stats' : 'PnL Stats (7 days)';
  }
}

/** Keep Stats + Table tabs on the same Holdings vs PnL side. */
function setLinkedPageView(mode) {
  const view = mode === 'pnl' ? 'pnl' : 'holdings';
  setWalletStatsView(view);
  setHoldersTableView(view);
}

function setChartsPlaceholder() {
  walletStatsSection.hidden = false;
  const empty4 = buildPieGradientWithGaps([0, 0, 0, 0], PRICE_CHANGE_PIE_HEX);
  portfolioPie.style.background = empty4;
  mountDonutPieOverlays(portfolioPie, [0, 0, 0, 0], PRICE_CHANGE_PIE_HEX, { mock: true, hubSubline: '—' });
  setSupplyLegendGrid(portfolioLegend, 4);
  portfolioLegend.innerHTML = PRICE_CHANGE_PIE_TITLES.map((title, i) =>
    renderTierCardPlaceholder(title, PRICE_CHANGE_PIE_HEX[i], PRICE_CHANGE_PIE_HEX[i], PRICE_CHANGE_PIE_KEYS[i]),
  ).join('');
  holdingsUsdBars.innerHTML = renderUsdBarsPlaceholderHtml();
  portfolioPieLede.textContent = 'Load a wallet to see price change breakdown.';
  portfolioPieInsight.textContent = 'Profitable, even, losing, or dead tokens (1d/7d).';
  if (holdingsStatsMeta) {
    holdingsStatsMeta.textContent = 'Load a wallet to see portfolio profitability and USD value band charts.';
  }
}

function renderCharts(tokens, wallet, totalUsd) {
  walletStatsSection.hidden = false;
  const bucket = priceChange24hBuckets(tokens);
  const display = applyMinVisibleSlices(bucket.slices);
  portfolioPie.style.background = buildPieGradientWithGaps(display, PRICE_CHANGE_PIE_HEX);
  mountDonutPieOverlays(portfolioPie, display, PRICE_CHANGE_PIE_HEX, {
    mock: false,
    hubSubline: `${formatUsd(totalUsd)} · ${tokens.length} tokens`,
  });

  setSupplyLegendGrid(portfolioLegend, 4);
  portfolioLegend.innerHTML = PRICE_CHANGE_PIE_TITLES.map((title, i) => {
    const count = Number(bucket.counts[i]) || 0;
    if (count <= 0) {
      return renderTierCardPlaceholder(title, PRICE_CHANGE_PIE_HEX[i], PRICE_CHANGE_PIE_HEX[i], PRICE_CHANGE_PIE_KEYS[i]);
    }
    return renderTierCard({
      title,
      pieRankKey: PRICE_CHANGE_PIE_KEYS[i],
      accent: PRICE_CHANGE_PIE_HEX[i],
      swatchColor: PRICE_CHANGE_PIE_HEX[i],
      slicePct: bucket.slices[i],
      shareLabel: ' of tokens',
      usdLine: formatUsd(bucket.usd[i]),
      amountLine: `${count} ${formatTokenCountWord(count)}`,
    });
  }).join('');

  portfolioPieTitle.textContent = 'Tokens ranked by profitability';
  portfolioPieLede.textContent = `${tokens.length} tokens · ${formatUsd(totalUsd)} estimated portfolio value`;
  portfolioPieInsight.textContent = buildPriceChangePieInsight(bucket, tokens.length);

  if (holdingsStatsMeta) {
    holdingsStatsMeta.textContent = `Wallet holdings: ${tokens.length} ${formatTokenCountWord(tokens.length)} · profitability pie and USD value bands.`;
  }

  renderUsdBars(tokens);
}

function renderSummaryStats(tokens, wallet, totalUsd) {
  const priced = tokens.filter((t) => effectiveValueUsd(t) > 0).length;
  const verified = tokens.filter((t) => t.verified).length;
  const unverified = tokens.length - verified;
  const unpricedCount = tokens.filter((t) => effectiveValueUsd(t) <= 0).length;
  const unpricedUsd = tokens.reduce((sum, t) => (effectiveValueUsd(t) <= 0 ? sum + effectiveValueUsd(t) : sum), 0);
  const taxonomy = aggregateWalletTaxonomy(tokens);

  let verifiedUsd = 0;
  let unverifiedUsd = 0;
  for (const t of tokens) {
    const v = effectiveValueUsd(t);
    if (v <= 0) continue;
    if (t.verified) verifiedUsd += v;
    else unverifiedUsd += v;
  }

  walletSummaryLabel.textContent = wallet;
  walletLastUpdatedValue.textContent = formatWalletUpdateTime();
  walletSummaryStats.innerHTML = buildWalletSummarySections({
    wallet,
    tokensCount: tokens.length,
    priced,
    verified,
    unverified,
    totalUsd,
    verifiedUsd,
    unverifiedUsd,
    unpricedCount,
    unpricedUsd,
    uniqueCategories: taxonomy.uniqueCategories,
    uniqueSubcategories: taxonomy.uniqueSubcategories,
    topCategory: taxonomy.topCategory,
    topSubcategory: taxonomy.topSubcategory,
  });
}

function countCategorisedTokens(tokens) {
  return tokens.filter((t) => (t.category || '').trim() || (t.subcategory || '').trim()).length;
}

function buildCategorisedSummaryTooltip(tokens) {
  const taxonomy = aggregateWalletTaxonomy(tokens);
  const parts = [];
  if (taxonomy.uniqueCategories > 0) {
    parts.push(`${taxonomy.uniqueCategories} categor${taxonomy.uniqueCategories === 1 ? 'y' : 'ies'}`);
  }
  if (taxonomy.uniqueSubcategories > 0) {
    parts.push(`${taxonomy.uniqueSubcategories} subcategor${taxonomy.uniqueSubcategories === 1 ? 'y' : 'ies'}`);
  }
  if (taxonomy.topCategory) {
    parts.push(`Top category: ${taxonomy.topCategory.name}`);
  }
  if (taxonomy.topSubcategory) {
    parts.push(`Top subcategory: ${taxonomy.topSubcategory.name}`);
  }
  if (parts.length === 0) return 'No tokens with category or subcategory';
  return parts.join(' · ');
}

function updateHoldersSummaryStrip(tokens) {
  const bucket = priceChange24hBuckets(tokens);
  const verified = tokens.filter((t) => t.verified).length;
  const categorised = countCategorisedTokens(tokens);
  const total = tokens.length;
  if (holdersSummaryCount) holdersSummaryCount.textContent = String(total);
  const setSummaryValue = (el, count) => {
    if (!el) return;
    el.innerHTML = holdersSummaryRatioValueHtml(count, total);
  };
  setSummaryValue(holdersSummaryProfitable, bucket.buckets.profitable.count);
  setSummaryValue(holdersSummaryBreakingEven, bucket.buckets.breaking_even.count);
  setSummaryValue(holdersSummaryLosing, bucket.buckets.losing.count);
  setSummaryValue(holdersSummaryDead, bucket.buckets.dead.count);
  setSummaryValue(holdersSummaryVerified, verified);
  setSummaryValue(holdersSummaryCategorised, categorised);
  if (holdersSummaryCategorisedTip) {
    holdersSummaryCategorisedTip.textContent = buildCategorisedSummaryTooltip(tokens);
  }
}

function holdersSummaryRatioValueHtml(count, total) {
  const n = Number(count);
  const safeCount = Number.isFinite(n) ? n : 0;
  const safeTotal = Number.isFinite(Number(total)) ? Number(total) : 0;
  const pct = safeTotal > 0 ? (safeCount / safeTotal) * 100 : 0;
  return `<span class="trades-summary-value__main">${safeCount}</span><span class="trades-summary-value__suffix"> / ${safeTotal} <span class="trades-summary-value__pct">(${escapeHtmlText(formatPctSmart(pct))})</span></span>`;
}

function isVybePriceSource(src) {
  return /^vybe/i.test(String(src || '').trim());
}

function isJupiterPriceSource(src) {
  return /^jupiter$/i.test(String(src || '').trim());
}

function isPumpfunPriceSource(src) {
  const s = String(src || '').trim().toLowerCase();
  return s === 'pumpfun-api' || s === 'pump.fun' || s === 'pumpfun' || s === 'pump fun';
}

/** Normalize stored priceSource labels for the Data source column. */
function displayPriceSourceLabel(src) {
  const text = String(src || '').trim();
  if (!text) return '—';
  if (isPumpfunPriceSource(text)) return 'Pump.fun';
  if (isJupiterPriceSource(text)) return 'Jupiter';
  if (isVybePriceSource(text)) return text.replace(/^vybe\b/i, 'Vybe');
  return text;
}

function formatPriceSourceCellHtml(src) {
  const text = displayPriceSourceLabel(src);
  if (text === '—') return '—';
  let icon = '';
  if (isVybePriceSource(src)) icon = VYBE_PRICE_SOURCE_ICON;
  else if (isJupiterPriceSource(src)) icon = JUPITER_PRICE_SOURCE_ICON;
  else if (isPumpfunPriceSource(src)) icon = PUMPFUN_PRICE_SOURCE_ICON;
  if (!icon) return escapeHtmlText(text);
  return `<span class="holders-price-source">${icon}<span>${escapeHtmlText(text)}</span></span>`;
}

function formatMintCellHtml(mint) {
  const addr = String(mint || '').trim();
  if (!addr) return '—';
  const label = mintColumnLabel(addr);
  const href = `${SOLSCAN_TOKEN}${encodeURIComponent(addr)}`;
  return `<a class="holders-mint-link" href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtmlAttr(addr)}">${escapeHtmlText(label)}${HOLDERS_EXTERNAL_LINK_SVG}</a>`;
}

const HOLDERS_PLACEHOLDER_ROW_COUNT = 16;

function buildHoldersPlaceholderRows(count = HOLDERS_PLACEHOLDER_ROW_COUNT) {
  const dash = '—';
  const logo = tokenLogoEmptySlotHtml();
  return Array.from({ length: count }, (_, i) => `<tr class="holders-row holders-row--placeholder">
    <td class="holders-rank-col"><div class="holders-rank-cell"><span class="holders-rank-num">${i + 1}</span></div></td>
    <td class="holders-change-col">${dash}</td>
    <td><div class="token-header">${logo}<div class="token-header-text"><div class="symbol">${dash}</div><div class="name">${dash}</div></div></div></td>
    <td class="num holders-portfolio-col">${dash}</td>
    <td class="holders-value-usd num">${dash}</td>
    <td class="num holders-amount-col">${dash}</td>
    <td class="num holders-price-col">${dash}</td>
    <td class="num holders-mcap-supply-col">${dash}</td>
    <td class="num holders-vol-col">${dash}</td>
    <td class="holders-price-source-col">${dash}</td>
    <td class="meta holders-mint-col">${dash}</td>
  </tr>`).join('');
}

function renderHoldersTablePlaceholder() {
  if (!holdersBody) return;
  holdersBody.innerHTML = buildHoldersPlaceholderRows();
}

function renderTable(tokens, totalUsd) {
  updateHoldersSummaryStrip(tokens);
  const sorted = [...tokens].sort(compareHoldersTableRows);
  holdersBody.innerHTML = sorted
    .map((t, i) => {
      const v = effectiveValueUsd(t);
      const pct = totalUsd > 0 && v > 0 ? (v / totalUsd) * 100 : 0;
      const iconHtml = tokenIconHtml(t);
      const src = t.priceSource || (v > 0 ? 'Vybe' : '—');
      const pieCat = classifyTokenPieChange(t);
      return `<tr class="holders-row holders-row--${pieCat}">
        <td class="holders-rank-col"><div class="holders-rank-cell">${holdersRankBadgeHtml(pieCat)}<span class="holders-rank-num holders-rank-num--${pieCat}">${i + 1}</span></div></td>
        <td class="holders-change-col">${formatChangeColumnHtml(t)}</td>
        <td><div class="token-header">${iconHtml}<div class="token-header-text"><div class="symbol">${escapeHtmlText(displayTokenSymbol(t.symbol))}${tokenSymbolBadgesHtml(t)}</div><div class="name">${escapeHtmlText(t.name)}</div></div></div></td>
        <td class="num holders-portfolio-col">${formatPortfolioPctColumnHtml(pct, v > 0)}</td>
        <td class="holders-value-usd num">${formatHoldingValueUsdCellHtml(v)}</td>
        <td class="num holders-amount-col">${formatHoldingAmountCellHtml(t)}</td>
        <td class="num holders-price-col">${formatPriceColumnHtml(t)}</td>
        <td class="num holders-mcap-supply-col">${formatMarketCapSupplyColumnHtml(t)}</td>
        <td class="num holders-vol-col">${formatUsdVolColumnHtml(t)}</td>
        <td class="holders-price-source-col">${formatPriceSourceCellHtml(src)}</td>
        <td class="meta holders-mint-col">${formatMintCellHtml(t.mintAddress)}</td>
      </tr>`;
    })
    .join('');
  observeTokenLogosInTable();
}

function showError(msg) {
  errorSection.hidden = false;
  errorText.textContent = msg;
  holdersError.hidden = false;
  holdersError.textContent = msg;
}

function clearError() {
  errorSection.hidden = true;
  errorText.textContent = '';
  holdersError.hidden = true;
  holdersError.textContent = '';
}

async function fetchBalances() {
  const wallet = walletInput.value.trim();
  if (!wallet) {
    showError('Wallet address required');
    return;
  }
  clearError();
  fetchAllBtn.disabled = true;
  setWalletBalancesLoading(true);
  renderWalletSummaryPlaceholder();
  setChartsPlaceholder();
  walletStatsSection.hidden = false;
  clearAllLogoLoadTimeouts();
  resetVybeLogoLoadQueue();
  logoFailedMints.clear();
  logoRepairAttemptedMints.clear();
  logoPendingRepairMints.clear();
  logoLoadingMints.clear();
  logoRepairInFlight.clear();
  logoImageLoadedMints.clear();

  let unlocked = false;
  const unlockUi = () => {
    if (unlocked) return;
    unlocked = true;
    fetchAllBtn.disabled = false;
    setWalletBalancesLoading(false);
  };

  const applyTokens = (tokens, { repairLogos = false } = {}) => {
    const hydrated = (Array.isArray(tokens) ? tokens : []).map((row) => {
      const copy = { ...row };
      applyClientMintMeta(copy);
      return copy;
    });
    recordVybeOriginLogos(hydrated);
    lastTokens = hydrated;
    applySuspiciousValueUsdMask(lastTokens);
    for (const row of lastTokens) rememberClientMintMeta(row);
    const totalUsd = lastTokens.reduce((sum, row) => sum + effectiveValueUsd(row), 0);
    renderSummaryStats(lastTokens, wallet, totalUsd);
    renderCharts(lastTokens, wallet, totalUsd);
    renderTable(lastTokens, totalUsd);
    if (!holdersTableViewSwitch?.checked) {
      holdersMeta.textContent = formatHoldersMetaLoadedText(lastTokens.length);
    }
    if (repairLogos) {
      // Logos are materialized in the balance stream (enrichLimit). Do not fire
      // per-mint GET /api/token/:mint/logo — that was a blocking post-fetch fallback.
    }
  };

  const upsertToken = (token) => {
    if (!token?.mintAddress) return;
    applyClientMintMeta(token);
    applySuspiciousValueUsdMask([token]);
    const idx = lastTokens.findIndex((t) => t.mintAddress === token.mintAddress);
    if (idx >= 0) {
      const prev = lastTokens[idx];
      // Keep a known local logo if the stream briefly omits it.
      if (!isLocalCachedLogoUrl(token.logoUrl) && isLocalCachedLogoUrl(prev?.logoUrl)) {
        token.logoUrl = prev.logoUrl;
      }
      lastTokens[idx] = token;
    } else lastTokens.push(token);
    lastTokens = [...lastTokens].sort(compareHoldersTableRows);
    const logo = String(token.logoUrl || '').trim();
    if (isLocalCachedLogoUrl(logo) || logo.startsWith('https://') || logo.startsWith('http://')) {
      logoFailedMints.delete(token.mintAddress);
      logoSrcAssignedMints.add(token.mintAddress);
      logoPendingRepairMints.delete(token.mintAddress);
      rememberClientMintMeta(token);
    }
    applyTokens(lastTokens, { repairLogos: false });
    // Stream updates carry materialized local logos; no client /logo repair.
  };

  try {
    const limit = limitSelect.value || '1000';
    const enrichLimit = getTopLogoRepairN();
    const url = `/api/wallets/${encodeURIComponent(wallet)}/token-balances?stream=1&enrich=1&limit=${limit}&enrichLimit=${enrichLimit}`;
    let walletPnlPromise = null;
    if (window.WalletPnlSection?.isEnabled?.()) {
      walletPnlPromise = window.WalletPnlSection.fetchForWallet(wallet);
    } else {
      window.WalletPnlSection?.resetPlaceholder?.();
      window.WalletPnlTable?.resetPlaceholder?.();
    }

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text();
      let errMsg = `HTTP ${res.status}`;
      try {
        const body = JSON.parse(text);
        if (body.error) errMsg = body.error;
      } catch {
        const trimmed = text.trim();
        if (trimmed) errMsg = trimmed;
      }
      throw new Error(errMsg);
    }

    if (!res.body) throw new Error('No response body for balance stream');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (event.event === 'initial' && Array.isArray(event.tokens)) {
          applyStreamEnrichForceDisable(event.tokens);
          applyTokens(event.tokens, { repairLogos: true });
          unlockUi();
        } else if (event.event === 'update' && event.token) {
          upsertToken(event.token);
        }
      }
    }

    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer.trim());
        if (event.event === 'initial' && Array.isArray(event.tokens)) {
          applyStreamEnrichForceDisable(event.tokens);
          applyTokens(event.tokens, { repairLogos: true });
          unlockUi();
        } else if (event.event === 'update' && event.token) {
          upsertToken(event.token);
        }
      } catch {
        /* ignore trailing partial */
      }
    }

    if (walletPnlPromise) await walletPnlPromise;
    if (holdersTableViewSwitch?.checked) {
      updateHoldersSectionMeta('pnl');
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    unlockUi();
  }
}

const HOLDERS_META_PLACEHOLDER = 'Load a wallet to see token balances ranked by USD value, with 1d/7d price change, market cap, and data source.';
const HOLDERS_PNL_META_PLACEHOLDER = 'Load a wallet with 7d PnL enabled to see per-token realized and unrealized PnL, buys/sells, and volumes.';

function formatHoldersMetaLoadedText(tokensCount) {
  return `${tokensCount} tokens · Vybe wallet balances · Vybe token-details for category, supply, volume, and 1d/7d price change.`;
}

function formatHoldersPnlMetaLoadedText(metricsCount) {
  return `Wallet PnL: ${metricsCount} per-token row(s) for the 7d window.`;
}

function updateHoldersSectionMeta(view = holdersTableViewSwitch?.checked ? 'pnl' : 'holdings') {
  if (!holdersMeta) return;
  if (view === 'pnl') {
    const metrics = window.WalletPnlSection?.getLastTokenMetrics?.() ?? [];
    holdersMeta.textContent = metrics.length
      ? formatHoldersPnlMetaLoadedText(metrics.length)
      : HOLDERS_PNL_META_PLACEHOLDER;
    return;
  }
  holdersMeta.textContent = lastTokens.length
    ? formatHoldersMetaLoadedText(lastTokens.length)
    : HOLDERS_META_PLACEHOLDER;
}

function setHoldersTableView(mode) {
  const showPnl = mode === 'pnl';
  if (holdersTableViewSwitch) holdersTableViewSwitch.checked = showPnl;
  if (holdersTableWrap) holdersTableWrap.hidden = showPnl;
  if (walletPnlTableWrap) walletPnlTableWrap.hidden = !showPnl;
  if (holdersSummaryGrid) holdersSummaryGrid.hidden = showPnl;
  if (holdersSectionTitle) {
    holdersSectionTitle.textContent = showPnl ? 'Wallet PnL (7d)' : 'Token Holdings';
  }
  updateHoldersSectionMeta(mode);
  if (showPnl && window.WalletPnlTable) {
    window.WalletPnlTable.onMetricsUpdated();
  }
}

function initWalletPnlIntegration() {
  if (window.WalletPnlSection) {
    window.WalletPnlSection.init({
      walletPnlDetails: document.getElementById('walletPnlDetails'),
      walletPnlMeta: document.getElementById('walletPnlMeta'),
      walletPnlLoading: document.getElementById('walletPnlLoading'),
      walletPnlError: document.getElementById('walletPnlError'),
      walletPnl7dEnabled: document.getElementById('walletPnl7dEnabled'),
    });
  }
  if (window.WalletPnlTable) {
    window.WalletPnlTable.init({
      walletPnlAssetsBody: document.getElementById('walletPnlAssetsBody'),
    });
  }
  setLinkedPageView('holdings');
  holdersTableViewSwitch?.addEventListener('change', () => {
    setLinkedPageView(holdersTableViewSwitch.checked ? 'pnl' : 'holdings');
  });
  walletStatsViewSwitch?.addEventListener('change', () => {
    setLinkedPageView(walletStatsViewSwitch.checked ? 'pnl' : 'holdings');
  });
}

setChartsPlaceholder();
renderWalletSummaryPlaceholder();
renderHoldersTablePlaceholder();
updateHoldersSectionMeta('holdings');
hydrateHoldersSummaryLabelIcons();
initLogoRepairSettings();
initWalletPnlIntegration();
fetchAllBtn.addEventListener('click', () => fetchBalances());
walletInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchBalances();
});

window.__walletBalancesIconError = handleTokenIconError;
window.__walletBalancesIconLoad = handleTokenIconLoad;
