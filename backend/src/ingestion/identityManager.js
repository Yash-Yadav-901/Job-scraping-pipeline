import logger from '../utils/logger.js';

const IDENTITY_POOL = [
  {
    label: 'chrome-win11-en-us',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      DNT: '1',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    },
  },
  {
    label: 'chrome-mac-en-gb',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      DNT: '1',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
  },
  {
    label: 'firefox-linux-en-us',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    },
  },
  {
    label: 'edge-win10-en-us',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      DNT: '1',
      'Upgrade-Insecure-Requests': '1',
    },
  },
  {
    label: 'safari-macos-en-us',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
    },
  },
  {
    label: 'chrome-android-en-us',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
    },
  },
];

const sourceIdentityMap = new Map();

class IdentityManager {
  getIdentity(sourceId) {
    if (!sourceIdentityMap.has(sourceId)) {
      const idx = Math.floor(Math.random() * IDENTITY_POOL.length);
      sourceIdentityMap.set(sourceId, idx);
      logger.debug({ sourceId, identity: IDENTITY_POOL[idx].label }, 'Assigned new identity');
    }
    return IDENTITY_POOL[sourceIdentityMap.get(sourceId)];
  }

  rotateIdentity(sourceId) {
    const current = sourceIdentityMap.get(sourceId) ?? 0;
    const next = (current + 1) % IDENTITY_POOL.length;
    sourceIdentityMap.set(sourceId, next);
    logger.info({ sourceId, newIdentity: IDENTITY_POOL[next].label }, 'Identity rotated');
    return IDENTITY_POOL[next];
  }

  buildHeaders(sourceId, extra = {}) {
    const identity = this.getIdentity(sourceId);
    return {
      'User-Agent': identity.userAgent,
      ...identity.headers,
      ...extra,
    };
  }

  async humanDelay(baseMs = 500, jitterMs = 800) {
    const u1 = Math.random();
    const u2 = Math.random();
    const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const jitter = Math.abs(gaussian * (jitterMs / 2));
    const delay = Math.round(baseMs + jitter);
    await new Promise((r) => setTimeout(r, delay));
  }
}

export default new IdentityManager();
