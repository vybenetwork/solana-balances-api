/**
 * Same-origin logo proxy for the debug assets API.
 * ipfs.io returns 403 to browsers; alternate gateways + metadata URL unwrapping fix most logos.
 */

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_500_000;

const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.filebase.io/ipfs/',
  'https://dweb.link/ipfs/',
];

export function extractIpfsCidPath(url: string): string | null {
  const u = url.trim();
  const m = u.match(
    /^https?:\/\/(?:[^/]+\.)?(?:ipfs\.io|ipfs\.filebase\.io|gateway\.pinata\.cloud|dweb\.link|w3s\.link|cf-ipfs\.com|cloudflare-ipfs\.com)\/ipfs\/(.+)$/i,
  );
  if (m?.[1]) return m[1].split(/[?#]/)[0] || null;
  const m2 = u.match(/^ipfs:\/\/(.+)$/i);
  if (m2?.[1]) return m2[1].split(/[?#]/)[0] || null;
  return null;
}

export function logoProxyCandidates(rawUrl: string): string[] {
  const url = rawUrl.trim();
  if (!url) return [];
  const cid = extractIpfsCidPath(url);
  if (cid) {
    return [...new Set([...IPFS_GATEWAYS.map((g) => `${g}${cid}`), url])];
  }
  return [url];
}

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isImageContentType(ct: string): boolean {
  const t = ct.toLowerCase();
  return t.startsWith('image/') || t.includes('svg');
}

function imageFromMetadataJson(text: string): string | null {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    for (const key of ['image', 'imageUrl', 'logo', 'logoUri', 'icon']) {
      const v = data[key];
      if (typeof v === 'string' && v.trim() && isHttpUrl(v.trim())) return v.trim();
    }
    const props = data.properties;
    if (props && typeof props === 'object') {
      const img = (props as Record<string, unknown>).image;
      if (typeof img === 'string' && img.trim() && isHttpUrl(img.trim())) return img.trim();
    }
  } catch {
    /* not json */
  }
  return null;
}

async function fetchBytes(
  url: string,
): Promise<{ ok: boolean; status: number; contentType: string; body: Buffer }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'image/*,application/json,*/*',
        'User-Agent': 'solana-wallet-balances-api-logo-proxy/1.0',
      },
    });
    const contentType = res.headers.get('content-type') || '';
    const ab = await res.arrayBuffer();
    const body = Buffer.from(ab);
    return { ok: res.ok, status: res.status, contentType, body };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchProxiedLogo(
  rawUrl: string,
): Promise<{ contentType: string; body: Buffer } | null> {
  if (!isHttpUrl(rawUrl)) return null;

  const queue = logoProxyCandidates(rawUrl);
  const seen = new Set<string>();

  while (queue.length > 0) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    if (seen.size > 8) break;

    try {
      const got = await fetchBytes(url);
      if (!got.ok || got.body.length === 0 || got.body.length > MAX_BYTES) continue;

      if (isImageContentType(got.contentType)) {
        return { contentType: got.contentType.split(';')[0]!.trim() || 'image/png', body: got.body };
      }

      // Sniff images with wrong/missing content-type.
      if (
        got.body[0] === 0xff ||
        got.body[0] === 0x89 ||
        got.body.toString('utf8', 0, 5).startsWith('<svg') ||
        got.body.toString('utf8', 0, 5).startsWith('<?xml')
      ) {
        return { contentType: 'image/png', body: got.body };
      }

      // Metadata JSON (e.g. meta.uxento.io) → follow image field.
      const ct = got.contentType.toLowerCase();
      if (ct.includes('json') || ct.includes('text/plain') || url.includes('meta.uxento.io')) {
        const next = imageFromMetadataJson(got.body.toString('utf8'));
        if (next && !seen.has(next)) queue.unshift(...logoProxyCandidates(next));
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Client-facing logo URL that loads via our same-origin proxy. */
export function toProxiedLogoUrl(logo: string | null | undefined): string | null {
  const u = String(logo ?? '').trim();
  if (!u) return null;
  if (u.startsWith('/cached/') || u.startsWith('/data/') || u.startsWith('/api/proxy-logo')) {
    return u;
  }
  if (!isHttpUrl(u)) return null;
  return `/api/proxy-logo?url=${encodeURIComponent(u)}`;
}

/**
 * Prefer browser-loadable logo URLs.
 * ipfs.io often 403s — rewrite to a public IPFS gateway. Metadata JSON hosts still use the proxy.
 */
export function toClientLogoUrl(logo: string | null | undefined): string | null {
  const u = String(logo ?? '').trim();
  if (!u) return null;
  if (u.startsWith('/cached/') || u.startsWith('/data/') || u.startsWith('/api/proxy-logo')) {
    return u;
  }
  if (!isHttpUrl(u)) return null;

  const cid = extractIpfsCidPath(u);
  if (cid) return `https://gateway.pinata.cloud/ipfs/${cid}`;

  // JSON metadata wrappers need server-side unwrap.
  if (/meta\.uxento\.io\//i.test(u) || /\/metadata\//i.test(u)) {
    return toProxiedLogoUrl(u);
  }
  return u;
}
