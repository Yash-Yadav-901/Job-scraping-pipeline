import CircuitBreaker from 'opossum';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import { getSourceById, updateSourceStatus } from '../db/index.js';

const breakers = new Map();

export function getBreaker(sourceId, fn) {
  if (breakers.has(sourceId)) return breakers.get(sourceId);

  const breaker = new CircuitBreaker(fn, {
    timeout: 120_000,
    errorThresholdPercentage: config.circuitBreaker.errorThresholdPercentage,
    resetTimeout: config.circuitBreaker.resetTimeoutMs,
    volumeThreshold: config.circuitBreaker.volumeThreshold,
    name: sourceId,
  });

  breaker.on('open', () => {
    logger.warn({ sourceId }, 'Circuit OPENED — source is blocked, fast-failing requests');
    _persistState(sourceId, 'OPEN');
  });

  breaker.on('halfOpen', () => {
    logger.info({ sourceId }, 'Circuit HALF_OPEN — sending probe request');
    _persistState(sourceId, 'HALF_OPEN');
  });

  breaker.on('close', () => {
    logger.info({ sourceId }, 'Circuit CLOSED — source recovered');
    _persistState(sourceId, 'CLOSED');
  });

  breaker.on('fallback', () => {
    logger.warn({ sourceId }, 'Circuit fallback triggered — returning empty result');
  });

  breaker.on('timeout', () => {
    logger.warn({ sourceId }, 'Circuit breaker: request timed out');
  });

  breaker.on('reject', () => {
    logger.debug({ sourceId }, 'Circuit breaker: request rejected (circuit OPEN)');
  });

  breaker.fallback(() => []);

  breakers.set(sourceId, breaker);
  return breaker;
}

async function _persistState(sourceId, state) {
  try {
    const src = await getSourceById(sourceId);
    if (src) {
      await updateSourceStatus({
        id: sourceId,
        circuit_state: state,
        last_run_status: src.last_run_status || null,
        jobs_last_run: src.jobs_last_run || 0,
        jobs_new: 0,
        consecutive_failures: src.consecutive_failures || 0,
      });
    }
  } catch (err) {
    logger.error({ err, sourceId }, 'Failed to persist circuit breaker state');
  }
}

export function getState(sourceId) {
  const breaker = breakers.get(sourceId);
  if (!breaker) return 'CLOSED';
  if (breaker.opened) return 'OPEN';
  if (breaker.halfOpen) return 'HALF_OPEN';
  return 'CLOSED';
}

export function getStats(sourceId) {
  const breaker = breakers.get(sourceId);
  if (!breaker) return null;
  const stats = breaker.stats;
  return {
    state: getState(sourceId),
    failures: stats.failures,
    successes: stats.successes,
    latencyMean: stats.latencyMean,
    percentiles: stats.percentiles,
  };
}
