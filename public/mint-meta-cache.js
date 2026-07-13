/**
 * Browser-persisted mint → { symbol, name, logoUrl } cache (localStorage).
 * Used by holdings + DeFi so we skip enrichment/repair when meta is already known.
 */
(function (global) {
  'use strict';

  const STORE_KEY = 'vybe:mintMeta:v1';
  const MAX_ENTRIES = 2500;
  const LOCAL_LOGO_PREFIXES = [
    '/cached/token-icons/',
    '/data/token-icons/',
    '/cached/protocol-icons/',
    '/data/protocol-icons/',
  ];

  /** @type {Record<string, { symbol?: string, name?: string, logoUrl?: string, updatedAt?: number }> | null} */
  let memory = null;

  function clean(s) {
    if (s == null) return '';
    // Never coerce logo/symbol arrays to "a,b" strings.
    if (Array.isArray(s)) return '';
    return String(s).trim();
  }

  function normalizeLogoUrl(url) {
    if (Array.isArray(url)) {
      for (const part of url) {
        const hit = normalizeLogoUrl(part);
        if (hit) return hit;
      }
      return '';
    }
    const u = clean(url);
    // Reject Array.prototype.toString leftovers like "/cached/…png,"
    if (!u || u.includes(',')) return '';
    if (!LOCAL_LOGO_PREFIXES.some((p) => u.startsWith(p))) return '';
    return u;
  }

  function isLocalLogoUrl(url) {
    return Boolean(normalizeLogoUrl(url));
  }

  function looksTruncated(label) {
    const s = String(label ?? '');
    return s.includes('…') || s.includes('...');
  }

  function isUsableSymbol(symbol, mint) {
    const s = clean(symbol);
    if (!s || looksTruncated(s)) return false;
    const m = clean(mint);
    if (m && s === m) return false;
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) && s.length >= 32) return false;
    return true;
  }

  function scrubStore(store) {
    let changed = false;
    for (const [mint, hit] of Object.entries(store)) {
      if (!hit || typeof hit !== 'object') {
        delete store[mint];
        changed = true;
        continue;
      }
      const logoUrl = normalizeLogoUrl(hit.logoUrl);
      if (hit.logoUrl && hit.logoUrl !== logoUrl) {
        if (logoUrl) hit.logoUrl = logoUrl;
        else delete hit.logoUrl;
        changed = true;
      }
    }
    return changed;
  }

  function loadStore() {
    if (memory) return memory;
    try {
      const raw = global.localStorage?.getItem(STORE_KEY);
      if (!raw) {
        memory = {};
        return memory;
      }
      const parsed = JSON.parse(raw);
      memory = parsed && typeof parsed === 'object' ? parsed : {};
      if (scrubStore(memory)) persistStore();
    } catch {
      memory = {};
    }
    return memory;
  }

  function persistStore() {
    if (!memory) return;
    try {
      const entries = Object.entries(memory);
      if (entries.length > MAX_ENTRIES) {
        entries.sort((a, b) => (a[1]?.updatedAt || 0) - (b[1]?.updatedAt || 0));
        const drop = entries.length - MAX_ENTRIES;
        for (let i = 0; i < drop; i++) delete memory[entries[i][0]];
      }
      global.localStorage?.setItem(STORE_KEY, JSON.stringify(memory));
    } catch {
      /* quota / private mode */
    }
  }

  function get(mint) {
    const m = clean(mint);
    if (!m) return null;
    const hit = loadStore()[m];
    if (!hit || typeof hit !== 'object') return null;
    const logoUrl = normalizeLogoUrl(hit.logoUrl);
    const symbol = isUsableSymbol(hit.symbol, m) ? clean(hit.symbol) : '';
    const name = clean(hit.name);
    if (!logoUrl && !symbol && !name) return null;
    return {
      symbol: symbol || undefined,
      name: name && !looksTruncated(name) ? name : undefined,
      logoUrl: logoUrl || undefined,
    };
  }

  function put(mint, partial) {
    const m = clean(mint);
    if (!m || !partial || typeof partial !== 'object') return null;
    const store = loadStore();
    const prev = store[m] || {};
    const next = { ...prev, updatedAt: Date.now() };

    const symbol = clean(partial.symbol);
    if (isUsableSymbol(symbol, m)) next.symbol = symbol;

    const name = clean(partial.name);
    if (name && !looksTruncated(name)) next.name = name;

    const logoUrl = normalizeLogoUrl(partial.logoUrl ?? partial.logourl);
    if (logoUrl) next.logoUrl = logoUrl;
    else if ('logoUrl' in partial || 'logourl' in partial) {
      // Drop previously poisoned comma URLs when a bad value is written.
      const incoming = partial.logoUrl ?? partial.logourl;
      if (incoming != null && String(incoming).includes(',')) delete next.logoUrl;
    }

    if (!next.symbol && !next.name && !next.logoUrl) return get(m);

    store[m] = next;
    persistStore();
    return get(m);
  }

  function hydrateToken(token) {
    if (!token || typeof token !== 'object') return token;
    const mint = clean(token.mintAddress || token.address || token.mint);
    if (!mint) return token;
    const cached = get(mint);
    if (!cached) return token;

    if ((!clean(token.symbol) || looksTruncated(token.symbol)) && cached.symbol) {
      token.symbol = cached.symbol;
    }
    if ((!clean(token.name) || looksTruncated(token.name)) && cached.name) {
      token.name = cached.name;
    }
    const tokenLogo = normalizeLogoUrl(token.logoUrl);
    if (!tokenLogo && cached.logoUrl) {
      token.logoUrl = cached.logoUrl;
    } else if (token.logoUrl && !tokenLogo && cached.logoUrl) {
      // Replace poisoned "…png," with a clean cached path.
      token.logoUrl = cached.logoUrl;
    } else if (token.logoUrl && !normalizeLogoUrl(token.logoUrl)) {
      token.logoUrl = cached.logoUrl || '';
    }
    return token;
  }

  function rememberToken(token) {
    if (!token || typeof token !== 'object') return;
    const mint = clean(token.mintAddress || token.address || token.mint);
    if (!mint) return;
    put(mint, {
      symbol: token.symbol,
      name: token.name,
      logoUrl: token.logoUrl || token.logourl,
    });
  }

  /** Drop a stale local logo path (e.g. after server cache wipe → 404). */
  function forgetLogo(mint) {
    const m = clean(mint);
    if (!m) return;
    const store = loadStore();
    const hit = store[m];
    if (!hit || typeof hit !== 'object' || !hit.logoUrl) return;
    delete hit.logoUrl;
    if (!hit.symbol && !hit.name) delete store[m];
    else store[m] = hit;
    persistStore();
  }

  global.VybeMintMetaCache = {
    get,
    put,
    hydrateToken,
    rememberToken,
    forgetLogo,
    isLocalLogoUrl,
    normalizeLogoUrl,
  };
})(typeof window !== 'undefined' ? window : globalThis);
