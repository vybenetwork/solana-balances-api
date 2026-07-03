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
  '<img class="holders-price-source__vybe-icon" src="/favicon.svg" alt="" width="14" height="14" decoding="async"/>';
const HOLDERS_EXTERNAL_LINK_SVG =
  '<svg class="holders-mint-link__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3h2v2M9 7l4-4M12 3H8a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9M7 5H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const walletInput = document.getElementById('wallet');
const limitSelect = document.getElementById('limit');
const fetchAllBtn = document.getElementById('fetchAll');
const loadingIndicator = document.getElementById('loadingIndicator');
const walletSummaryLabel = document.getElementById('walletSummaryLabel');
const walletSummarySub = document.getElementById('walletSummarySub');
const walletLastUpdatedValue = document.getElementById('walletLastUpdatedValue');
const walletSummaryStats = document.getElementById('walletSummaryStats');
const chartsPanel = document.getElementById('chartsPanel');
const portfolioPie = document.getElementById('portfolioPie');
const portfolioLegend = document.getElementById('portfolioLegend');
const portfolioPieTitle = document.getElementById('portfolioPieTitle');
const portfolioPieLede = document.getElementById('portfolioPieLede');
const portfolioPieInsight = document.getElementById('portfolioPieInsight');
const holdingsUsdBars = document.getElementById('holdingsUsdBars');
const holdersLoading = document.getElementById('holdersLoading');
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
const errorSection = document.getElementById('errorSection');
const errorText = document.getElementById('errorText');

let lastTokens = [];
const TOP_LOGO_REPAIR_N = 20;
const logoLoadingMints = new Set();
const logoRepairInFlight = new Set();
const logoFailedMints = new Set();
const logoPendingRepairMints = new Set();
const logoImageLoadedMints = new Set();

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

