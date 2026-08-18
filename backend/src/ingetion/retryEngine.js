import logger from '../utils/logger.js';
import identityManager from './identityManager.js';
import config from '../config/index.js';

const TRANSIENT_HTTP_CODES = new Set([408, 429, 500, 502, 503, 504]);

const TRANSIENT_NODE_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNABORTED',
]);

export function isTransient(err) {
  if (err.code && TRANSIENT_NODE_CODES.has(err.code)) return true;
  if (err.response && TRANSIENT_HTTP_CODES.has(err.response.status)) return true;
  if (err.message && err.message.toLowerCase().includes('timeout')) return true;
  return false;
}

function backoffDelay(attempt, baseMs, jitterMs) {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * jitterMs;
  return Math.round(exponential + jitter);
}

export async function withRetry(fn, opts = {}) {
  const {
    sourceId,
    label = 'unknown',
    maxRetries = config.retry.maxRetries,
    baseDelayMs = config.retry.baseDelayMs,
    jitterMs = 500,
  } = opts;

  let lastErr;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info({ sourceId, label, attempt }, 'Retry succeeded');
      }
      return { result, retries: attempt };
    } catch (err) {
      lastErr = err;

      const transient = isTransient(err);
      const isLast = attempt === maxRetries;

      logger.warn(
        {
          sourceId,
          label,
          attempt,
          maxRetries,
          transient,
          errCode: err.code,
          httpStatus: err.response?.status,
          errMessage: err.message,
        },
        transient ? 'Transient error — will retry' : 'Fatal error — aborting retries'
      );

      if (!transient || isLast) break;

      if (sourceId) identityManager.rotateIdentity(sourceId);

      const delay = backoffDelay(attempt, baseDelayMs, jitterMs);
      logger.debug({ sourceId, delay }, `Backing off for ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}
