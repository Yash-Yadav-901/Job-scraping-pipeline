import crypto from 'crypto';

/**
 * Generates a stable SHA-256 dedup key from a job's canonical URL.
 * Used as the primary key (_id) in MongoDB to ensure idempotent inserts.
 *
 * @param {string} url - The job listing URL
 * @returns {string} 64-char hex digest
 */
export function jobId(url) {
  return crypto.createHash('sha256').update(String(url)).digest('hex');
}

export function runId(sourceId) {
  return `${sourceId}-${Date.now()}`;
}