/** 0 decimals unless |value| < 1 (then 2). Values in (0, 0.01) display as 0.01. */
function formatRoundedValue(num) {
  const n = Number(num);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return '0';
  if (n > 0 && n < 0.01) return '0.01';
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

/** USD display: full below 100k, compact K/M/B/T above. */
function formatUsdCompact(n) {
  const num = toNum(n);
  if (!Number.isFinite(num)) return '—';
  if (num === 0) return '$0';
  const abs = Math.abs(num);
  if (abs < 100000) return formatUsd(num);
  if (abs >= 1e12) return `$${formatRoundedValue(num / 1e12)}T`;
  if (abs >= 1e9) return `$${formatRoundedValue(num / 1e9)}B`;
  if (abs >= 1e6) return `$${formatRoundedValue(num / 1e6)}M`;
  return `$${formatRoundedValue(num / 1e3)}K`;
}

/** Holdings table Value (USD). */
function formatHoldingUsdValue(n) {
  const num = toNum(n);
  if (!Number.isFinite(num) || num <= 0) return '—';
  const abs = Math.abs(num);
  if (abs >= 100000) return formatUsdCompact(num);
  return `$${formatRoundedValue(num)}`;
}

function formatAmount(n, symbol) {
  const num = toNum(n);
  const sym = symbol?.trim() ? ` ${symbol.trim()}` : '';
  if (num >= 1e9) return `${formatRoundedValue(num / 1e9)}B${sym}`;
  if (num >= 1e6) return `${formatRoundedValue(num / 1e6)}M${sym}`;
  if (num >= 1e3) return `${formatRoundedValue(num / 1e3)}K${sym}`;
  if (num >= 1) return `${formatRoundedValue(num)}${sym}`;
  if (num > 0) return `${formatRoundedValue(num)}${sym}`;
  return `0${sym}`;
}

function displayTokenSymbol(symbol) {
  const sym = (symbol || '').trim();
  if (!sym) return '—';
  if (sym.toUpperCase() === 'WSOL') return 'SOL';
  return sym;
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
  if (isStableToken(mint, symbol)) {
    return `<span class="holders-amount-cell amount-usdc">${escapeHtmlText(raw)}</span>`;
  }
  if (isSolToken(mint, symbol)) {
    return `<span class="holders-amount-cell amount-sol">${escapeHtmlText(raw)}</span>`;
  }
  const lastSpace = raw.lastIndexOf(' ');
  if (lastSpace === -1) {
    return `<span class="holders-amount-cell amount-other-value">${escapeHtmlText(raw)}</span>`;
  }
  const valuePart = raw.slice(0, lastSpace);
  const symbolPart = raw.slice(lastSpace + 1);
  return `<span class="holders-amount-cell"><span class="amount-other-value">${escapeHtmlText(valuePart)}</span> <span class="amount-other-symbol">${escapeHtmlText(symbolPart)}</span></span>`;
}

function formatHoldingAmountCellHtml(t) {
  const sym = displayTokenSymbol(t.symbol);
  return wrapHoldingAmountHtml(formatAmount(t.amountUi, sym), t.mintAddress, t.symbol);
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

function formatTablePriceUsd(n) {
  const num = toNum(n);
  if (!Number.isFinite(num) || num <= 0) return '—';
  return `$${formatRoundedValue(num)}`;
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

function formatChangeColumnHtml(t) {
  const has1d = hasValidPriceChangePct(t.priceChange1dPct);
  const has7d = hasValidPriceChangePct(t.priceChange7dPct);

  if (!has1d && !has7d) {
    return `<div class="holders-price-changes">${formatZeroChangeChipHtml('1d:')}${formatZeroChangeChipHtml('7d:')}</div>`;
  }

  const chips = [
    has1d ? formatPriceChangeChipHtml('1d:', t.priceChange1dPct) : has7d ? formatZeroChangeChipHtml('1d:', t.priceChange7dPct) : formatMissingChangeChipHtml('1d:'),
    has7d ? formatPriceChangeChipHtml('7d:', t.priceChange7dPct) : formatMissingChangeChipHtml('7d:', has1d ? t.priceChange1dPct : null),
  ];

  return `<div class="holders-price-changes">${chips.join('')}</div>`;
}

function formatPriceColumnHtml(t) {
  const spot = formatTablePriceUsd(t.priceUsd);
  if (spot === '—') return '—';
  return `<span class="holders-table-price">${escapeHtmlText(spot)}</span>`;
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
    const v = toNum(t.valueUsd);
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
    topCategoryLine: topCat
      ? `${topCat[0]} · ${topCat[1].count} token(s) · ${formatUsd(topCat[1].usd)}`
      : '—',
    topSubcategoryLine: topSub
      ? `${topSub[0]} · ${topSub[1].count} token(s) · ${formatUsd(topSub[1].usd)}`
      : '—',
  };
}

function iconUrl(item) {
  const u = item.logoUrl?.trim();
  if (!u) return '';
  if (u.startsWith('http') || u.startsWith('/')) return u;
  return `/${u.replace(/^\//, '')}`;
}

function isTopLogoRepairCandidate(mint) {
  const sorted = [...lastTokens].sort((a, b) => toNum(b.valueUsd) - toNum(a.valueUsd));
  return sorted.slice(0, TOP_LOGO_REPAIR_N).some((t) => t.mintAddress === mint);
}

function handleTokenIconLoad(mint, imgEl) {
  logoImageLoadedMints.add(mint);
  if (imgEl) {
    imgEl.classList.remove('token-logo--img-loading');
    imgEl.style.opacity = '1';
  }
  const slot = imgEl?.closest('.token-logo-slot');
  const spinner = slot?.querySelector('.token-logo--loading');
  if (spinner) spinner.remove();
}

function handleTokenIconError(mint, imgEl) {
  logoImageLoadedMints.delete(mint);
  if (imgEl) {
    imgEl.classList.add('token-logo--img-loading');
    imgEl.style.opacity = '0';
  }
  if (!isTopLogoRepairCandidate(mint)) return;
  if (logoFailedMints.has(mint) || logoRepairInFlight.has(mint)) return;
  logoFailedMints.add(mint);
  repairTokenLogo(mint, { force: true });
}

function tokenLogoSpinnerHtml() {
  return `<span class="token-logo token-logo--loading" aria-hidden="true"><span class="loading-spinner"></span></span>`;
}

function tokenIconShowsSpinner(t) {
  const mint = t.mintAddress;
  if (logoLoadingMints.has(mint) || logoPendingRepairMints.has(mint)) return true;
  const icon = iconUrl(t);
  if (!icon) return false;
  return !logoImageLoadedMints.has(mint);
}

function tokenIconHtml(t) {
  const mint = t.mintAddress;
  const icon = iconUrl(t);
  const mintAttr = escapeHtmlAttr(mint);
  const showSpinner = tokenIconShowsSpinner(t);

  if (!icon && !showSpinner) return '';

  let inner = '';
  if (showSpinner) inner += tokenLogoSpinnerHtml();
  if (icon) {
    const loaded = logoImageLoadedMints.has(mint);
    inner += `<img class="token-logo${loaded ? '' : ' token-logo--img-loading'}" src="${escapeHtmlAttr(icon)}" alt="" loading="lazy" style="${loaded ? '' : 'opacity:0'}" onload="window.__walletBalancesIconLoad?.('${mintAttr}', this)" onerror="window.__walletBalancesIconError?.('${mintAttr}', this)">`;
  }
  return `<span class="token-logo-slot">${inner}</span>`;
}

function updateTableAfterLogoChange() {
  const totalUsd = lastTokens.reduce((s, row) => s + toNum(row.valueUsd), 0);
  renderTable(lastTokens, totalUsd);
}

async function fetchRepairedLogo(mint, force) {
  const url = `/api/token/${encodeURIComponent(mint)}/logo?force=${force ? '1' : '0'}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  const logo = data.logoUrl?.trim();
  return logo || null;
}

async function repairTokenLogo(mint, options = {}) {
  if (logoRepairInFlight.has(mint)) return;
  logoRepairInFlight.add(mint);
  logoLoadingMints.add(mint);
  updateTableAfterLogoChange();
  try {
    const logo = await fetchRepairedLogo(mint, options.force === true);
    if (!logo) return;
    const idx = lastTokens.findIndex((row) => row.mintAddress === mint);
    if (idx < 0) return;
    if (lastTokens[idx].logoUrl?.trim() === logo) return;
    lastTokens[idx] = { ...lastTokens[idx], logoUrl: logo };
    logoImageLoadedMints.delete(mint);
  } catch {
    /* ignore per-token logo failures */
  } finally {
    logoLoadingMints.delete(mint);
    logoPendingRepairMints.delete(mint);
    logoRepairInFlight.delete(mint);
    updateTableAfterLogoChange();
  }
}

function queueTopLogoRepairs(tokens) {
  const sorted = [...tokens].sort((a, b) => toNum(b.valueUsd) - toNum(a.valueUsd));
  const candidates = sorted
    .slice(0, TOP_LOGO_REPAIR_N)
    .filter((item) => !item.logoUrl?.trim());
  for (const item of candidates) {
    logoPendingRepairMints.add(item.mintAddress);
  }
  if (candidates.length > 0) updateTableAfterLogoChange();
  for (const item of candidates) {
    repairTokenLogo(item.mintAddress);
  }
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
  return `<div class="token-supply-legend-item token-supply-legend-item--tier-dashboard">
    <article class="token-tier-card" style="--tier-accent:${args.accent};--tier-swatch:${args.swatchColor}">
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
    usdLine: '—',
    amountLine: '—',
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

function walletStatUsdHtml(value) {
  if (value == null) return escapeHtmlText('—');
  return `<span class="token-stat-usd-value">${escapeHtmlText(formatUsd(value))}</span>`;
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
  const rows = section.rows.map((r) => walletStatRowHtml(r)).join('');
  return `<section class="token-stats-group token-stats-group--${section.theme}">
    <h3 class="token-stats-group-title">${section.icon}<span>${escapeHtmlText(section.title)}</span></h3>
    <div class="token-stat-rows">${rows}</div>
  </section>`;
}

function buildWalletSummarySections(data) {
  const overview = {
    icon: WALLET_SECTION_ICONS.overview,
    title: 'Overview',
    theme: 'overview',
    rows: [
      {
        key: 'mint',
        label: 'Wallet',
        valueHtml: `<span class="mono">${escapeHtmlText(data.wallet)}</span>`,
      },
      {
        key: 'category',
        label: 'Tokens loaded',
        valueHtml:
          data.tokensCount == null ? escapeHtmlText('—') : escapeHtmlText(String(data.tokensCount)),
      },
      {
        key: 'verified',
        label: 'Verified tokens',
        valueHtml:
          data.verified == null
            ? escapeHtmlText('—')
            : escapeHtmlText(`${data.verified} verified · ${data.unverified ?? 0} unverified`),
      },
      {
        key: 'decimals',
        label: 'With USD price',
        valueHtml: data.priced == null ? escapeHtmlText('—') : escapeHtmlText(String(data.priced)),
      },
    ],
  };
  const portfolio = {
    icon: WALLET_SECTION_ICONS.portfolio,
    title: 'Portfolio Value',
    theme: 'price',
    rows: [
      { key: 'priceUsd', label: 'Est. total USD', valueHtml: walletStatUsdHtml(data.totalUsd) },
      { key: 'marketCap', label: 'Verified USD', valueHtml: walletStatUsdHtml(data.verifiedUsd) },
      { key: 'price1d', label: 'Unverified USD', valueHtml: walletStatUsdHtml(data.unverifiedUsd) },
      {
        key: 'price7d',
        label: 'Unpriced rows',
        valueHtml:
          data.unpricedCount == null ? escapeHtmlText('—') : escapeHtmlText(String(data.unpricedCount)),
      },
    ],
  };
  const taxonomy = {
    icon: WALLET_SECTION_ICONS.holdings,
    title: 'Categories & Labels',
    theme: 'supply',
    rows: [
      {
        key: 'supply',
        label: 'Unique categories',
        valueHtml:
          data.uniqueCategories == null
            ? escapeHtmlText('—')
            : escapeHtmlText(String(data.uniqueCategories)),
      },
      {
        key: 'tokenVol24h',
        label: 'Top category',
        valueHtml:
          data.topCategoryLine == null ? escapeHtmlText('—') : escapeHtmlText(data.topCategoryLine),
      },
      {
        key: 'usdVol24h',
        label: 'Unique subcategories',
        valueHtml:
          data.uniqueSubcategories == null
            ? escapeHtmlText('—')
            : escapeHtmlText(String(data.uniqueSubcategories)),
      },
      {
        key: 'topPnlCohortVol',
        label: 'Top subcategory',
        valueHtml:
          data.topSubcategoryLine == null
            ? escapeHtmlText('—')
            : escapeHtmlText(data.topSubcategoryLine),
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
    uniqueCategories: null,
    uniqueSubcategories: null,
    topCategoryLine: null,
    topSubcategoryLine: null,
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

function renderWalletSummaryPlaceholder() {
  walletSummaryLabel.textContent = '—';
  walletSummarySub.textContent = 'Enter a wallet and load balances';
  walletLastUpdatedValue.textContent = '—';
  walletSummaryStats.innerHTML = buildWalletSummaryPlaceholderHtml();
  updateHoldersSummaryStrip([]);
}

function walletUsdBands() {
  return [
    { label: '$0.01', contains: (v) => v > 0 && v < 0.01 },
    { label: '$0.01-$0.10', contains: (v) => v >= 0.01 && v < 0.1 },
    { label: '$0.10-$1.00', contains: (v) => v >= 0.1 && v < 1 },
    { label: '$1.00-$10.00', contains: (v) => v >= 1 && v < 10 },
    { label: '$10.00-$100.00', contains: (v) => v >= 10 && v < 100 },
    { label: '$100.00-$1,000', contains: (v) => v >= 100 && v < 1000 },
    { label: '$1,000-$10,000', contains: (v) => v >= 1000 && v < 10000 },
    { label: '$10,000+', contains: (v) => v >= 10000 },
  ];
}

const WALLET_USD_BAND_COLORS = [
  USD_MAGNITUDE_BAR_COLORS.orange,
  USD_MAGNITUDE_BAR_COLORS.yellow,
  USD_MAGNITUDE_BAR_COLORS.lightGreen,
  USD_MAGNITUDE_BAR_COLORS.green,
  USD_MAGNITUDE_BAR_COLORS.green,
  USD_MAGNITUDE_BAR_COLORS.green,
  USD_MAGNITUDE_BAR_COLORS.green,
  USD_MAGNITUDE_BAR_COLORS.green,
];

function walletUsdBandColor(i) {
  return WALLET_USD_BAND_COLORS[i] ?? USD_MAGNITUDE_BAR_COLORS.green;
}

function walletUsdBandIndex(valueUsd) {
  const v = toNum(valueUsd);
  if (v <= 0) return -1;
  return walletUsdBands().findIndex((d) => d.contains(v));
}

const HOLDERS_MONEY_BAG_SVG =
  '<path d="M11.25 2.35h1.5M9.85 5.1c0-.95 1-1.7 2.15-1.7s2.15.75 2.15 1.7-.95 1.45-2.15 1.45-2.15-.5-2.15-1.45Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.85 9.15c.55 2.35.6 4.75.6 7.1 0 3.15 2.2 5.75 5.15 5.75h.8c2.95 0 5.15-2.6 5.15-5.75 0-2.35.05-4.75.6-7.1-1.05-1.25-2.7-2.05-4.55-2.05h-.8c-1.85 0-3.5.8-4.55 2.05Z" fill="currentColor"/><path d="M12 12.35v3.85M10.35 13.85h2.9a1 1 0 1 1 0 2H10.35" fill="none" stroke="rgba(0,0,0,0.32)" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/>';

function holdersMoneyBagIconHtml(color, bandLabel) {
  const tip = bandLabel ? `USD band ${bandLabel}` : 'USD value band';
  return `<span class="holders-value-usd-bag" style="color:${escapeHtmlAttr(color)}" title="${escapeHtmlAttr(tip)}" aria-label="${escapeHtmlAttr(tip)}"><svg class="holders-value-usd-bag__svg" viewBox="0 0 24 24" aria-hidden="true">${HOLDERS_MONEY_BAG_SVG}</svg></span>`;
}

function formatHoldingValueUsdCellHtml(valueUsd) {
  const v = toNum(valueUsd);
  if (!Number.isFinite(v) || v <= 0) return '—';
  const bandIdx = walletUsdBandIndex(v);
  const color = bandIdx >= 0 ? walletUsdBandColor(bandIdx) : USD_MAGNITUDE_BAR_COLORS.green;
  const bandLabel = bandIdx >= 0 ? walletUsdBands()[bandIdx].label : '';
  const icon = holdersMoneyBagIconHtml(color, bandLabel);
  const text = formatHoldingUsdValue(v);
  return `<span class="holders-value-usd-cell">${icon}<span class="holders-value-usd-amount">${escapeHtmlText(text)}</span></span>`;
}

function renderUsdBarRow(d, i, count, total, maxC, defsLen) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const w = Math.min(100, (count / maxC) * 100);
  const color = walletUsdBandColor(i);
  const safe = escapeHtmlText(d.label);
  return `<div class="holders-hbar-row">
    <span class="holders-hbar-name" title="${safe}">${safe}</span>
    <div class="holders-hbar-track"><div class="holders-hbar-fill" style="width:${w}%;background:${color}"></div></div>
    <span class="holders-hbar-meta">${formatPctSmart(pct)} <span class="holders-value-usd">${count.toLocaleString()} token(s)</span></span>
  </div>`;
}

function renderUsdBarsPlaceholderHtml() {
  const defs = walletUsdBands();
  return defs.map((d, i) => renderUsdBarRow(d, i, 0, 0, 1, defs.length)).join('');
}

function renderUsdBars(tokens) {
  const defs = walletUsdBands();
  const counts = defs.map(() => 0);
  let pricedCount = 0;
  for (const t of tokens) {
    const v = toNum(t.valueUsd);
    const idx = defs.findIndex((d) => d.contains(v));
    if (idx >= 0) {
      counts[idx] += 1;
      pricedCount += 1;
    }
  }
  const maxC = Math.max(1, ...counts);
  const total = pricedCount || 1;
  holdingsUsdBars.innerHTML = defs
    .map((d, i) => renderUsdBarRow(d, i, counts[i], total, maxC, defs.length))
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
    buckets[cat].usd += toNum(t.valueUsd);
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
    profitable: 'profitable (1d ≥1% or 7d >1%)',
    breaking_even: 'breaking even (−0.50% to 1% on 1d or 7d)',
    losing: 'losing value (below −0.50% on 1d and 7d, or single metric below −0.50%)',
    dead: 'dead with no price change data',
  };
  let topKey = bucket.order[0];
  for (const key of bucket.order) {
    if (bucket.buckets[key].count > bucket.buckets[topKey].count) topKey = key;
  }
  const topIdx = bucket.order.indexOf(topKey);
  return `${formatPctSmart(bucket.slices[topIdx])} of tokens are ${labels[topKey]}.`;
}

function setChartsPlaceholder() {
  chartsPanel.hidden = false;
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
}

function renderCharts(tokens, wallet, totalUsd) {
  chartsPanel.hidden = false;
  const bucket = priceChange24hBuckets(tokens);
  const display = applyMinVisibleSlices(bucket.slices);
  portfolioPie.style.background = buildPieGradientWithGaps(display, PRICE_CHANGE_PIE_HEX);
  mountDonutPieOverlays(portfolioPie, display, PRICE_CHANGE_PIE_HEX, {
    mock: false,
    hubSubline: `${formatUsd(totalUsd)} · ${tokens.length} tokens`,
  });

  setSupplyLegendGrid(portfolioLegend, 4);
  portfolioLegend.innerHTML = PRICE_CHANGE_PIE_TITLES.map((title, i) =>
    renderTierCard({
      title,
      pieRankKey: PRICE_CHANGE_PIE_KEYS[i],
      accent: PRICE_CHANGE_PIE_HEX[i],
      swatchColor: PRICE_CHANGE_PIE_HEX[i],
      slicePct: bucket.slices[i],
      shareLabel: ' of tokens',
      usdLine: formatUsd(bucket.usd[i]),
      amountLine: `${bucket.counts[i]} token(s)`,
    }),
  ).join('');

  portfolioPieTitle.textContent = 'Tokens ranked by profitability';
  portfolioPieLede.textContent = `${tokens.length} tokens · ${formatUsd(totalUsd)} estimated portfolio value`;
  portfolioPieInsight.textContent = buildPriceChangePieInsight(bucket, tokens.length);

  renderUsdBars(tokens);
}

function renderSummaryStats(tokens, wallet, totalUsd) {
  const priced = tokens.filter((t) => toNum(t.valueUsd) > 0).length;
  const verified = tokens.filter((t) => t.verified).length;
  const unverified = tokens.length - verified;
  const unpricedCount = tokens.filter((t) => toNum(t.valueUsd) <= 0).length;
  const taxonomy = aggregateWalletTaxonomy(tokens);

  let verifiedUsd = 0;
  let unverifiedUsd = 0;
  for (const t of tokens) {
    const v = toNum(t.valueUsd);
    if (v <= 0) continue;
    if (t.verified) verifiedUsd += v;
    else unverifiedUsd += v;
  }

  walletSummaryLabel.textContent = truncateAddress(wallet);
  walletSummarySub.textContent = wallet;
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
    uniqueCategories: taxonomy.uniqueCategories,
    uniqueSubcategories: taxonomy.uniqueSubcategories,
    topCategoryLine: taxonomy.topCategoryLine,
    topSubcategoryLine: taxonomy.topSubcategoryLine,
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
  if (taxonomy.topCategoryLine !== '—') {
    const topCat = taxonomy.topCategoryLine.split(' · ')[0];
    parts.push(`Top category: ${topCat}`);
  }
  if (taxonomy.topSubcategoryLine !== '—') {
    const topSub = taxonomy.topSubcategoryLine.split(' · ')[0];
    parts.push(`Top subcategory: ${topSub}`);
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

function formatPriceSourceCellHtml(src) {
  const text = String(src || '').trim() || '—';
  if (text === '—') return '—';
  if (isVybePriceSource(text)) {
    return `<span class="holders-price-source">${VYBE_PRICE_SOURCE_ICON}<span>${escapeHtmlText(text)}</span></span>`;
  }
  return escapeHtmlText(text);
}

function formatMintCellHtml(mint) {
  const addr = String(mint || '').trim();
  if (!addr) return '—';
  const label = mintColumnLabel(addr);
  const href = `${SOLSCAN_TOKEN}${encodeURIComponent(addr)}`;
  return `<a class="holders-mint-link" href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtmlAttr(addr)}">${escapeHtmlText(label)}${HOLDERS_EXTERNAL_LINK_SVG}</a>`;
}

function renderTable(tokens, totalUsd) {
  updateHoldersSummaryStrip(tokens);
  const sorted = [...tokens].sort((a, b) => toNum(b.valueUsd) - toNum(a.valueUsd));
  holdersBody.innerHTML = sorted
    .map((t, i) => {
      const v = toNum(t.valueUsd);
      const pct = totalUsd > 0 && v > 0 ? (v / totalUsd) * 100 : 0;
      const iconHtml = tokenIconHtml(t);
      const src = t.priceSource || (v > 0 ? 'Vybe list' : '—');
      const pieCat = classifyTokenPieChange(t);
      return `<tr class="holders-row holders-row--${pieCat}">
        <td class="holders-rank-col"><div class="holders-rank-cell">${holdersRankBadgeHtml(pieCat)}<span class="holders-rank-num holders-rank-num--${pieCat}">${i + 1}</span></div></td>
        <td class="holders-change-col">${formatChangeColumnHtml(t)}</td>
        <td><div class="token-header">${iconHtml}<div class="token-header-text"><div class="symbol">${escapeHtmlText(t.symbol)}${tokenSymbolBadgesHtml(t)}</div><div class="name">${escapeHtmlText(t.name)}</div></div></div></td>
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
  loadingIndicator.hidden = false;
  holdersLoading.hidden = false;
  logoFailedMints.clear();
  logoPendingRepairMints.clear();
  logoImageLoadedMints.clear();

  try {
    const limit = limitSelect.value || '100';
    const url = `/api/wallets/${encodeURIComponent(wallet)}/token-balances?enrich=1&limit=${limit}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    lastTokens = data.tokens || [];
    const totalUsd = lastTokens.reduce((s, t) => s + toNum(t.valueUsd), 0);

    renderSummaryStats(lastTokens, wallet, totalUsd);
    renderCharts(lastTokens, wallet, totalUsd);
    renderTable(lastTokens, totalUsd);

    holdersMeta.textContent = `${lastTokens.length} tokens · RPC amounts + Vybe merge · Vybe token-details for category, supply, volume, and 1d/7d price change.`;

    queueTopLogoRepairs(lastTokens);
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    fetchAllBtn.disabled = false;
    loadingIndicator.hidden = true;
    holdersLoading.hidden = true;
  }
}

setChartsPlaceholder();
renderWalletSummaryPlaceholder();
hydrateHoldersSummaryLabelIcons();
fetchAllBtn.addEventListener('click', () => fetchBalances());
walletInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchBalances();
});

window.__walletBalancesIconError = handleTokenIconError;
window.__walletBalancesIconLoad = handleTokenIconLoad;

// Auto-load demo wallet on first visit
fetchBalances();
