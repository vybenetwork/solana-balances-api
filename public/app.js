'use strict';

const PIE_SLICE_HEX = ['#22c55e', '#2563eb', '#a855f7', '#f97316'];
const TIER_LEGEND_SVG_VOLUME =
  '<svg class="token-tier-metric__svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 12h4v8H3v-8zm7-4h4v12h-4V8zm7 6h4v6h-4v-6z"/></svg>';

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

function toNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function formatPctSmart(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return '0%';
  const abs = Math.abs(num);
  if (abs >= 0.01) return `${num.toFixed(2)}%`;
  const decimals = Math.max(3, Math.min(8, Math.ceil(-Math.log10(abs))));
  return `${num.toFixed(decimals)}%`;
}

function formatUsd(n) {
  const num = toNum(n);
  if (num === 0) return '$0';
  if (Math.abs(num) < 1) {
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }
  return `$${Math.round(num).toLocaleString()}`;
}

/** USD display: full below 100k, compact K/M/B/T with max 2 decimals above. */
function formatUsdCompact(n) {
  const num = toNum(n);
  if (!Number.isFinite(num)) return '—';
  if (num === 0) return '$0';
  const abs = Math.abs(num);
  if (abs < 100000) return formatUsd(num);
  const trimCompact = (value) => value.toFixed(2).replace(/\.?0+$/, '');
  if (abs >= 1e12) return `$${trimCompact(num / 1e12)}T`;
  if (abs >= 1e9) return `$${trimCompact(num / 1e9)}B`;
  if (abs >= 1e6) return `$${trimCompact(num / 1e6)}M`;
  return `$${trimCompact(num / 1e3)}K`;
}

/** Holdings table Value (USD): max 2 decimals; tiny positive values show &lt; $0.01. */
function formatHoldingUsdValue(n) {
  const num = toNum(n);
  if (!Number.isFinite(num) || num <= 0) return '—';
  if (num < 0.01) return '< $0.01';
  const abs = Math.abs(num);
  if (abs >= 100000) return formatUsdCompact(num);
  const trimmed = num.toFixed(2).replace(/\.?0+$/, '');
  return `$${trimmed}`;
}

