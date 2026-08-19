import logger from '../utils/logger.js';
import config from '../config/index.js';

class TokenBucket {
  constructor({ capacity, refillRatePerMinute }) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRateMs = (60 * 1000) / refillRatePerMinute;
    this.lastRefill = Date.now();
  }

  _refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.refillRateMs);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  tryConsume() {
    this._refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  }

  async consume() {
    while (!this.tryConsume()) {
      await new Promise((r) => setTimeout(r, this.refillRateMs));
    }
  }

  get status() {
    this._refill();
    return { tokens: this.tokens, capacity: this.capacity };
  }
}

class RateLimiter {
  constructor() {
    this._buckets = new Map();
  }

  _getBucket(sourceId, rpmOverride) {
    if (!this._buckets.has(sourceId)) {
      const rpm = rpmOverride || config.rateLimiter.requestsPerMinute;
      this._buckets.set(
        sourceId,
        new TokenBucket({ capacity: rpm, refillRatePerMinute: rpm })
      );
      logger.debug({ sourceId, rpm }, 'Rate limiter bucket created');
    }
    return this._buckets.get(sourceId);
  }

  async acquire(sourceId, rpmOverride) {
    const bucket = this._getBucket(sourceId, rpmOverride);
    await bucket.consume();
    logger.debug({ sourceId, ...bucket.status }, 'Rate limit token consumed');
  }

  status(sourceId) {
    const bucket = this._buckets.get(sourceId);
    return bucket ? bucket.status : { tokens: 0, capacity: 0 };
  }
}

export default new RateLimiter();
