import 'dotenv/config';

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || '',

  ingest: {
    cron: process.env.INGEST_CRON || '*/30 * * * *',
    maxJobsPerSource: parseInt(process.env.MAX_JOBS_PER_SOURCE, 10) || 500,
  },

  http: {
    timeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS, 10) || 8000,
  },

  circuitBreaker: {
    errorThresholdPercentage: parseInt(process.env.CB_ERROR_THRESHOLD, 10) || 50,
    resetTimeoutMs: parseInt(process.env.CB_RESET_TIMEOUT_MS, 10) || 60_000,
    volumeThreshold: 3,
  },

  rateLimiter: {
    requestsPerMinute: parseInt(process.env.RATE_LIMIT_RPM, 10) || 4,
  },

  retry: {
    maxRetries: parseInt(process.env.MAX_RETRIES, 10) || 4,
    baseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS, 10) || 1000,
  },
};

export default config;