function formatAmount(n, symbol) {
  const num = toNum(n);
  const sym = symbol?.trim() ? ` ${symbol.trim()}` : '';
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B${sym}`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M${sym}`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K${sym}`;
  if (num >= 1) return `${num.toLocaleString(undefined, { maximumFractionDigits: 4 })}${sym}`;
  if (num > 0) return `${num.toPrecision(4)}${sym}`;
  return `0${sym}`;
}

function formatCompactNum(n) {
  const num = toNum(n);
  if (!Number.isFinite(num) || num === 0) return '0';
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  if (num >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return num.toPrecision(4);
}

function formatPriceUsdSpot(n) {
  const num = toNum(n);
  if (!Number.isFinite(num) || num <= 0) return '—';
  if (num >= 1) return `$${num.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
  return `$${num.toPrecision(4)}`;
}

function formatPriceChangePctHtml(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return '—';
  const num = Number(pct);
  const toneClass =
    num > 0 ? 'usd-tone usd-tone--positive' : num < 0 ? 'usd-tone usd-tone--negative' : 'usd-tone usd-tone--neutral';
  const sign = num > 0 ? '+' : '';
  return `<span class="token-stat-price-pct ${toneClass}">${sign}${formatPctSmart(num)}</span>`;
}

function formatPriceChangeLineHtml(label, pct) {
  return `<div class="holders-price-change-line"><span class="holders-price-change-label">${escapeHtmlText(label)}</span> ${formatPriceChangePctHtml(pct)}</div>`;
}

function formatPriceColumnHtml(t) {
  const spot = formatPriceUsdSpot(t.priceUsd);
  if (spot === '—') return '—';
  return `<div class="holders-price-cell"><div class="holders-price-spot">${escapeHtmlText(spot)}</div>${formatPriceChangeLineHtml('1 Day', t.priceChange1dPct)}${formatPriceChangeLineHtml('7 Days', t.priceChange7dPct)}</div>`;
}

function formatCategoryColumnHtml(category, subcategory) {
  const cat = (category || '').trim();
  const sub = (subcategory || '').trim();
  if (!cat && !sub) return '—';
  if (!cat) return escapeHtmlText(sub);
  if (!sub) return escapeHtmlText(cat);
  return `<div class="holders-category-cell"><div>${escapeHtmlText(cat)}</div><div class="holders-category-sub meta">(${escapeHtmlText(sub)})</div></div>`;
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
  return `<div class="token-supply-legend-item token-supply-legend-item--tier-dashboard">
    <article class="token-tier-card" style="--tier-accent:${args.accent};--tier-swatch:${args.swatchColor}">
      <h4 class="token-tier-card__title">${t}</h4>
      <ul class="token-tier-card__metrics">
        <li class="token-tier-metric">
          <span class="token-tier-metric__ico token-tier-metric__ico--share-swatch" style="--tier-swatch:${args.swatchColor}" aria-hidden="true"></span>
          <div class="token-tier-metric__body"><span class="token-tier-metric__slice-pct">${formatPctSmart(args.slicePct)}</span><span class="token-tier-metric__muted"> of portfolio</span></div>
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

function renderTierCardPlaceholder(title, accent, swatch) {
  return renderTierCard({
    title,
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

function renderUsdBarRow(d, i, count, total, maxC, defsLen) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const w = Math.min(100, (count / maxC) * 100);
  const gradT = defsLen > 1 ? (defsLen - 1 - i) / (defsLen - 1) : 0;
  const safe = escapeHtmlText(d.label);
  return `<div class="holders-hbar-row">
    <span class="holders-hbar-name" title="${safe}">${safe}</span>
    <div class="holders-hbar-track"><div class="holders-hbar-fill holders-hbar-fill--trade-scale" style="width:${w}%;--trade-grad-t:${gradT}"></div></div>
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

function portfolioBuckets(tokens, totalUsd) {
  const sorted = [...tokens].sort((a, b) => toNum(b.valueUsd) - toNum(a.valueUsd));
  const top1 = sorted.slice(0, 1).reduce((s, t) => s + toNum(t.valueUsd), 0);
  const top2_5 = sorted.slice(1, 5).reduce((s, t) => s + toNum(t.valueUsd), 0);
  const top6_10 = sorted.slice(5, 10).reduce((s, t) => s + toNum(t.valueUsd), 0);
  const rest = Math.max(0, totalUsd - top1 - top2_5 - top6_10);
  const pct = (v) => (totalUsd > 0 ? (v / totalUsd) * 100 : 0);
  return {
    sorted,
    slices: [pct(top1), pct(top2_5), pct(top6_10), pct(rest)],
    usd: [top1, top2_5, top6_10, rest],
    counts: [Math.min(1, sorted.length), Math.min(4, Math.max(0, sorted.length - 1)), Math.min(5, Math.max(0, sorted.length - 5)), Math.max(0, sorted.length - 10)],
  };
}

function setChartsPlaceholder() {
  chartsPanel.hidden = false;
  const empty4 = buildPieGradientWithGaps([0, 0, 0, 0], PIE_SLICE_HEX);
  portfolioPie.style.background = empty4;
  mountDonutPieOverlays(portfolioPie, [0, 0, 0, 0], PIE_SLICE_HEX, { mock: true, hubSubline: '—' });
  setSupplyLegendGrid(portfolioLegend, 4);
  portfolioLegend.innerHTML = [
    renderTierCardPlaceholder('Top holding', PIE_SLICE_HEX[0], PIE_SLICE_HEX[0]),
    renderTierCardPlaceholder('Ranks 2–5', PIE_SLICE_HEX[1], PIE_SLICE_HEX[1]),
    renderTierCardPlaceholder('Ranks 6–10', PIE_SLICE_HEX[2], PIE_SLICE_HEX[2]),
    renderTierCardPlaceholder('Remaining tokens', PIE_SLICE_HEX[3], PIE_SLICE_HEX[3]),
  ].join('');
  holdingsUsdBars.innerHTML = renderUsdBarsPlaceholderHtml();
  portfolioPieLede.textContent = 'Load a wallet to see portfolio allocation by USD value.';
  portfolioPieInsight.textContent = 'Holdings grouped by USD rank and portfolio share.';
}

function renderCharts(tokens, wallet, totalUsd) {
  chartsPanel.hidden = false;
  const bucket = portfolioBuckets(tokens, totalUsd);
  const display = applyMinVisibleSlices(bucket.slices);
  portfolioPie.style.background = buildPieGradientWithGaps(display, PIE_SLICE_HEX);
  mountDonutPieOverlays(portfolioPie, display, PIE_SLICE_HEX, {
    mock: false,
    hubSubline: `${formatUsd(totalUsd)} · ${tokens.length} tokens`,
  });

  const titles = ['Top holding', 'Ranks 2–5', 'Ranks 6–10', 'Remaining tokens'];
  setSupplyLegendGrid(portfolioLegend, 4);
  portfolioLegend.innerHTML = titles
    .map((title, i) =>
      renderTierCard({
        title,
        accent: PIE_SLICE_HEX[i],
        swatchColor: PIE_SLICE_HEX[i],
        slicePct: bucket.slices[i],
        usdLine: formatUsd(bucket.usd[i]),
        amountLine: `${bucket.counts[i]} token(s)`,
      }),
    )
    .join('');

  const topSym = bucket.sorted[0]?.symbol || '—';
  portfolioPieTitle.textContent = `Portfolio allocation (${truncateAddress(wallet)})`;
  portfolioPieLede.textContent = `${tokens.length} tokens · ${formatUsd(totalUsd)} estimated portfolio value`;
  portfolioPieInsight.textContent =
    bucket.sorted.length > 0
      ? `Largest position: ${topSym} at ${formatPctSmart(bucket.slices[0])} of portfolio USD.`
      : 'No priced holdings.';

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

function renderTable(tokens, totalUsd) {
  const sorted = [...tokens].sort((a, b) => toNum(b.valueUsd) - toNum(a.valueUsd));
  holdersBody.innerHTML = sorted
    .map((t, i) => {
      const v = toNum(t.valueUsd);
      const pct = totalUsd > 0 && v > 0 ? (v / totalUsd) * 100 : 0;
      const iconHtml = tokenIconHtml(t);
      const src = t.priceSource || (v > 0 ? 'Vybe list' : '—');
      return `<tr>
        <td>${i + 1}</td>
        <td><div class="token-header">${iconHtml}<span class="symbol">${escapeHtmlText(t.symbol)}</span>${t.verified ? ' <span class="meta">✓</span>' : ''}</div><span class="name">${escapeHtmlText(t.name)}</span></td>
        <td class="num">${formatAmount(t.amountUi, '')}</td>
        <td class="holders-value-usd num" style="text-align:right">${v > 0 ? formatHoldingUsdValue(v) : '—'}</td>
        <td class="num" style="text-align:right">${v > 0 ? formatPctSmart(pct) : '—'}</td>
        <td class="holders-category-col">${formatCategoryColumnHtml(t.category, t.subcategory)}</td>
        <td>${t.verified ? 'Yes' : 'No'}</td>
        <td class="num holders-price-col" style="text-align:right">${formatPriceColumnHtml(t)}</td>
        <td class="holders-value-usd num" style="text-align:right">${t.marketCap != null ? formatUsdCompact(t.marketCap) : '—'}</td>
        <td class="num" style="text-align:right">${t.currentSupply != null ? escapeHtmlText(formatCompactNum(t.currentSupply)) : '—'}</td>
        <td class="num" style="text-align:right">${t.tokenAmountVolume24h != null ? escapeHtmlText(formatCompactNum(t.tokenAmountVolume24h)) : '—'}</td>
        <td class="holders-value-usd num" style="text-align:right">${t.usdValueVolume24h != null ? formatUsdCompact(t.usdValueVolume24h) : '—'}</td>
        <td>${escapeHtmlText(src)}</td>
        <td class="meta">${escapeHtmlText(truncateAddress(t.mintAddress))}</td>
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
fetchAllBtn.addEventListener('click', () => fetchBalances());
walletInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchBalances();
});

window.__walletBalancesIconError = handleTokenIconError;
window.__walletBalancesIconLoad = handleTokenIconLoad;

// Auto-load demo wallet on first visit
fetchBalances();
